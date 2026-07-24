import {describe, expect, it, vi} from 'vitest';

import {createEventSourcedGraphModel} from './eventSourcedGraphModel';
import {Events} from '../domain/events';
import {
  type AppendCondition,
  AppendConditionFailedError,
  type DcbAnyCommand,
  type DcbEvent,
  MemoryStore,
  Query,
  type ReadOptions,
  type SequencedEvent,
  type SpecEventStore,
} from '../domain/eventSourcing';
import {NODE_HEIGHT, NODE_WIDTH} from './constants';
import {createGraphProjectionService} from '../application/graphProjectionService';

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

function matchesQuery(query: Query, event: DcbEvent) {
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
}

function createStores(initialEvents: DcbEvent[] = []): {
  events: DcbEvent[];
  commandStore: SpecEventStore<DcbEvent>;
} {
  const events = [...initialEvents];
  const subscriptions = new Set<{query: Query; listener: (events: readonly SequencedEvent<DcbEvent>[]) => void | Promise<void>}>();

  const readSequencedEvents = (from?: number) => {
    const sequencedEvents = events.map((event, index) => ({position: index + 1, event}));
    return from === undefined ? sequencedEvents : sequencedEvents.filter((sequencedEvent) => sequencedEvent.position > from);
  };

  const notifySubscribers = async (appendedEvents: readonly SequencedEvent<DcbEvent>[]) => {
    await Promise.allSettled(
      [...subscriptions].map(async ({query, listener}) => {
        const matchingEvents = appendedEvents.filter(({event}) => matchesQuery(query, event));
        if (matchingEvents.length > 0) {
          await listener(matchingEvents);
        }
      }),
    );
  };

  const commandStore: SpecEventStore<DcbEvent> = {
    append: async (nextEvents, condition?: AppendCondition) => {
      const conflictingEvents =
        condition === undefined
          ? []
          : readSequencedEvents(condition.after).filter(({event}) => matchesQuery(condition.failIfEventsMatch, event));

      if (condition !== undefined && conflictingEvents.length > 0) {
        throw new AppendConditionFailedError(condition, conflictingEvents);
      }

      const startingPosition = events.length > 0 ? events.length : 0;
      const appendedEvents = nextEvents.map((event, index) => ({position: startingPosition + index + 1, event}));
      events.push(...nextEvents);
      await notifySubscribers(appendedEvents);
      return appendedEvents;
    },
    read: async (options: ReadOptions = {}) => readSequencedEvents(options.from),
    query: async (query: Query, options: ReadOptions = {}) =>
      readSequencedEvents(options.from).filter(({event}) => matchesQuery(query, event)),
    subscribe: (query, listener) => {
      const subscription = {query, listener};
      subscriptions.add(subscription);
      return {unsubscribe: () => subscriptions.delete(subscription)};
    },
  };

  return {events, commandStore};
}

function createModelContext(args: {events?: DcbEvent[]; ids?: string[]} = {}) {
  const stores = createStores(args.events ?? []);
  return {
    ...stores,
    model: createEventSourcedGraphModel({
      commandStore: stores.commandStore,
      ...(args.ids ? {uuidGenerator: createIdGenerator(args.ids)} : {}),
    }),
  };
}

