import {describe, expect, it} from 'vitest';

import {createEventSourcedGraphModel, type AsyncGraphEventStore} from './eventSourcedGraphModel';
import {Events, type DomainEvent} from '../domain/events';
import {NODE_HEIGHT, NODE_WIDTH} from './constants';

const defaultProjectId = 'default-project';

function createStore(events: DomainEvent[] = []): AsyncGraphEventStore {
  return {
    append: async (nextEvents) => {
      events.push(...(Array.isArray(nextEvents) ? nextEvents : [nextEvents]));
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

  it('appends default-project scoped node events and reprojects the default project renderer graph', async () => {
    const events: DomainEvent[] = [];
    const model = createEventSourcedGraphModel({store: createStore(events)});
    await model.load();

    await model.addNewSlice();

    expect(events).toEqual([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      {
        type: 'NodeAdded',
        payload: {projectId: defaultProjectId, nodeId: 'node-1', type: 'ui', laneId: 0, label: 'Node 1'},
        tags: ['projectId:default-project', 'nodeId:node-1', 'type:ui'],
      },
    ]);
    expect(model.getSnapshot()).toEqual({
      nodes: [{id: 'node-1', label: 'Node 1', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT}],
      edges: [],
      lanes: [{id: 'lane-0', order: 0}],
      nodeSchemas: {},
      nodeExampleValues: {},
    });
  });

  it('does not append default workspace events when the store is already non-empty', async () => {
    const events: DomainEvent[] = [Events.projectAdded('project-1', 'Checkout System')];
    const model = createEventSourcedGraphModel({store: createStore(events)});

    await model.load();

    expect(events).toEqual([Events.projectAdded('project-1', 'Checkout System')]);
  });

  it('persists changed node property schema and examples while skipping unchanged payloads', async () => {
    const events: DomainEvent[] = [Events.nodeAdded(defaultProjectId, 'node-1', 'evt', 0)];
    const model = createEventSourcedGraphModel({store: createStore(events)});
    await model.load();

    const schema = [{propertyId: 'prop-title', name: 'title', type: 'string' as const}];
    const exampleValues = [{propertyId: 'prop-title', scalarValue: 'Hello'}];

    await model.changeNodeSchema({nodeId: 'node-1', schema});
    await model.changeNodeSchema({nodeId: 'node-1', schema});
    await model.changeNodeExampleValues({nodeId: 'node-1', exampleValues});
    await model.changeNodeExampleValues({nodeId: 'node-1', exampleValues});

    expect(events.slice(1)).toEqual([
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
