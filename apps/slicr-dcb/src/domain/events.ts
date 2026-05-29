import {type NodeType} from './graph';
import {type Event} from '@slicr/event-sourcing';

export type NodeId = string;

export type NodeAdded = {
  nodeId: NodeId,
  type: NodeType,
  laneId: number,
  label: string,
};
export type NodeRenamed = {
  nodeId: NodeId,
  newName: string
};
export type NodeRemoved = {
  nodeId: NodeId
};
export type NodeTypeChanged = {
  nodeId: NodeId,
  newType: NodeType
};
export type NodesConnected = {
  sourceNodeId: NodeId,
  targetNodeId: NodeId,
  role: 'flow' | 'back-reference'
};
export type NodesDisconnected = {
  sourceNodeId: NodeId,
  targetNodeId: NodeId
};

export type DomainEvent =
  Event<'NodeAdded', NodeAdded> |
  Event<'NodeRenamed', NodeRenamed> |
  Event<'NodeRemoved', NodeRemoved> |
  Event<'NodeTypeChanged', NodeTypeChanged> |
  Event<'NodesConnected', NodesConnected> |
  Event<'NodesDisconnected', NodesDisconnected>
  ;

export const Events = {
  nodeAdded(nodeId: NodeId, type: NodeType, laneId: number, label?: string): Event<'NodeAdded', NodeAdded> {
    return {
      type: 'NodeAdded',
      payload: {nodeId, type, label: label ?? type, laneId},
      tags: [`nodeId:${nodeId}`, `type:${type}`]
    };
  },
  nodeRenamed(nodeId: NodeId, newEventName: string): Event<'NodeRenamed', NodeRenamed> {
    return {
      type: 'NodeRenamed',
      payload: {nodeId, newName: newEventName},
      tags: [`nodeId:${nodeId}`]
    };
  },
  nodesConnected(sourceNodeId: NodeId,
                 targetNodeId: NodeId,
                 role?: 'flow' | 'back-reference'): Event<'NodesConnected', NodesConnected> {
    const defaultedRole = role ?? 'flow';
    return {
      type: 'NodesConnected',
      payload: {sourceNodeId, targetNodeId, role: defaultedRole},
      tags: [`sourceNodeId:${sourceNodeId}`, `targetNodeId:${targetNodeId}`, `role:${defaultedRole}`]
    };
  }
};
