import {describe, expect, it} from 'vitest';

import {createEventSourcedGraphModel, type AsyncGraphEventStore} from './eventSourcedGraphModel';
import {Events, type DomainEvent} from '../domain/events';
import {AppendConditionFailedError, Query, type AppendCondition, type ReadOptions, type SequencedEvent, type SpecEventStore} from '@slicr/event-sourcing';
import {NODE_HEIGHT, NODE_WIDTH} from './constants';

const defaultProjectId = 'default-project';

function createIdGenerator(ids: string[]) {
  let index = 0;
  return () => {
    const nextId = ids[index];
    if (nextId === undefined) {
      throw new Error('No more generated ids available');
    }
    index += 1;
    return nextId;
  };
}

function createStores(initialEvents: DomainEvent[] = []): {
  events: DomainEvent[];
  graphStore: AsyncGraphEventStore;
  commandStore: SpecEventStore<DomainEvent>;
} {
  const events = [...initialEvents];

  const readSequencedEvents = (from?: number) => {
    const sequencedEvents = events.map((event, index) => ({position: index + 1, event}));
    return from === undefined
      ? sequencedEvents
      : sequencedEvents.filter((sequencedEvent) => sequencedEvent.position > from);
  };

  const matchesQuery = (query: Query, event: DomainEvent) => {
    if (query.kind === 'none') {
      return false;
    }
    if (query.kind === 'all') {
      return true;
    }
    return query.items.some((queryItem) => {
      const matchesType = queryItem.types === undefined || queryItem.types.includes(event.type);
      const matchesTags = queryItem.tags === undefined || queryItem.tags.every((tag) => event.tags.includes(tag));
      return matchesType && matchesTags;
    });
  };

  const commandStore: SpecEventStore<DomainEvent> = {
    append: async (nextEvents, condition?: AppendCondition) => {
      const conflictingEvents = condition === undefined
        ? []
        : readSequencedEvents(condition.after).filter(({event}) => matchesQuery(condition.failIfEventsMatch, event));

      if (condition !== undefined && conflictingEvents.length > 0) {
        throw new AppendConditionFailedError(condition, conflictingEvents);
      }

      events.push(...nextEvents);
      return readSequencedEvents().slice(-nextEvents.length);
    },
    read: async (options: ReadOptions = {}) => readSequencedEvents(options.from),
    query: async (query: Query, options: ReadOptions = {}) => readSequencedEvents(options.from).filter(({event}) => matchesQuery(query, event)),
  };

  const graphStore: AsyncGraphEventStore = {
    append: async (nextEvents, condition?: AppendCondition) => {
      await commandStore.append(Array.isArray(nextEvents) ? nextEvents : [nextEvents], condition);
    },
    readAll: async () => [...events],
    replace: async (nextEvents) => {
      events.splice(0, events.length, ...nextEvents);
    },
    clear: async () => {
      events.splice(0, events.length);
    },
  };

  return {events, graphStore, commandStore};
}

function createModelContext(args: {events?: DomainEvent[]; ids?: string[]} = {}) {
  const stores = createStores(args.events ?? []);
  return {
    ...stores,
    model: createEventSourcedGraphModel({
      store: stores.graphStore,
      commandStore: stores.commandStore,
      ...(args.ids ? {uuidGenerator: createIdGenerator(args.ids)} : {}),
    }),
  };
}

