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
});

