import {v4 as uuid} from 'uuid';

import {describe, expect, it} from 'vitest';
import {MemoryStore} from '@slicr/event-sourcing';
import {DomainEvent, Events} from '../events';
import {GraphProjector} from './graphProjector';

const projectId = 'project-1';

describe('events project state', () => {
  it('empty store projects to empty model graph', () => {
    const store = MemoryStore.create<DomainEvent>();
    const projector = GraphProjector.create({store});
    const nodeId = uuid();
    store.append(Events.nodeAdded(projectId, nodeId, 'cmd', 1, 'Command'));

    const model = projector.project(projectId);

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
      Events.nodeAdded(projectId, commandId, 'cmd', 1, 'Command'),
      Events.nodeAdded(projectId, eventId, 'evt', 2, 'Event')
    ]);

    const model = projector.project(projectId);

    expect(model.nodes)
      .toMatchObject([
        {nodeType: 'cmd', laneId: 1, label: 'Command'},
        {nodeType: 'evt', laneId: 2, label: 'Event'}
      ]);
    expect(model.edges)
      .toEqual([]);
  });

  it('projects only the requested project graph events', () => {
    const store = MemoryStore.create<DomainEvent>();
    const projector = GraphProjector.create({store});
    store.append([
      Events.nodeAdded('project-1', 'shared-node', 'cmd', 0, 'Command'),
      Events.nodeAdded('project-1', 'project-1-event', 'evt', 1, 'Event'),
      Events.nodesConnected('project-1', 'shared-node', 'project-1-event', 'flow'),
      Events.nodeAdded('project-2', 'shared-node', 'dm', 9, 'Other Project Node'),
      Events.nodeAdded('project-2', 'project-2-event', 'evt', 9, 'Other Project Event'),
      Events.nodesConnected('project-2', 'shared-node', 'project-2-event', 'back-reference'),
      Events.nodeRenamed('project-2', 'shared-node', 'Renamed Elsewhere'),
    ]);

    const model = projector.project('project-1');

    expect(model.nodes).toEqual([
      {nodeId: 'shared-node', nodeType: 'cmd', laneId: 0, label: 'Command'},
      {nodeId: 'project-1-event', nodeType: 'evt', laneId: 1, label: 'Event'},
    ]);
    expect(model.edges)
      .toEqual([{sourceNodeId: 'shared-node', targetNodeId: 'project-1-event', role: 'flow'}]);
  });

  it('lanes are generated based on the node laneId', () => {
    const store = MemoryStore.create<DomainEvent>();
    const projector = GraphProjector.create({store});
    const commandId = uuid();
    const eventId = uuid();
    store.append([
      Events.nodeAdded(projectId, commandId, 'cmd', 0),
      Events.nodeAdded(projectId, eventId, 'evt', 1),
    ]);

    const model = projector.project(projectId);

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
      Events.nodeAdded(projectId, commandId, 'cmd', 0, 'Command'),
      Events.nodeRenamed(projectId, commandId, 'Renamed Command'),
    ]);

    const model = projector.project(projectId);

    expect(model.nodes[0].label)
      .toEqual('Renamed Command');
  });

  it('projects node property schema and examples independently', () => {
    const store = MemoryStore.create<DomainEvent>();
    const projector = GraphProjector.create({store});

    store.append([
      Events.nodeAdded(projectId, 'kept-node', 'dm', 0, 'Kept'),
      Events.nodeAdded(projectId, 'removed-node', 'dm', 0, 'Removed'),
      Events.nodeSchemaChanged(projectId, 'kept-node', [
        {propertyId: 'old-title', name: 'oldTitle', type: 'string'},
      ]),
      Events.nodeExampleValuesChanged(projectId, 'kept-node', [
        {propertyId: 'prop-title', scalarValue: 'Checkout started'},
      ]),
      Events.nodeSchemaChanged(projectId, 'kept-node', [
        {propertyId: 'prop-title', name: 'title', type: 'string', optional: true},
        {propertyId: 'prop-lines', name: 'lines', type: 'Object', list: true},
      ]),
      Events.nodeExampleValuesChanged(projectId, 'removed-node', [
        {propertyId: 'removed-prop', scalarValue: 'discard me'},
      ]),
      Events.nodeSchemaChanged(projectId, 'removed-node', [
        {propertyId: 'removed-prop', name: 'removed', type: 'string'},
      ]),
      Events.nodeRemoved(projectId, 'removed-node'),
    ]);

    const model = projector.project(projectId);

    expect(model.nodeSchemas).toEqual({
      'kept-node': [
        {propertyId: 'prop-title', name: 'title', type: 'string', optional: true},
        {propertyId: 'prop-lines', name: 'lines', type: 'Object', list: true},
      ],
    });
    expect(model.nodeExampleValues).toEqual({
      'kept-node': [
        {propertyId: 'prop-title', scalarValue: 'Checkout started'},
      ],
    });
    expect(model.nodes).toEqual([
      {nodeId: 'kept-node', nodeType: 'dm', laneId: 0, label: 'Kept'},
    ]);
  });

  it('replays the complete graph event stream deterministically', () => {
    const emptyStore = MemoryStore.create<DomainEvent>();
    expect(GraphProjector.create({store: emptyStore}).project(projectId))
      .toEqual({nodes: [], edges: [], lanes: [], nodeSchemas: {}, nodeExampleValues: {}});

    const store = MemoryStore.create<DomainEvent>();
    const projector = GraphProjector.create({store});
    const removedId = uuid();
    const commandId = uuid();
    const eventId = uuid();
    const dataModelId = uuid();
    const missingId = uuid();
    store.append([
      Events.nodeAdded(projectId, removedId, 'ui', 9, 'Removed'),
      Events.nodeAdded(projectId, commandId, 'cmd', 3, 'Command'),
      Events.nodeAdded(projectId, eventId, 'evt', 1, 'Event'),
      Events.nodeAdded(projectId, dataModelId, 'dm', 3, 'Data'),
      Events.nodesConnected(projectId, removedId, commandId, 'flow'),
      Events.nodesConnected(projectId, commandId, eventId, 'flow'),
      Events.nodesConnected(projectId, eventId, dataModelId, 'back-reference'),
      Events.nodesConnected(projectId, commandId, missingId, 'flow'),
      Events.nodeTypeChanged(projectId, commandId, 'processor'),
      Events.nodeTypeChanged(projectId, missingId, 'rm'),
      Events.nodesDisconnected(projectId, commandId, eventId),
      Events.nodesDisconnected(projectId, missingId, eventId),
      Events.nodeRemoved(projectId, removedId),
      Events.nodeRemoved(projectId, missingId),
      Events.nodeRenamed(projectId, missingId, 'Missing'),
    ]);

    const model = projector.project(projectId);

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
