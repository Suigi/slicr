import {describe, expect, it} from 'vitest';

import {createEventSourcedGraphModel, type AsyncGraphEventStore} from './eventSourcedGraphModel';
import type {DomainEvent} from '../domain/events';
import {NODE_HEIGHT, NODE_WIDTH} from './constants';

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
  it('loads an empty event store as an empty renderer graph', async () => {
    const model = createEventSourcedGraphModel({store: createStore()});

    await model.load();

    expect(model.getSnapshot()).toEqual({nodes: [], edges: [], lanes: []});
  });

  it('appends a node event and reprojects the renderer graph', async () => {
    const events: DomainEvent[] = [];
    const model = createEventSourcedGraphModel({store: createStore(events)});
    await model.load();

    await model.addNewSlice();

    expect(events).toEqual([
      {
        type: 'NodeAdded',
        payload: {nodeId: 'node-1', type: 'ui', laneId: 0, label: 'Node 1'},
        tags: ['nodeId:node-1', 'type:ui'],
      },
    ]);
    expect(model.getSnapshot()).toEqual({
      nodes: [{id: 'node-1', label: 'Node 1', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT}],
      edges: [],
      lanes: [{id: 'lane-0', order: 0}],
    });
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
      'NodeAdded',
      'NodeAdded',
      'NodesConnected',
      'NodesDisconnected',
      'NodeRenamed',
      'NodeTypeChanged',
      'NodeRemoved',
    ]);
    expect(events.slice(2)).toEqual([
      {
        type: 'NodesConnected',
        payload: {sourceNodeId: 'node-1', targetNodeId: 'node-2', role: 'flow'},
        tags: ['nodeId:node-1', 'nodeId:node-2', 'role:flow'],
      },
      {
        type: 'NodesDisconnected',
        payload: {sourceNodeId: 'node-1', targetNodeId: 'node-2'},
        tags: ['nodeId:node-1', 'nodeId:node-2', 'connection:node-1->node-2'],
      },
      {
        type: 'NodeRenamed',
        payload: {nodeId: 'node-2', newName: 'Renamed node'},
        tags: ['nodeId:node-2'],
      },
      {
        type: 'NodeTypeChanged',
        payload: {nodeId: 'node-2', newType: 'cmd'},
        tags: ['nodeId:node-2', 'type:cmd'],
      },
      {
        type: 'NodeRemoved',
        payload: {nodeId: 'node-1'},
        tags: ['nodeId:node-1'],
      },
    ]);
    expect(model.getSnapshot()).toMatchObject({
      nodes: [{id: 'node-2', label: 'Renamed node', type: 'cmd'}],
      edges: [],
      lanes: [{id: 'lane-0', order: 0}],
    });
  });
});
