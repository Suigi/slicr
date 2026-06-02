import {v4 as uuid} from 'uuid';

import {describe, expect, it} from 'vitest';
import {MemoryStore} from '@slicr/event-sourcing';
import {DomainEvent, Events} from '../events';
import {GraphProjector} from './graphProjector';

describe('events project state', () => {
  it('empty store projects to empty model graph', () => {
    const store = MemoryStore.create<DomainEvent>();
    const projector = GraphProjector.create({store});
    const nodeId = uuid();
    store.append(Events.nodeAdded(nodeId, 'cmd', 1, 'Command'));

    const model = projector.project();

    expect(model.nodes)
      .toEqual([{
        nodeId,
        nodeType: 'cmd',
        laneId: 1,
        label: 'Command',
      }]);
  });

  it('disconnected nodes project to nodes but not edges', () => {
    const store = MemoryStore.create<DomainEvent>();
    const projector = GraphProjector.create({store});
    const commandId = uuid();
    const eventId = uuid();
    store.append([
      Events.nodeAdded(commandId, 'cmd', 1, 'Command'),
      Events.nodeAdded(eventId, 'evt', 2, 'Event')
    ]);

    const model = projector.project();

    expect(model.nodes)
      .toMatchObject([
        {nodeType: 'cmd', laneId: 1, label: 'Command'},
        {nodeType: 'evt', laneId: 2, label: 'Event'}
      ]);
    expect(model.edges)
      .toEqual([]);
  });

  it('connected nodes project to an edge', () => {
    const store = MemoryStore.create<DomainEvent>();
    const projector = GraphProjector.create({store});
    const commandId = uuid();
    const eventId = uuid();
    store.append([
      Events.nodeAdded(commandId, 'cmd', 0),
      Events.nodeAdded(eventId, 'evt', 0),
      Events.nodesConnected(commandId, eventId, 'flow')
    ]);

    const model = projector.project();

    expect(model.edges)
      .toEqual([{sourceNodeId: commandId, targetNodeId: eventId, role: 'flow'}]);
  });

  it('lanes are generated based on the node laneId', () => {
    const store = MemoryStore.create<DomainEvent>();
    const projector = GraphProjector.create({store});
    const commandId = uuid();
    const eventId = uuid();
    store.append([
      Events.nodeAdded(commandId, 'cmd', 0),
      Events.nodeAdded(eventId, 'evt', 1),
    ]);

    const model = projector.project();

    expect(model.lanes)
      .toEqual([
        {id: 'lane-0', order: 0,},
        {id: 'lane-1', order: 1,},
      ]);
  });

  it('renamed nodes receive new label', () => {
    const store = MemoryStore.create<DomainEvent>();
    const projector = GraphProjector.create({store});
    const commandId = uuid();
    store.append([
      Events.nodeAdded(commandId, 'cmd', 0, 'Command'),
      Events.nodeRenamed(commandId, 'Renamed Command'),
    ]);

    const model = projector.project();

    expect(model.nodes[0].label)
      .toEqual('Renamed Command');
  });

  it('replays the complete graph event stream deterministically', () => {
    const emptyStore = MemoryStore.create<DomainEvent>();
    expect(GraphProjector.create({store: emptyStore}).project())
      .toEqual({nodes: [], edges: [], lanes: []});

    const store = MemoryStore.create<DomainEvent>();
    const projector = GraphProjector.create({store});
    const removedId = uuid();
    const commandId = uuid();
    const eventId = uuid();
    const dataModelId = uuid();
    const missingId = uuid();
    store.append([
      Events.nodeAdded(removedId, 'ui', 9, 'Removed'),
      Events.nodeAdded(commandId, 'cmd', 3, 'Command'),
      Events.nodeAdded(eventId, 'evt', 1, 'Event'),
      Events.nodeAdded(dataModelId, 'dm', 3, 'Data'),
      Events.nodesConnected(removedId, commandId, 'flow'),
      Events.nodesConnected(commandId, eventId, 'flow'),
      Events.nodesConnected(eventId, dataModelId, 'back-reference'),
      Events.nodesConnected(commandId, missingId, 'flow'),
      Events.nodeTypeChanged(commandId, 'processor'),
      Events.nodeTypeChanged(missingId, 'rm'),
      Events.nodesDisconnected(commandId, eventId),
      Events.nodesDisconnected(missingId, eventId),
      Events.nodeRemoved(removedId),
      Events.nodeRemoved(missingId),
      Events.nodeRenamed(missingId, 'Missing'),
    ]);

    const model = projector.project();

    expect(model.nodes)
      .toEqual([
        {nodeId: commandId, nodeType: 'processor', laneId: 3, label: 'Command'},
        {nodeId: eventId, nodeType: 'evt', laneId: 1, label: 'Event'},
        {nodeId: dataModelId, nodeType: 'dm', laneId: 3, label: 'Data'},
      ]);
    expect(model.edges)
      .toEqual([
        {sourceNodeId: eventId, targetNodeId: dataModelId, role: 'back-reference'},
      ]);
    expect(model.lanes)
      .toEqual([
        {id: 'lane-1', order: 1},
        {id: 'lane-3', order: 3},
      ]);
  });
});

