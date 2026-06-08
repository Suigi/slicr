import {describe, expect, it} from 'vitest';

import {createEventSourcedGraphModel, type AsyncGraphEventStore} from './eventSourcedGraphModel';
import {Events, type DomainEvent} from '../domain/events';
import {AppendConditionFailedError, type AppendCondition, type SequencedEvent} from '@slicr/event-sourcing';
import {NODE_HEIGHT, NODE_WIDTH} from './constants';

const defaultProjectId = 'default-project';

function createStore(events: DomainEvent[] = []): AsyncGraphEventStore {
  return {
    append: async (nextEvents, condition?: AppendCondition) => {
      const eventsToAppend = Array.isArray(nextEvents) ? nextEvents : [nextEvents];
      if (condition) {
        const conflictingEvents = events
          .map((event, index) => ({position: index + 1, event}))
          .filter(({position, event}) => {
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
          });

        if (conflictingEvents.length > 0) {
          throw new AppendConditionFailedError(condition, conflictingEvents);
        }
      }

      events.push(...eventsToAppend);
    },
    readAll: async () => [...events],
    replace: async (nextEvents) => {
      events.splice(0, events.length, ...nextEvents);
    },
    clear: async () => {
      events.splice(0, events.length);
    },
  };
}

describe('createEventSourcedGraphModel', () => {
  it('loads an empty event store by bootstrapping a default workspace while keeping the renderer graph empty', async () => {
    const events: DomainEvent[] = [];
    const model = createEventSourcedGraphModel({store: createStore(events)});

    await model.load();

    expect(events).toEqual([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
    ]);
    expect(model.getSnapshot()).toEqual({nodes: [], edges: [], lanes: [], nodeSchemas: {}, nodeExampleValues: {}});
  });

  it('replays and appends graph events in the default chapter', async () => {
    const events: DomainEvent[] = [
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      Events.chapterAdded(defaultProjectId, 'chapter-2', 'Chapter 2'),
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'ui', 0, 'Default Chapter Node'),
      Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-2', 'evt', 1, 'Other Chapter Node'),
    ];
    const model = createEventSourcedGraphModel({store: createStore(events)});

    await model.load();
    await model.addNewSlice();

    expect(events).toEqual([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      Events.chapterAdded(defaultProjectId, 'chapter-2', 'Chapter 2'),
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'ui', 0, 'Default Chapter Node'),
      Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-2', 'evt', 1, 'Other Chapter Node'),
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-2', 'ui', 0, 'Node 2'),
    ]);
    expect(model.getSnapshot()).toEqual({
      nodes: [
        {id: 'node-1', label: 'Default Chapter Node', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT},
        {id: 'node-2', label: 'Node 2', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT},
      ],
      edges: [],
      lanes: [{id: 'lane-0', order: 0}],
      nodeSchemas: {},
      nodeExampleValues: {},
    });
  });

  it('does not append duplicate default workspace events when the default workspace already exists', async () => {
    const events: DomainEvent[] = [
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      Events.projectAdded('project-1', 'Checkout System'),
    ];
    const model = createEventSourcedGraphModel({store: createStore(events)});

    await model.load();

    expect(events).toEqual([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      Events.projectAdded('project-1', 'Checkout System'),
    ]);
  });

  it('appends default workspace bootstrap events only once across overlapping loads', async () => {
    const events: DomainEvent[] = [];
    const store = createStore(events);
    const firstModel = createEventSourcedGraphModel({store});
    const secondModel = createEventSourcedGraphModel({store});

    await Promise.all([firstModel.load(), secondModel.load()]);

    expect(events).toEqual([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
    ]);
  });

  it('does not duplicate default bootstrap events across distinct store instances sharing the same backing storage', async () => {
    const sequencedEvents: SequencedEvent<DomainEvent>[] = [];
    const createSharedStore = (): AsyncGraphEventStore => ({
      append: async (nextEvents, condition?: AppendCondition) => {
        const appendedEvents = Array.isArray(nextEvents) ? nextEvents : [nextEvents];
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
          ...appendedEvents.map((event, index) => ({position: startingPosition + index + 1, event})),
        );
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
    });
    const firstModel = createEventSourcedGraphModel({store: createSharedStore()});
    const secondModel = createEventSourcedGraphModel({store: createSharedStore()});

    await Promise.all([firstModel.load(), secondModel.load()]);

    expect(sequencedEvents.map(({event}) => event)).toEqual([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
    ]);
  });

  it('appends new graph events in the active project and chapter scope', async () => {
    const events: DomainEvent[] = [
      Events.projectAdded('project-1', 'Checkout System'),
      Events.chapterAdded('project-1', 'chapter-1', 'Overview'),
      Events.chapterAdded('project-1', 'chapter-2', 'Cart Flow'),
      Events.projectAdded('project-2', 'Inventory System'),
      Events.chapterAdded('project-2', 'chapter-3', 'Stock Levels'),
      Events.nodeAdded('project-1', 'chapter-1', 'node-1', 'evt', 0, 'Overview Node'),
    ];
    const model = createEventSourcedGraphModel({store: createStore(events)});

    await model.load({projectId: 'project-2', chapterId: 'chapter-3'});
    await model.addNewSlice();

    expect(events[events.length - 1]).toEqual(Events.nodeAdded('project-2', 'chapter-3', 'node-1', 'ui', 0, 'Node 1'));
    expect(model.getScope()).toEqual({projectId: 'project-2', chapterId: 'chapter-3'});
    expect(model.getSnapshot()).toEqual({
      nodes: [{id: 'node-1', label: 'Node 1', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT}],
      edges: [],
      lanes: [{id: 'lane-0', order: 0}],
      nodeSchemas: {},
      nodeExampleValues: {},
    });
  });

  it('persists changed node property schema and examples while skipping unchanged payloads', async () => {
    const events: DomainEvent[] = [Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'evt', 0)];
    const model = createEventSourcedGraphModel({store: createStore(events)});
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
    const events: DomainEvent[] = [];
    const model = createEventSourcedGraphModel({store: createStore(events)});
    await model.load();
    await model.addNewSlice();
    await model.addNewSlice();

    await model.addConnection('node-1', 'node-2');
    await model.deleteConnection('edge-node-1-node-2');
    await model.renameNode('node-2', 'Renamed node');
    await model.setNodeType('node-2', 'cmd');
    await model.deleteNode('node-1');

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
        payload: {projectId: defaultProjectId, sourceNodeId: 'node-1', targetNodeId: 'node-2', role: 'flow'},
        tags: ['projectId:default-project', 'nodeId:node-1', 'nodeId:node-2', 'role:flow', 'connection:node-1->node-2'],
      },
      {
        type: 'NodesDisconnected',
        payload: {projectId: defaultProjectId, sourceNodeId: 'node-1', targetNodeId: 'node-2'},
        tags: ['projectId:default-project', 'nodeId:node-1', 'nodeId:node-2', 'connection:node-1->node-2'],
      },
      {
        type: 'NodeRenamed',
        payload: {projectId: defaultProjectId, nodeId: 'node-2', newName: 'Renamed node'},
        tags: ['projectId:default-project', 'nodeId:node-2'],
      },
      {
        type: 'NodeTypeChanged',
        payload: {projectId: defaultProjectId, nodeId: 'node-2', newType: 'cmd'},
        tags: ['projectId:default-project', 'nodeId:node-2', 'type:cmd'],
      },
      {
        type: 'NodeRemoved',
        payload: {projectId: defaultProjectId, nodeId: 'node-1'},
        tags: ['projectId:default-project', 'nodeId:node-1'],
      },
    ]);
    expect(model.getSnapshot()).toMatchObject({
      nodes: [{id: 'node-2', label: 'Renamed node', type: 'cmd'}],
      edges: [],
      lanes: [{id: 'lane-0', order: 0}],
    });
  });
});
