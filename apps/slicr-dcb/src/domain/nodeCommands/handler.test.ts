import {v4 as uuid} from 'uuid';

import {describe, it} from 'vitest';
import {
  addConnectedNodeHandler,
  addNodeHandler,
  changeNodeTypeHandler,
  connectNodesHandler,
  disconnectNodesHandler,
  removeNodeHandler,
  renameNodeHandler,
} from './handler';
import {Events} from '../events';
import {expectHandler} from '@slicr/event-sourcing/testing';

describe('commands project state', () => {
  it('adding Command node emits NodeAdded event', () => {
    const staticUuid = uuid();

    expectHandler(addNodeHandler(() => staticUuid))
      .given()
      .when({nodeType: 'cmd', laneId: 2, label: 'Create Thing'})
      .thenEmits(Events.nodeAdded(staticUuid, 'cmd', 2, 'Create Thing'));
  });

  it('renaming Node emits NodeRenamed event', () => {
    const nodeId = uuid();

    expectHandler(renameNodeHandler)
      .given(Events.nodeAdded(nodeId, 'evt', 0))
      .when({nodeId, newName: 'New Event Name'})
      .thenEmits(Events.nodeRenamed(nodeId, 'New Event Name'));
  });

  it('throws when renaming a Node that does not exist', () => {
    const nodeId = uuid();

    expectHandler(renameNodeHandler)
      .given()
      .when({nodeId, newName: 'New Event Name'})
      .thenThrows(new Error(`Unknown nodeId ${nodeId}`));
  });

  it('throws when renaming a removed Node', () => {
    const nodeId = uuid();

    expectHandler(renameNodeHandler)
      .given(Events.nodeAdded(nodeId, 'evt', 0), Events.nodeRemoved(nodeId))
      .when({nodeId, newName: 'New Event Name'})
      .thenThrows(new Error(`Unknown nodeId ${nodeId}`));
  });

  it('changing node type emits NodeTypeChanged for an existing node', () => {
    const nodeId = uuid();

    expectHandler(changeNodeTypeHandler)
      .given(Events.nodeAdded(nodeId, 'evt', 0))
      .when({nodeId, newType: 'dm'})
      .thenEmits(Events.nodeTypeChanged(nodeId, 'dm'));
  });

  it('throws when changing type for a Node that does not exist', () => {
    const nodeId = uuid();

    expectHandler(changeNodeTypeHandler)
      .given()
      .when({nodeId, newType: 'dm'})
      .thenThrows(new Error(`Unknown nodeId ${nodeId}`));
  });

  it('throws when changing type for a removed Node', () => {
    const nodeId = uuid();

    expectHandler(changeNodeTypeHandler)
      .given(Events.nodeAdded(nodeId, 'evt', 0), Events.nodeRemoved(nodeId))
      .when({nodeId, newType: 'dm'})
      .thenThrows(new Error(`Unknown nodeId ${nodeId}`));
  });

  it('removing node emits NodeRemoved for an existing node', () => {
    const nodeId = uuid();

    expectHandler(removeNodeHandler)
      .given(Events.nodeAdded(nodeId, 'evt', 0))
      .when({nodeId})
      .thenEmits(Events.nodeRemoved(nodeId));
  });

  it('throws when removing a Node that does not exist', () => {
    const nodeId = uuid();

    expectHandler(removeNodeHandler)
      .given()
      .when({nodeId})
      .thenThrows(new Error(`Unknown nodeId ${nodeId}`));
  });

  it('throws when removing an already removed Node', () => {
    const nodeId = uuid();

    expectHandler(removeNodeHandler)
      .given(Events.nodeAdded(nodeId, 'evt', 0), Events.nodeRemoved(nodeId))
      .when({nodeId})
      .thenThrows(new Error(`Unknown nodeId ${nodeId}`));
  });

  it('connecting nodes emits NodesConnected for existing nodes', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(connectNodesHandler)
      .given(Events.nodeAdded(sourceNodeId, 'cmd', 0), Events.nodeAdded(targetNodeId, 'evt', 1))
      .when({sourceNodeId, targetNodeId, role: 'back-reference'})
      .thenEmits(Events.nodesConnected(sourceNodeId, targetNodeId, 'back-reference'));
  });

  it('throws when connecting an unknown source node', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(connectNodesHandler)
      .given(Events.nodeAdded(targetNodeId, 'evt', 1))
      .when({sourceNodeId, targetNodeId})
      .thenThrows(new Error(`Unknown nodeId ${sourceNodeId}`));
  });

  it('throws when connecting an unknown target node', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(connectNodesHandler)
      .given(Events.nodeAdded(sourceNodeId, 'cmd', 0))
      .when({sourceNodeId, targetNodeId})
      .thenThrows(new Error(`Unknown nodeId ${targetNodeId}`));
  });

  it('throws when connecting from a removed source node', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(connectNodesHandler)
      .given(
        Events.nodeAdded(sourceNodeId, 'cmd', 0),
        Events.nodeRemoved(sourceNodeId),
        Events.nodeAdded(targetNodeId, 'evt', 1),
      )
      .when({sourceNodeId, targetNodeId})
      .thenThrows(new Error(`Unknown nodeId ${sourceNodeId}`));
  });

  it('throws when connecting to a removed target node', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(connectNodesHandler)
      .given(
        Events.nodeAdded(sourceNodeId, 'cmd', 0),
        Events.nodeAdded(targetNodeId, 'evt', 1),
        Events.nodeRemoved(targetNodeId),
      )
      .when({sourceNodeId, targetNodeId})
      .thenThrows(new Error(`Unknown nodeId ${targetNodeId}`));
  });

  it('self-connections emit no event', () => {
    const nodeId = uuid();

    expectHandler(connectNodesHandler)
      .given(Events.nodeAdded(nodeId, 'cmd', 0))
      .when({sourceNodeId: nodeId, targetNodeId: nodeId})
      .thenEmits();
  });

  it('duplicate active connections found through normalized node tags emit no event', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(connectNodesHandler)
      .given(
        Events.nodeAdded(sourceNodeId, 'cmd', 0),
        Events.nodeAdded(targetNodeId, 'evt', 1),
        Events.nodesConnected(sourceNodeId, targetNodeId),
      )
      .when({sourceNodeId, targetNodeId})
      .thenEmits();
  });

  it('reconnecting after a disconnection emits NodesConnected', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(connectNodesHandler)
      .given(
        Events.nodeAdded(sourceNodeId, 'cmd', 0),
        Events.nodeAdded(targetNodeId, 'evt', 1),
        Events.nodesConnected(sourceNodeId, targetNodeId),
        Events.nodesDisconnected(sourceNodeId, targetNodeId),
      )
      .when({sourceNodeId, targetNodeId})
      .thenEmits(Events.nodesConnected(sourceNodeId, targetNodeId));
  });

  it('disconnecting an active connection emits NodesDisconnected', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(disconnectNodesHandler)
      .given(
        Events.nodeAdded(sourceNodeId, 'cmd', 0),
        Events.nodeAdded(targetNodeId, 'evt', 1),
        Events.nodesConnected(sourceNodeId, targetNodeId),
      )
      .when({sourceNodeId, targetNodeId})
      .thenEmits(Events.nodesDisconnected(sourceNodeId, targetNodeId));
  });

  it('disconnecting a missing connection emits no event', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(disconnectNodesHandler)
      .given(Events.nodeAdded(sourceNodeId, 'cmd', 0), Events.nodeAdded(targetNodeId, 'evt', 1))
      .when({sourceNodeId, targetNodeId})
      .thenEmits();
  });

  it('throws when disconnecting from a removed source node', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(disconnectNodesHandler)
      .given(
        Events.nodeAdded(sourceNodeId, 'cmd', 0),
        Events.nodeAdded(targetNodeId, 'evt', 1),
        Events.nodesConnected(sourceNodeId, targetNodeId),
        Events.nodeRemoved(sourceNodeId),
      )
      .when({sourceNodeId, targetNodeId})
      .thenThrows(new Error(`Unknown nodeId ${sourceNodeId}`));
  });

  it('throws when disconnecting from a removed target node', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(disconnectNodesHandler)
      .given(
        Events.nodeAdded(sourceNodeId, 'cmd', 0),
        Events.nodeAdded(targetNodeId, 'evt', 1),
        Events.nodesConnected(sourceNodeId, targetNodeId),
        Events.nodeRemoved(targetNodeId),
      )
      .when({sourceNodeId, targetNodeId})
      .thenThrows(new Error(`Unknown nodeId ${targetNodeId}`));
  });

  it('adding a connected node emits NodeAdded and NodesConnected', () => {
    const sourceNodeId = uuid();
    const newNodeId = uuid();

    expectHandler(addConnectedNodeHandler(() => newNodeId))
      .given(Events.nodeAdded(sourceNodeId, 'cmd', 0))
      .when({sourceNodeId, nodeType: 'evt', laneId: 1, label: 'Thing Happened', role: 'back-reference'})
      .thenEmits(
        Events.nodeAdded(newNodeId, 'evt', 1, 'Thing Happened'),
        Events.nodesConnected(sourceNodeId, newNodeId, 'back-reference'),
      );
  });

  it('throws when adding a connected node from an unknown source node', () => {
    const sourceNodeId = uuid();
    const newNodeId = uuid();

    expectHandler(addConnectedNodeHandler(() => newNodeId))
      .given()
      .when({sourceNodeId, nodeType: 'evt', laneId: 1, label: 'Thing Happened'})
      .thenThrows(new Error(`Unknown nodeId ${sourceNodeId}`));
  });

  it('throws when adding a connected node from a removed source node', () => {
    const sourceNodeId = uuid();
    const newNodeId = uuid();

    expectHandler(addConnectedNodeHandler(() => newNodeId))
      .given(Events.nodeAdded(sourceNodeId, 'cmd', 0), Events.nodeRemoved(sourceNodeId))
      .when({sourceNodeId, nodeType: 'evt', laneId: 1, label: 'Thing Happened'})
      .thenThrows(new Error(`Unknown nodeId ${sourceNodeId}`));
  });
});
