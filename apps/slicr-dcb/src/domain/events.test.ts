import { describe, expect, it } from 'vitest';
import { Events } from './events';

describe('Events', () => {
  it('creates tagged events for every persistent graph mutation', () => {
    expect(Events.nodeAdded('node-1', 'cmd', 2, 'Create Thing')).toEqual({
      type: 'NodeAdded',
      payload: { nodeId: 'node-1', type: 'cmd', laneId: 2, label: 'Create Thing' },
      tags: ['nodeId:node-1', 'type:cmd'],
    });
    expect(Events.nodeRenamed('node-1', 'Renamed Thing')).toEqual({
      type: 'NodeRenamed',
      payload: { nodeId: 'node-1', newName: 'Renamed Thing' },
      tags: ['nodeId:node-1'],
    });
    expect(Events.nodeRemoved('node-1')).toEqual({
      type: 'NodeRemoved',
      payload: { nodeId: 'node-1' },
      tags: ['nodeId:node-1'],
    });
    expect(Events.nodeTypeChanged('node-1', 'dm')).toEqual({
      type: 'NodeTypeChanged',
      payload: { nodeId: 'node-1', newType: 'dm' },
      tags: ['nodeId:node-1', 'type:dm'],
    });
    expect(Events.nodesConnected('node-1', 'node-2', 'back-reference')).toEqual({
      type: 'NodesConnected',
      payload: { sourceNodeId: 'node-1', targetNodeId: 'node-2', role: 'back-reference' },
      tags: ['sourceNodeId:node-1', 'targetNodeId:node-2', 'role:back-reference'],
    });
    expect(Events.nodesDisconnected('node-1', 'node-2')).toEqual({
      type: 'NodesDisconnected',
      payload: { sourceNodeId: 'node-1', targetNodeId: 'node-2' },
      tags: ['sourceNodeId:node-1', 'targetNodeId:node-2'],
    });
  });
});