describe('createEventSourcedGraphModel', () => {
  it('can use an externally provided command executor', async () => {
    const executedCommands: DcbAnyCommand[] = [];
    const {commandStore} = createStores([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
    ]);
    const model = createEventSourcedGraphModel({
      commandStore,
      executeCommand: async (command) => {
        executedCommands.push(command);
      },
      uuidGenerator: () => 'generated-node-1',
    });

    await model.load({projectId: defaultProjectId, chapterId: 'default-chapter'});
    await model.addNewSlice();

    expect(executedCommands).toEqual([
      {
        type: 'AddNode',
        data: {
          projectId: defaultProjectId,
          chapterId: 'default-chapter',
          nodeType: 'ui',
          label: 'Node 1',
          laneId: 0,
        },
      },
    ]);
  });

  it('can use an externally created projection service', async () => {
    const {commandStore} = createStores([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'ui', 0, 'Projected Node'),
    ]);
    const projectionService = createGraphProjectionService({commandStore});
    const model = createEventSourcedGraphModel({
      commandStore,
      projectionService,
    });

    await model.load({projectId: defaultProjectId, chapterId: 'default-chapter'});

    expect(model.getSnapshot().nodes.map((node) => node.label)).toEqual(['Projected Node']);
  });

  it('loads an empty event store without bootstrapping while keeping the renderer graph empty', async () => {
    const {events, model} = createModelContext();

    await model.load();

    expect(events).toEqual([]);
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

  it('observes direct matching appends through subscriptions without reloading', async () => {
    const {commandStore, model} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      ],
    });

    await model.load({projectId: defaultProjectId, chapterId: 'default-chapter'});
    await commandStore.append([Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'ui', 0, 'Projected Later')]);

    expect(model.getSnapshot().nodes).toEqual([
      {id: 'node-1', label: 'Projected Later', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT},
    ]);
    expect(model.getScope()).toEqual({projectId: defaultProjectId, chapterId: 'default-chapter'});
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

  it('does not append bootstrap events across overlapping loads', async () => {
    const {events, commandStore} = createStores();
    const firstModel = createEventSourcedGraphModel({commandStore});
    const secondModel = createEventSourcedGraphModel({commandStore});

    await Promise.all([firstModel.load(), secondModel.load()]);

    expect(events).toEqual([]);
  });

  it('does not append bootstrap events across distinct store instances sharing the same backing storage', async () => {
    const sequencedEvents: SequencedEvent<DcbEvent>[] = [];
    const createSharedStores = () => {
      const subscriptions = new Set<{query: Query; listener: (events: readonly SequencedEvent<DcbEvent>[]) => void | Promise<void>}>();
      const commandStore: SpecEventStore<DcbEvent> = {
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
          const appendedEvents = nextEvents.map((event, index) => ({position: startingPosition + index + 1, event}));
          sequencedEvents.push(...appendedEvents);
          await Promise.allSettled(
            [...subscriptions].map(async ({query, listener}) => {
              const matchingEvents = appendedEvents.filter(({event}) => matchesQuery(query, event));
              if (matchingEvents.length > 0) {
                await listener(matchingEvents);
              }
            }),
          );
          return appendedEvents;
        },
        read: async (options: ReadOptions = {}) => {
          const from = options.from;
          return from === undefined ? [...sequencedEvents] : sequencedEvents.filter((sequencedEvent) => sequencedEvent.position > from);
        },
        query: async (query: Query, options: ReadOptions = {}) => {
          const from = options.from;
          const eventsToQuery =
            from === undefined ? sequencedEvents : sequencedEvents.filter((sequencedEvent) => sequencedEvent.position > from);
          if (query.kind === 'none') {
            return [];
          }
          if (query.kind === 'all') {
            return eventsToQuery;
          }
          return eventsToQuery.filter(({event}) => matchesQuery(query, event));
        },
        subscribe: (query, listener) => {
          const subscription = {query, listener};
          subscriptions.add(subscription);
          return {unsubscribe: () => subscriptions.delete(subscription)};
        },
      };

      return {commandStore};
    };
    const firstStores = createSharedStores();
    const secondStores = createSharedStores();
    const firstModel = createEventSourcedGraphModel({commandStore: firstStores.commandStore});
    const secondModel = createEventSourcedGraphModel({commandStore: secondStores.commandStore});

    await Promise.all([firstModel.load(), secondModel.load()]);

    expect(sequencedEvents.map(({event}) => event)).toEqual([]);
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

  it('renames a project through the command router and refreshes the workspace', async () => {
    const {events, model} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
        Events.projectAdded('project-2', 'Inventory System'),
        Events.chapterAdded('project-2', 'chapter-2', 'Stock Levels'),
      ],
    });

    await model.load({projectId: 'project-2', chapterId: 'chapter-2'});
    await model.renameProject('project-2', 'Inventory Platform');

    expect(events[events.length - 1]).toEqual(Events.projectRenamed('project-2', 'Inventory Platform'));
    expect(model.getWorkspace().projects).toEqual([
      {id: defaultProjectId, name: 'Default Project'},
      {id: 'project-2', name: 'Inventory Platform'},
    ]);
    expect(model.getScope()).toEqual({projectId: 'project-2', chapterId: 'chapter-2'});
  });

  it('refreshes projections after project commands', async () => {
    const {model} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
        Events.projectAdded('project-2', 'Inventory System'),
        Events.chapterAdded('project-2', 'chapter-2', 'Stock Levels'),
      ],
      ids: ['generated-project-1', 'generated-chapter-1'],
    });

    await model.load({projectId: 'project-2', chapterId: 'chapter-2'});
    expect(model.getWorkspace().projects).toContainEqual({id: 'project-2', name: 'Inventory System'});

    await model.addProject('Checkout System');
    expect(model.getScope()).toEqual({projectId: 'generated-project-1', chapterId: 'generated-chapter-1'});

    await model.renameProject('project-2', 'Inventory Platform');
    expect(model.getWorkspace().projects).toContainEqual({id: 'project-2', name: 'Inventory Platform'});
  });

  it('refreshes the projection from the command store after adding a connection', async () => {
    const {model, commandStore} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
        Events.nodeAdded(defaultProjectId, 'default-chapter', 'source-node', 'ui', 0, 'Source'),
        Events.nodeAdded(defaultProjectId, 'default-chapter', 'target-node', 'ui', 0, 'Target'),
      ],
    });
    let readCalls = 0;
    const originalRead = commandStore.read.bind(commandStore);
    commandStore.read = async (options = {}) => {
      readCalls += 1;
      return originalRead(options);
    };

    await model.load();
    await model.addConnection('source-node', 'target-node');

    expect(readCalls).toBe(0);
    expect(model.getSnapshot().edges).toEqual([
      {
        id: 'edge-source-node-target-node',
        sourceId: 'source-node',
        targetId: 'target-node',
        role: 'flow',
      },
    ]);
  });

  it('refreshes the projection from the command store after deleting a connection', async () => {
    const {model, commandStore} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
        Events.nodeAdded(defaultProjectId, 'default-chapter', 'source-node', 'ui', 0, 'Source'),
        Events.nodeAdded(defaultProjectId, 'default-chapter', 'target-node', 'ui', 0, 'Target'),
        Events.nodesConnected(defaultProjectId, 'source-node', 'target-node'),
      ],
    });
    let readCalls = 0;
    const originalRead = commandStore.read.bind(commandStore);
    commandStore.read = async (options = {}) => {
      readCalls += 1;
      return originalRead(options);
    };

    await model.load();
    await model.deleteConnection('edge-source-node-target-node');

    expect(readCalls).toBe(0);
    expect(model.getSnapshot().edges).toEqual([]);
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

  it('refreshes from the command store when switching scope', async () => {
    const {commandStore, model} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
        Events.chapterAdded(defaultProjectId, 'chapter-2', 'Chapter 2'),
      ],
    });

    await model.load({projectId: defaultProjectId, chapterId: 'default-chapter'});
    await commandStore.append([Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-added-after-load', 'evt', 1, 'Fresh Event')]);

    const graph = await model.setScope({projectId: defaultProjectId, chapterId: 'chapter-2'});

    expect(graph.nodes.map((node) => node.id)).toEqual(['node-added-after-load']);
    expect(model.getSnapshot().nodes.map((node) => node.id)).toEqual(['node-added-after-load']);
  });

  it('loads and scopes without constructing a temporary projection MemoryStore', async () => {
    const memoryStoreCreateSpy = vi.spyOn(MemoryStore, 'create').mockImplementation(() => {
      throw new Error('projection MemoryStore should not be created');
    });
    const {model} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
        Events.chapterAdded(defaultProjectId, 'chapter-2', 'Chapter 2'),
        Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'ui', 0, 'Default Chapter Node'),
        Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-2', 'evt', 1, 'Other Chapter Node'),
      ],
    });

    try {
      await expect(model.load({projectId: defaultProjectId, chapterId: 'default-chapter'})).resolves.toEqual({
        nodes: [{id: 'node-1', label: 'Default Chapter Node', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT}],
        edges: [],
        lanes: [{id: 'lane-0', order: 0}],
        nodeSchemas: {},
        nodeExampleValues: {},
      });
      await expect(model.setScope({projectId: defaultProjectId, chapterId: 'chapter-2'})).resolves.toEqual({
        nodes: [{id: 'node-2', label: 'Other Chapter Node', type: 'evt', laneId: 'lane-1', width: NODE_WIDTH, height: NODE_HEIGHT}],
        edges: [],
        lanes: [{id: 'lane-1', order: 1}],
        nodeSchemas: {},
        nodeExampleValues: {},
      });
      expect(memoryStoreCreateSpy).not.toHaveBeenCalled();
    } finally {
      memoryStoreCreateSpy.mockRestore();
    }
  });

  it('does not read the command store directly when hydrating or mutating through the facade', async () => {
    const {model, commandStore} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
        Events.chapterAdded(defaultProjectId, 'chapter-2', 'Chapter 2'),
      ],
      ids: ['generated-node-1'],
    });
    let readCalls = 0;
    const originalRead = commandStore.read.bind(commandStore);
    commandStore.read = async (options = {}) => {
      readCalls += 1;
      return originalRead(options);
    };

    await model.load({projectId: defaultProjectId, chapterId: 'default-chapter'});
    await model.setScope({projectId: defaultProjectId, chapterId: 'chapter-2'});
    await model.addNewSlice();

    expect(readCalls).toBe(0);
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

    await model.setScope({projectId: defaultProjectId, chapterId: 'default-chapter'});
    expect(model.getSnapshot().nodes).toEqual([
      {id: 'generated-node-1', label: 'Node 1', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT},
    ]);

    await model.setScope({projectId: defaultProjectId, chapterId: workingChapterId});
    expect(model.getSnapshot().nodes).toEqual([
      {id: 'generated-node-2', label: 'Node 1', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT},
    ]);
  });

  it('persists changed node property schema and examples while skipping unchanged payloads', async () => {
    const {events, model} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
        Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'evt', 0),
      ],
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
    const {events, model} = createModelContext({
      events: [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      ],
      ids: ['generated-node-1', 'generated-node-2'],
    });
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
        tags: [
          'projectId:default-project',
          'nodeId:generated-node-1',
          'nodeId:generated-node-2',
          'role:flow',
          'connection:generated-node-1->generated-node-2',
        ],
      },
      {
        type: 'NodesDisconnected',
        payload: {projectId: defaultProjectId, sourceNodeId: 'generated-node-1', targetNodeId: 'generated-node-2'},
        tags: [
          'projectId:default-project',
          'nodeId:generated-node-1',
          'nodeId:generated-node-2',
          'connection:generated-node-1->generated-node-2',
        ],
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