describe('createEventSourcedGraphModel', () => {
  it('loads an empty event store by bootstrapping a default workspace while keeping the renderer graph empty', async () => {
    const {events, model} = createModelContext();

    await model.load();

    expect(events).toEqual([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
    ]);
    expect(model.getSnapshot()).toEqual({nodes: [], edges: [], lanes: [], nodeSchemas: {}, nodeExampleValues: {}});
  });

  it('replays and appends graph events in the default chapter', async () => {
    const {events, model} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
        Events.chapterAdded(defaultProjectId, 'chapter-2', 'Chapter 2'),
        Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'ui', 0, 'Default Chapter Node'),
        Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-2', 'evt', 1, 'Other Chapter Node'),
      ],
      ids: ['generated-node-1'],
    });

    await model.load();
    await model.addNewSlice();

    expect(events).toEqual([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      Events.chapterAdded(defaultProjectId, 'chapter-2', 'Chapter 2'),
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'ui', 0, 'Default Chapter Node'),
      Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-2', 'evt', 1, 'Other Chapter Node'),
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'generated-node-1', 'ui', 0, 'Node 2'),
    ]);
    expect(model.getSnapshot()).toEqual({
      nodes: [
        {id: 'node-1', label: 'Default Chapter Node', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT},
        {id: 'generated-node-1', label: 'Node 2', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT},
      ],
      edges: [],
      lanes: [{id: 'lane-0', order: 0}],
      nodeSchemas: {},
      nodeExampleValues: {},
    });
  });

  it('does not append duplicate default workspace events when the default workspace already exists', async () => {
    const {events, model} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
        Events.projectAdded('project-1', 'Checkout System'),
      ],
    });

    await model.load();

    expect(events).toEqual([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      Events.projectAdded('project-1', 'Checkout System'),
    ]);
  });

  it('appends default workspace bootstrap events only once across overlapping loads', async () => {
    const {events, graphStore, commandStore} = createStores();
    const firstModel = createEventSourcedGraphModel({store: graphStore, commandStore});
    const secondModel = createEventSourcedGraphModel({store: graphStore, commandStore});

    await Promise.all([firstModel.load(), secondModel.load()]);

    expect(events).toEqual([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
    ]);
  });

  it('does not duplicate default bootstrap events across distinct store instances sharing the same backing storage', async () => {
    const sequencedEvents: SequencedEvent<DomainEvent>[] = [];
    const createSharedStores = () => {
      const commandStore: SpecEventStore<DomainEvent> = {
        append: async (nextEvents, condition?: AppendCondition) => {
          const conflictingEvents = condition
            ? sequencedEvents.filter(({position, event}) => {
                if (condition.after !== undefined && position <= condition.after) {
                  return false;
                }
                if (condition.failIfEventsMatch.kind === 'none') {
                  return false;
                }
                if (condition.failIfEventsMatch.kind === 'all') {
                  return true;
                }
                return condition.failIfEventsMatch.items.some((queryItem) => {
                  const matchesType = queryItem.types === undefined || queryItem.types.includes(event.type);
                  const matchesTags = queryItem.tags === undefined || queryItem.tags.every((tag) => event.tags.includes(tag));
                  return matchesType && matchesTags;
                });
              })
            : [];

          if (condition && conflictingEvents.length > 0) {
            throw new AppendConditionFailedError(condition, conflictingEvents);
          }

          const startingPosition = sequencedEvents.length > 0 ? sequencedEvents[sequencedEvents.length - 1].position : 0;
          sequencedEvents.push(
            ...nextEvents.map((event, index) => ({position: startingPosition + index + 1, event})),
          );
          return sequencedEvents.slice(-nextEvents.length);
        },
        read: async (options: ReadOptions = {}) => {
          const from = options.from;
          return from === undefined
            ? [...sequencedEvents]
            : sequencedEvents.filter((sequencedEvent) => sequencedEvent.position > from);
        },
        query: async (query: Query, options: ReadOptions = {}) => {
          const from = options.from;
          const eventsToQuery = from === undefined
            ? sequencedEvents
            : sequencedEvents.filter((sequencedEvent) => sequencedEvent.position > from);
          if (query.kind === 'none') {
            return [];
          }
          if (query.kind === 'all') {
            return eventsToQuery;
          }
          return eventsToQuery.filter(({event}) => query.items.some((queryItem) => {
            const matchesType = queryItem.types === undefined || queryItem.types.includes(event.type);
            const matchesTags = queryItem.tags === undefined || queryItem.tags.every((tag) => event.tags.includes(tag));
            return matchesType && matchesTags;
          }));
        },
      };

      const graphStore: AsyncGraphEventStore = {
        append: async (nextEvents, condition?: AppendCondition) => {
          await commandStore.append(Array.isArray(nextEvents) ? nextEvents : [nextEvents], condition);
        },
        readAll: async () => sequencedEvents.map(({event}) => event),
        replace: async (nextEvents) => {
          sequencedEvents.splice(
            0,
            sequencedEvents.length,
            ...nextEvents.map((event, index) => ({position: index + 1, event})),
          );
        },
        clear: async () => {
          sequencedEvents.splice(0, sequencedEvents.length);
        },
      };

      return {graphStore, commandStore};
    };
    const firstStores = createSharedStores();
    const secondStores = createSharedStores();
    const firstModel = createEventSourcedGraphModel({store: firstStores.graphStore, commandStore: firstStores.commandStore});
    const secondModel = createEventSourcedGraphModel({store: secondStores.graphStore, commandStore: secondStores.commandStore});

    await Promise.all([firstModel.load(), secondModel.load()]);

    expect(sequencedEvents.map(({event}) => event)).toEqual([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
    ]);
  });

  it('appends new graph events in the active project and chapter scope', async () => {
    const {events, model} = createModelContext({
      events: [
        Events.projectAdded('project-1', 'Checkout System'),
        Events.chapterAdded('project-1', 'chapter-1', 'Overview'),
        Events.chapterAdded('project-1', 'chapter-2', 'Cart Flow'),
        Events.projectAdded('project-2', 'Inventory System'),
        Events.chapterAdded('project-2', 'chapter-3', 'Stock Levels'),
        Events.nodeAdded('project-1', 'chapter-1', 'node-1', 'evt', 0, 'Overview Node'),
      ],
      ids: ['generated-node-1'],
    });

    await model.load({projectId: 'project-2', chapterId: 'chapter-3'});
    await model.addNewSlice();

    expect(events[events.length - 1]).toEqual(Events.nodeAdded('project-2', 'chapter-3', 'generated-node-1', 'ui', 0, 'Node 1'));
    expect(model.getScope()).toEqual({projectId: 'project-2', chapterId: 'chapter-3'});
    expect(model.getSnapshot()).toEqual({
      nodes: [{id: 'generated-node-1', label: 'Node 1', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT}],
      edges: [],
      lanes: [{id: 'lane-0', order: 0}],
      nodeSchemas: {},
      nodeExampleValues: {},
    });
  });

  it('adds a chapter to the active project and scopes the model to the new chapter', async () => {
    const {events, model} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
        Events.projectAdded('project-2', 'Inventory System'),
        Events.chapterAdded('project-2', 'chapter-3', 'Stock Levels'),
      ],
      ids: ['generated-chapter-1'],
    });

    await model.load({projectId: defaultProjectId, chapterId: 'default-chapter'});
    await model.addChapter('New Chapter');

    const addedChapterEvent = events[events.length - 1];
    expect(addedChapterEvent).toMatchObject({
      type: 'ChapterAdded',
      payload: {projectId: defaultProjectId, chapterId: 'generated-chapter-1', title: 'New Chapter'},
    });
    expect(model.getWorkspace().chaptersByProjectId[defaultProjectId]).toEqual([
      {id: 'default-chapter', title: 'Chapter 1'},
      {id: 'generated-chapter-1', title: 'New Chapter'},
    ]);
    expect(model.getScope()).toEqual({projectId: defaultProjectId, chapterId: 'generated-chapter-1'});
    expect(model.getSnapshot()).toEqual({nodes: [], edges: [], lanes: [], nodeSchemas: {}, nodeExampleValues: {}});
  });

  it('creates a project with an initial chapter and scopes the model to it', async () => {
    const {events, model} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      ],
      ids: ['generated-project-1', 'generated-chapter-1'],
    });

    await model.load({projectId: defaultProjectId, chapterId: 'default-chapter'});
    await model.addProject('Checkout System');

    expect(events.slice(-2)).toEqual([
      Events.projectAdded('generated-project-1', 'Checkout System'),
      Events.chapterAdded('generated-project-1', 'generated-chapter-1', 'Chapter 1'),
    ]);
    expect(model.getWorkspace()).toEqual({
      projects: [
        {id: defaultProjectId, name: 'Default Project'},
        {id: 'generated-project-1', name: 'Checkout System'},
      ],
      chaptersByProjectId: {
        [defaultProjectId]: [{id: 'default-chapter', title: 'Chapter 1'}],
        'generated-project-1': [{id: 'generated-chapter-1', title: 'Chapter 1'}],
      },
      latestProjectId: 'generated-project-1',
    });
    expect(model.getScope()).toEqual({projectId: 'generated-project-1', chapterId: 'generated-chapter-1'});
    expect(model.getSnapshot()).toEqual({nodes: [], edges: [], lanes: [], nodeSchemas: {}, nodeExampleValues: {}});
  });

  it('records new nodes in the chapter created most recently', async () => {
    const {events, model} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      ],
      ids: ['generated-chapter-1', 'generated-node-1'],
    });

    await model.load({projectId: defaultProjectId, chapterId: 'default-chapter'});
    await model.addChapter('Working Chapter');
    await model.addNewSlice();

    expect(events[events.length - 1]).toMatchObject({
      type: 'NodeAdded',
      payload: {projectId: defaultProjectId, chapterId: 'generated-chapter-1', nodeId: 'generated-node-1', label: 'Node 1'},
    });
    expect(model.getScope()).toEqual({projectId: defaultProjectId, chapterId: 'generated-chapter-1'});
    expect(model.getSnapshot().nodes).toEqual([
      {id: 'generated-node-1', label: 'Node 1', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT},
    ]);
  });

  it('keeps each chapter node visible after switching back and forth between chapters', async () => {
    const {model} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      ],
      ids: ['generated-node-1', 'generated-chapter-1', 'generated-node-2'],
    });

    await model.load({projectId: defaultProjectId, chapterId: 'default-chapter'});
    await model.addNewSlice();
    await model.addChapter('Working Chapter');
    await model.addNewSlice();

    const workingChapterId = model.getScope().chapterId;

    model.setScope({projectId: defaultProjectId, chapterId: 'default-chapter'});
    expect(model.getSnapshot().nodes).toEqual([
      {id: 'generated-node-1', label: 'Node 1', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT},
    ]);

    model.setScope({projectId: defaultProjectId, chapterId: workingChapterId});
    expect(model.getSnapshot().nodes).toEqual([
      {id: 'generated-node-2', label: 'Node 1', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT},
    ]);
  });

  it('persists changed node property schema and examples while skipping unchanged payloads', async () => {
    const {events, model} = createModelContext({
      events: [Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'evt', 0)],
    });
    await model.load();

    const schema = [{propertyId: 'prop-title', name: 'title', type: 'string' as const}];
    const exampleValues = [{propertyId: 'prop-title', scalarValue: 'Hello'}];

    await model.changeNodeSchema({nodeId: 'node-1', schema});
    await model.changeNodeSchema({nodeId: 'node-1', schema});
    await model.changeNodeExampleValues({nodeId: 'node-1', exampleValues});
    await model.changeNodeExampleValues({nodeId: 'node-1', exampleValues});

    expect(events.slice(3)).toEqual([
      Events.nodeSchemaChanged(defaultProjectId, 'node-1', schema),
      Events.nodeExampleValuesChanged(defaultProjectId, 'node-1', exampleValues),
    ]);
    expect(model.getSnapshot().nodeSchemas).toEqual({'node-1': schema});
    expect(model.getSnapshot().nodeExampleValues).toEqual({'node-1': exampleValues});
    await expect(model.changeNodeSchema({nodeId: 'missing-node', schema})).rejects.toThrow('Unknown nodeId missing-node');
  });

  it('records connect, disconnect, delete, rename, and type-change mutations as domain events', async () => {
    const {events, model} = createModelContext({ids: ['generated-node-1', 'generated-node-2']});
    await model.load();
    await model.addNewSlice();
    await model.addNewSlice();

    await model.addConnection('generated-node-1', 'generated-node-2');
    await model.deleteConnection('edge-generated-node-1-generated-node-2');
    await model.renameNode('generated-node-2', 'Renamed node');
    await model.setNodeType('generated-node-2', 'cmd');
    await model.deleteNode('generated-node-1');

    expect(events.map((event) => event.type)).toEqual([
      'ProjectAdded',
      'ChapterAdded',
      'NodeAdded',
      'NodeAdded',
      'NodesConnected',
      'NodesDisconnected',
      'NodeRenamed',
      'NodeTypeChanged',
      'NodeRemoved',
    ]);
    expect(events.slice(4)).toEqual([
      {
        type: 'NodesConnected',
        payload: {projectId: defaultProjectId, sourceNodeId: 'generated-node-1', targetNodeId: 'generated-node-2', role: 'flow'},
        tags: ['projectId:default-project', 'nodeId:generated-node-1', 'nodeId:generated-node-2', 'role:flow', 'connection:generated-node-1->generated-node-2'],
      },
      {
        type: 'NodesDisconnected',
        payload: {projectId: defaultProjectId, sourceNodeId: 'generated-node-1', targetNodeId: 'generated-node-2'},
        tags: ['projectId:default-project', 'nodeId:generated-node-1', 'nodeId:generated-node-2', 'connection:generated-node-1->generated-node-2'],
      },
      {
        type: 'NodeRenamed',
        payload: {projectId: defaultProjectId, nodeId: 'generated-node-2', newName: 'Renamed node'},
        tags: ['projectId:default-project', 'nodeId:generated-node-2'],
      },
      {
        type: 'NodeTypeChanged',
        payload: {projectId: defaultProjectId, nodeId: 'generated-node-2', newType: 'cmd'},
        tags: ['projectId:default-project', 'nodeId:generated-node-2', 'type:cmd'],
      },
      {
        type: 'NodeRemoved',
        payload: {projectId: defaultProjectId, nodeId: 'generated-node-1'},
        tags: ['projectId:default-project', 'nodeId:generated-node-1'],
      },
    ]);
    expect(model.getSnapshot()).toMatchObject({
      nodes: [{id: 'generated-node-2', label: 'Renamed node', type: 'cmd'}],
      edges: [],
      lanes: [{id: 'lane-0', order: 0}],
    });
  });
});
