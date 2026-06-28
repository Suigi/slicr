import {v4 as uuid} from 'uuid';

import {describe, expect, it} from 'vitest';
import {MemoryStore} from '../eventSourcing';
import {DcbEvent, Events} from '../events';
import {GraphProjector, projectGraph} from './graphProjector';

const projectId = 'project-1';

describe('events project state', () => {
  it('empty store projects to empty model graph', () => {
    const store = MemoryStore.create<DcbEvent>();
    const projector = GraphProjector.create({store});
    const nodeId = uuid();
    store.append(Events.nodeAdded(projectId, 'chapter-1', nodeId, 'cmd', 1, 'Command'));

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
    const store = MemoryStore.create<DcbEvent>();
    const projector = GraphProjector.create({store});
    const commandId = uuid();
    const eventId = uuid();
    store.append([
      Events.nodeAdded(projectId, 'chapter-1', commandId, 'cmd', 1, 'Command'),
      Events.nodeAdded(projectId, 'chapter-1', eventId, 'evt', 2, 'Event')
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
    const store = MemoryStore.create<DcbEvent>();
    const projector = GraphProjector.create({store});
    store.append([
      Events.nodeAdded('project-1', 'chapter-1', 'shared-node', 'cmd', 0, 'Command'),
      Events.nodeAdded('project-1', 'chapter-1', 'project-1-event', 'evt', 1, 'Event'),
      Events.nodesConnected('project-1', 'shared-node', 'project-1-event', 'flow'),
      Events.nodeAdded('project-2', 'chapter-1', 'shared-node', 'dm', 9, 'Other Project Node'),
      Events.nodeAdded('project-2', 'chapter-1', 'project-2-event', 'evt', 9, 'Other Project Event'),
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

  it('projects only nodes in the requested chapter', () => {
    const store = MemoryStore.create<DcbEvent>();
    const projector = GraphProjector.create({store});
    store.append([
      {
        type: 'NodeAdded',
        payload: {projectId, chapterId: 'chapter-1', nodeId: 'chapter-1-node', type: 'cmd', laneId: 0, label: 'Chapter 1 Node'},
        tags: ['projectId:project-1', 'nodeId:chapter-1-node', 'type:cmd'],
      },
      {
        type: 'NodeAdded',
        payload: {projectId, chapterId: 'chapter-2', nodeId: 'chapter-2-node', type: 'evt', laneId: 1, label: 'Chapter 2 Node'},
        tags: ['projectId:project-1', 'nodeId:chapter-2-node', 'type:evt'],
      },
    ] as DcbEvent[]);

    const model = projector.project(projectId, 'chapter-1');

    expect(model.nodes).toEqual([
      {nodeId: 'chapter-1-node', nodeType: 'cmd', laneId: 0, label: 'Chapter 1 Node'},
    ]);
  });

  it('lanes are generated based on the node laneId', () => {
    const store = MemoryStore.create<DcbEvent>();
    const projector = GraphProjector.create({store});
    const commandId = uuid();
    const eventId = uuid();
    store.append([
      Events.nodeAdded(projectId, 'chapter-1', commandId, 'cmd', 0),
      Events.nodeAdded(projectId, 'chapter-1', eventId, 'evt', 1),
    ]);

    const model = projector.project(projectId);

    expect(model.lanes)
      .toEqual([
        {id: 'lane-0', order: 0,},
        {id: 'lane-1', order: 1,},
      ]);
  });

  it('renamed nodes receive new label', () => {
    const store = MemoryStore.create<DcbEvent>();
    const projector = GraphProjector.create({store});
    const commandId = uuid();
    store.append([
      Events.nodeAdded(projectId, 'chapter-1', commandId, 'cmd', 0, 'Command'),
      Events.nodeRenamed(projectId, commandId, 'Renamed Command'),
    ]);

    const model = projector.project(projectId);

    expect(model.nodes[0].label)
      .toEqual('Renamed Command');
  });

  it('projects node property schema and examples independently', () => {
    const store = MemoryStore.create<DcbEvent>();
    const projector = GraphProjector.create({store});

    store.append([
      Events.nodeAdded(projectId, 'chapter-1', 'kept-node', 'dm', 0, 'Kept'),
      Events.nodeAdded(projectId, 'chapter-1', 'removed-node', 'dm', 0, 'Removed'),
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

  it('ignores schemas examples and edges for nodes outside the requested chapter', () => {
    const store = MemoryStore.create<DcbEvent>();
    const projector = GraphProjector.create({store});

    store.append([
      {
        type: 'NodeAdded',
        payload: {projectId, chapterId: 'chapter-1', nodeId: 'visible-node', type: 'dm', laneId: 0, label: 'Visible'},
        tags: ['projectId:project-1', 'nodeId:visible-node', 'type:dm'],
      },
      {
        type: 'NodeAdded',
        payload: {projectId, chapterId: 'chapter-2', nodeId: 'hidden-node', type: 'evt', laneId: 1, label: 'Hidden'},
        tags: ['projectId:project-1', 'nodeId:hidden-node', 'type:evt'],
      },
      Events.nodeSchemaChanged(projectId, 'visible-node', [
        {propertyId: 'prop-title', name: 'title', type: 'string'},
      ]),
      Events.nodeExampleValuesChanged(projectId, 'visible-node', [
        {propertyId: 'prop-title', scalarValue: 'Visible example'},
      ]),
      Events.nodeSchemaChanged(projectId, 'hidden-node', [
        {propertyId: 'prop-hidden', name: 'hidden', type: 'string'},
      ]),
      Events.nodeExampleValuesChanged(projectId, 'hidden-node', [
        {propertyId: 'prop-hidden', scalarValue: 'Hidden example'},
      ]),
      Events.nodesConnected(projectId, 'visible-node', 'hidden-node', 'flow'),
    ] as DcbEvent[]);

    const model = projector.project(projectId, 'chapter-1');

    expect(model.nodeSchemas).toEqual({
      'visible-node': [
        {propertyId: 'prop-title', name: 'title', type: 'string'},
      ],
    });
    expect(model.nodeExampleValues).toEqual({
      'visible-node': [
        {propertyId: 'prop-title', scalarValue: 'Visible example'},
      ],
    });
    expect(model.edges).toEqual([]);
  });

  it('projects nodes by their latest chapter membership', () => {
    const store = MemoryStore.create<DcbEvent>();
    const projector = GraphProjector.create({store});

    store.append([
      Events.nodeAdded(projectId, 'chapter-1', 'moving-node', 'dm', 0, 'Moving Node'),
      Events.nodeSchemaChanged(projectId, 'moving-node', [
        {propertyId: 'prop-title', name: 'title', type: 'string'},
      ]),
      Events.nodeExampleValuesChanged(projectId, 'moving-node', [
        {propertyId: 'prop-title', scalarValue: 'Before move'},
      ]),
      Events.nodeChapterChanged(projectId, 'moving-node', 'chapter-2'),
    ]);

    expect(projector.project(projectId, 'chapter-1')).toEqual({
      nodes: [],
      edges: [],
      lanes: [],
      nodeSchemas: {},
      nodeExampleValues: {},
    });
    expect(projector.project(projectId, 'chapter-2')).toEqual({
      nodes: [
        {nodeId: 'moving-node', nodeType: 'dm', laneId: 0, label: 'Moving Node'},
      ],
      edges: [],
      lanes: [{id: 'lane-0', order: 0}],
      nodeSchemas: {
        'moving-node': [{propertyId: 'prop-title', name: 'title', type: 'string'}],
      },
      nodeExampleValues: {
        'moving-node': [{propertyId: 'prop-title', scalarValue: 'Before move'}],
      },
    });
  });

  it('replays the complete graph event stream deterministically', () => {
    const emptyStore = MemoryStore.create<DcbEvent>();
    expect(GraphProjector.create({store: emptyStore}).project(projectId))
      .toEqual({nodes: [], edges: [], lanes: [], nodeSchemas: {}, nodeExampleValues: {}});

    const store = MemoryStore.create<DcbEvent>();
    const projector = GraphProjector.create({store});
    const removedId = uuid();
    const commandId = uuid();
    const eventId = uuid();
    const dataModelId = uuid();
    const missingId = uuid();
    store.append([
      Events.nodeAdded(projectId, 'chapter-1', removedId, 'ui', 9, 'Removed'),
      Events.nodeAdded(projectId, 'chapter-1', commandId, 'cmd', 3, 'Command'),
      Events.nodeAdded(projectId, 'chapter-1', eventId, 'evt', 1, 'Event'),
      Events.nodeAdded(projectId, 'chapter-1', dataModelId, 'dm', 3, 'Data'),
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

  it('projects canonical event arrays without a store wrapper', () => {
    const removedId = uuid();
    const commandId = uuid();
    const eventId = uuid();
    const dataModelId = uuid();
    const movingId = uuid();

    const model = projectGraph([
      Events.nodeAdded(projectId, 'chapter-1', removedId, 'ui', 9, 'Removed'),
      Events.nodeAdded(projectId, 'chapter-1', commandId, 'cmd', 3, 'Command'),
      Events.nodeAdded(projectId, 'chapter-1', eventId, 'evt', 1, 'Event'),
      Events.nodeAdded(projectId, 'chapter-1', dataModelId, 'dm', 3, 'Data'),
      Events.nodeAdded(projectId, 'chapter-1', movingId, 'rm', 2, 'Moving'),
      Events.nodesConnected(projectId, removedId, commandId, 'flow'),
      Events.nodesConnected(projectId, commandId, eventId, 'flow'),
      Events.nodesConnected(projectId, eventId, dataModelId, 'back-reference'),
      Events.nodeTypeChanged(projectId, commandId, 'processor'),
      Events.nodeChapterChanged(projectId, movingId, 'chapter-2'),
      Events.nodesDisconnected(projectId, commandId, eventId),
      Events.nodeRemoved(projectId, removedId),
      Events.nodeRenamed(projectId, removedId, 'Missing'),
    ], projectId, 'chapter-1');

    expect(model).toEqual({
      nodes: [
        {nodeId: commandId, nodeType: 'processor', laneId: 3, label: 'Command'},
        {nodeId: eventId, nodeType: 'evt', laneId: 1, label: 'Event'},
        {nodeId: dataModelId, nodeType: 'dm', laneId: 3, label: 'Data'},
      ],
      edges: [
        {sourceNodeId: eventId, targetNodeId: dataModelId, role: 'back-reference'},
      ],
      lanes: [
        {id: 'lane-1', order: 1},
        {id: 'lane-3', order: 3},
      ],
      nodeSchemas: {},
      nodeExampleValues: {},
    });
  });
});
