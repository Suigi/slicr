import {v4 as uuid} from 'uuid';

import {describe, it} from 'vitest';
import {
  addConnectedNodeHandler,
  addNodeHandler,
  changeNodeExampleValuesHandler,
  changeNodeSchemaHandler,
  changeNodeTypeHandler,
  connectNodesHandler,
  disconnectNodesHandler,
  removeNodeHandler,
  renameNodeHandler,
} from './handler';
import {Events} from '../events';
import {expectHandler} from '@slicr/event-sourcing/testing';

const projectId = 'project-1';

describe('commands project state', () => {
  it('adding Command node emits NodeAdded event', () => {
    const staticUuid = uuid();

    expectHandler(addNodeHandler(() => staticUuid))
      .given()
      .when({projectId, nodeType: 'cmd', laneId: 2, label: 'Create Thing'})
      .thenEmits(Events.nodeAdded(projectId, staticUuid, 'cmd', 2, 'Create Thing'));
  });

  it('renaming Node emits NodeRenamed event', () => {
    const nodeId = uuid();

    expectHandler(renameNodeHandler)
      .given(Events.nodeAdded(projectId, nodeId, 'evt', 0))
      .when({projectId, nodeId, newName: 'New Event Name'})
      .thenEmits(Events.nodeRenamed(projectId, nodeId, 'New Event Name'));
  });

  it('throws when renaming a Node that does not exist', () => {
    const nodeId = uuid();

    expectHandler(renameNodeHandler)
      .given()
      .when({projectId, nodeId, newName: 'New Event Name'})
      .thenThrows(new Error(`Unknown nodeId ${nodeId}`));
  });

  it('throws when renaming a removed Node', () => {
    const nodeId = uuid();

    expectHandler(renameNodeHandler)
      .given(Events.nodeAdded(projectId, nodeId, 'evt', 0), Events.nodeRemoved(projectId, nodeId))
      .when({projectId, nodeId, newName: 'New Event Name'})
      .thenThrows(new Error(`Unknown nodeId ${nodeId}`));
  });

  it('changing node type emits NodeTypeChanged for an existing node', () => {
    const nodeId = uuid();

    expectHandler(changeNodeTypeHandler)
      .given(Events.nodeAdded(projectId, nodeId, 'evt', 0))
      .when({projectId, nodeId, newType: 'dm'})
      .thenEmits(Events.nodeTypeChanged(projectId, nodeId, 'dm'));
  });

  it('changing node schema emits only when the schema differs for an existing node', () => {
    const nodeId = uuid();
    const originalSchema = [{propertyId: 'prop-title', name: 'title', type: 'string' as const}];
    const changedSchema = [{propertyId: 'prop-total', name: 'total', type: 'number' as const}];

    expectHandler(changeNodeSchemaHandler)
      .given(
        Events.nodeAdded(projectId, nodeId, 'evt', 0),
        Events.nodeSchemaChanged(projectId, nodeId, originalSchema),
      )
      .when({projectId, nodeId, schema: changedSchema})
      .thenEmits(Events.nodeSchemaChanged(projectId, nodeId, changedSchema));

    expectHandler(changeNodeSchemaHandler)
      .given(
        Events.nodeAdded(projectId, nodeId, 'evt', 0),
        Events.nodeSchemaChanged(projectId, nodeId, changedSchema),
      )
      .when({projectId, nodeId, schema: changedSchema})
      .thenEmits();
  });

  it('changing node example values emits only when examples differ for an existing node', () => {
    const nodeId = uuid();
    const originalExamples = [{propertyId: 'prop-title', scalarValue: 'Old title'}];
    const changedExamples = [{propertyId: 'prop-title', scalarValue: 'New title'}];

    expectHandler(changeNodeExampleValuesHandler)
      .given(
        Events.nodeAdded(projectId, nodeId, 'evt', 0),
        Events.nodeExampleValuesChanged(projectId, nodeId, originalExamples),
      )
      .when({projectId, nodeId, exampleValues: changedExamples})
      .thenEmits(Events.nodeExampleValuesChanged(projectId, nodeId, changedExamples));

    expectHandler(changeNodeExampleValuesHandler)
      .given(
        Events.nodeAdded(projectId, nodeId, 'evt', 0),
        Events.nodeExampleValuesChanged(projectId, nodeId, changedExamples),
      )
      .when({projectId, nodeId, exampleValues: changedExamples})
      .thenEmits();
  });

  it('throws when changing type for a Node that does not exist', () => {
    const nodeId = uuid();

    expectHandler(changeNodeTypeHandler)
      .given()
      .when({projectId, nodeId, newType: 'dm'})
      .thenThrows(new Error(`Unknown nodeId ${nodeId}`));
  });

  it('throws when changing type for a removed Node', () => {
    const nodeId = uuid();

    expectHandler(changeNodeTypeHandler)
      .given(Events.nodeAdded(projectId, nodeId, 'evt', 0), Events.nodeRemoved(projectId, nodeId))
      .when({projectId, nodeId, newType: 'dm'})
      .thenThrows(new Error(`Unknown nodeId ${nodeId}`));
  });

  it('removing node emits NodeRemoved for an existing node', () => {
    const nodeId = uuid();

    expectHandler(removeNodeHandler)
      .given(Events.nodeAdded(projectId, nodeId, 'evt', 0))
      .when({projectId, nodeId})
      .thenEmits(Events.nodeRemoved(projectId, nodeId));
  });

  it('throws when removing a Node that does not exist', () => {
    const nodeId = uuid();

    expectHandler(removeNodeHandler)
      .given()
      .when({projectId, nodeId})
      .thenThrows(new Error(`Unknown nodeId ${nodeId}`));
  });

  it('throws when removing an already removed Node', () => {
    const nodeId = uuid();

    expectHandler(removeNodeHandler)
      .given(Events.nodeAdded(projectId, nodeId, 'evt', 0), Events.nodeRemoved(projectId, nodeId))
      .when({projectId, nodeId})
      .thenThrows(new Error(`Unknown nodeId ${nodeId}`));
  });

  it('connecting nodes only uses history from the requested project', () => {
    const otherProjectId = 'project-2';
    const sourceNodeId = 'shared-node-1';
    const targetNodeId = 'shared-node-2';

    expectHandler(connectNodesHandler)
      .given(
        Events.nodeAdded(projectId, sourceNodeId, 'cmd', 0),
        Events.nodeAdded(projectId, targetNodeId, 'evt', 1),
        Events.nodeAdded(otherProjectId, sourceNodeId, 'cmd', 0),
        Events.nodeAdded(otherProjectId, targetNodeId, 'evt', 1),
        Events.nodeRemoved(otherProjectId, targetNodeId),
      )
      .when({projectId, sourceNodeId, targetNodeId, role: 'back-reference'})
      .thenEmits(Events.nodesConnected(projectId, sourceNodeId, targetNodeId, 'back-reference'));
  });

  it('throws when connecting an unknown source node', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(connectNodesHandler)
      .given(Events.nodeAdded(projectId, targetNodeId, 'evt', 1))
      .when({projectId, sourceNodeId, targetNodeId})
      .thenThrows(new Error(`Unknown nodeId ${sourceNodeId}`));
  });

  it('throws when connecting an unknown target node', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(connectNodesHandler)
      .given(Events.nodeAdded(projectId, sourceNodeId, 'cmd', 0))
      .when({projectId, sourceNodeId, targetNodeId})
      .thenThrows(new Error(`Unknown nodeId ${targetNodeId}`));
  });

  it('throws when connecting from a removed source node', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(connectNodesHandler)
      .given(
        Events.nodeAdded(projectId, sourceNodeId, 'cmd', 0),
        Events.nodeRemoved(projectId, sourceNodeId),
        Events.nodeAdded(projectId, targetNodeId, 'evt', 1),
      )
      .when({projectId, sourceNodeId, targetNodeId})
      .thenThrows(new Error(`Unknown nodeId ${sourceNodeId}`));
  });

  it('throws when connecting to a removed target node', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(connectNodesHandler)
      .given(
        Events.nodeAdded(projectId, sourceNodeId, 'cmd', 0),
        Events.nodeAdded(projectId, targetNodeId, 'evt', 1),
        Events.nodeRemoved(projectId, targetNodeId),
      )
      .when({projectId, sourceNodeId, targetNodeId})
      .thenThrows(new Error(`Unknown nodeId ${targetNodeId}`));
  });

  it('self-connections emit no event', () => {
    const nodeId = uuid();

    expectHandler(connectNodesHandler)
      .given(Events.nodeAdded(projectId, nodeId, 'cmd', 0))
      .when({projectId, sourceNodeId: nodeId, targetNodeId: nodeId})
      .thenEmits();
  });

  it('duplicate active connections found through normalized node tags emit no event', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(connectNodesHandler)
      .given(
        Events.nodeAdded(projectId, sourceNodeId, 'cmd', 0),
        Events.nodeAdded(projectId, targetNodeId, 'evt', 1),
        Events.nodesConnected(projectId, sourceNodeId, targetNodeId),
      )
      .when({projectId, sourceNodeId, targetNodeId})
      .thenEmits();
  });

  it('reconnecting after a disconnection emits NodesConnected', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(connectNodesHandler)
      .given(
        Events.nodeAdded(projectId, sourceNodeId, 'cmd', 0),
        Events.nodeAdded(projectId, targetNodeId, 'evt', 1),
        Events.nodesConnected(projectId, sourceNodeId, targetNodeId),
        Events.nodesDisconnected(projectId, sourceNodeId, targetNodeId),
      )
      .when({projectId, sourceNodeId, targetNodeId})
      .thenEmits(Events.nodesConnected(projectId, sourceNodeId, targetNodeId));
  });

  it('disconnecting an active connection emits NodesDisconnected', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(disconnectNodesHandler)
      .given(
        Events.nodeAdded(projectId, sourceNodeId, 'cmd', 0),
        Events.nodeAdded(projectId, targetNodeId, 'evt', 1),
        Events.nodesConnected(projectId, sourceNodeId, targetNodeId),
      )
      .when({projectId, sourceNodeId, targetNodeId})
      .thenEmits(Events.nodesDisconnected(projectId, sourceNodeId, targetNodeId));
  });

  it('disconnecting a missing connection emits no event', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(disconnectNodesHandler)
      .given(Events.nodeAdded(projectId, sourceNodeId, 'cmd', 0), Events.nodeAdded(projectId, targetNodeId, 'evt', 1))
      .when({projectId, sourceNodeId, targetNodeId})
      .thenEmits();
  });

  it('throws when disconnecting from a removed source node', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(disconnectNodesHandler)
      .given(
        Events.nodeAdded(projectId, sourceNodeId, 'cmd', 0),
        Events.nodeAdded(projectId, targetNodeId, 'evt', 1),
        Events.nodesConnected(projectId, sourceNodeId, targetNodeId),
        Events.nodeRemoved(projectId, sourceNodeId),
      )
      .when({projectId, sourceNodeId, targetNodeId})
      .thenThrows(new Error(`Unknown nodeId ${sourceNodeId}`));
  });

  it('throws when disconnecting from a removed target node', () => {
    const sourceNodeId = uuid();
    const targetNodeId = uuid();

    expectHandler(disconnectNodesHandler)
      .given(
        Events.nodeAdded(projectId, sourceNodeId, 'cmd', 0),
        Events.nodeAdded(projectId, targetNodeId, 'evt', 1),
        Events.nodesConnected(projectId, sourceNodeId, targetNodeId),
        Events.nodeRemoved(projectId, targetNodeId),
      )
      .when({projectId, sourceNodeId, targetNodeId})
      .thenThrows(new Error(`Unknown nodeId ${targetNodeId}`));
  });

  it('adding a connected node emits NodeAdded and NodesConnected', () => {
    const sourceNodeId = uuid();
    const newNodeId = uuid();

    expectHandler(addConnectedNodeHandler(() => newNodeId))
      .given(Events.nodeAdded(projectId, sourceNodeId, 'cmd', 0))
      .when({projectId, sourceNodeId, nodeType: 'evt', laneId: 1, label: 'Thing Happened', role: 'back-reference'})
      .thenEmits(
        Events.nodeAdded(projectId, newNodeId, 'evt', 1, 'Thing Happened'),
        Events.nodesConnected(projectId, sourceNodeId, newNodeId, 'back-reference'),
      );
  });

  it('throws when adding a connected node from an unknown source node', () => {
    const sourceNodeId = uuid();
    const newNodeId = uuid();

    expectHandler(addConnectedNodeHandler(() => newNodeId))
      .given()
      .when({projectId, sourceNodeId, nodeType: 'evt', laneId: 1, label: 'Thing Happened'})
      .thenThrows(new Error(`Unknown nodeId ${sourceNodeId}`));
  });

  it('throws when adding a connected node from a removed source node', () => {
    const sourceNodeId = uuid();
    const newNodeId = uuid();

    expectHandler(addConnectedNodeHandler(() => newNodeId))
      .given(Events.nodeAdded(projectId, sourceNodeId, 'cmd', 0), Events.nodeRemoved(projectId, sourceNodeId))
      .when({projectId, sourceNodeId, nodeType: 'evt', laneId: 1, label: 'Thing Happened'})
      .thenThrows(new Error(`Unknown nodeId ${sourceNodeId}`));
  });

  it('connects previously deleted and re-added node', () => {
    const sourceNodeId = uuid();
    const newNodeId = uuid();

    expectHandler(addConnectedNodeHandler(() => newNodeId))
      .given(
        Events.nodeAdded(projectId, sourceNodeId, 'cmd', 0),
        Events.nodeRemoved(projectId, sourceNodeId),
        Events.nodeAdded(projectId, sourceNodeId, 'cmd', 0),
      )
      .when({projectId, sourceNodeId, nodeType: 'evt', laneId: 1, label: 'Thing Happened'})
      .thenEmits(
        Events.nodeAdded(projectId, newNodeId, 'evt', 1, 'Thing Happened'),
        Events.nodesConnected(projectId, sourceNodeId, newNodeId, 'flow'),
      );
  });
});
