import {type NodeType} from './graph';
import {type Event} from '@slicr/event-sourcing';

export type NodeId = string;
export type NodePropertyId = string;

export type NodePropertySchema = {
  propertyId: NodePropertyId,
  name: string,
  type: 'string' | 'number' | 'boolean' | 'Object',
  list?: boolean,
  optional?: boolean,
  generated?: boolean,
  properties?: NodePropertySchema[],
};

export type NodeExamplePrimitive = string | null;

export interface NodeComplexExampleValue {
  [propertyId: NodePropertyId]: NodeExamplePrimitive | NodeComplexExampleValue;
}

export type NodePropertyExampleValues = {
  propertyId: NodePropertyId,
  scalarValue?: NodeExamplePrimitive,
  scalarListValues?: NodeExamplePrimitive[],
  complexValue?: NodeComplexExampleValue,
  complexListValues?: NodeComplexExampleValue[],
};

export type NodeSchemaChanged = {
  nodeId: NodeId,
  schema: NodePropertySchema[],
};

export type NodeExampleValuesChanged = {
  nodeId: NodeId,
  exampleValues: NodePropertyExampleValues[],
};

export type ProjectId = string;
export type ChapterId = string;

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
export type ProjectAdded = {
  projectId: ProjectId,
  name: string,
};
export type ProjectRenamed = {
  projectId: ProjectId,
  newName: string,
};
export type ChapterAdded = {
  projectId: ProjectId,
  chapterId: ChapterId,
  title: string,
};
export type ChapterRenamed = {
  projectId: ProjectId,
  chapterId: ChapterId,
  newTitle: string,
};

export type DomainEvent =
  Event<'NodeAdded', NodeAdded> |
  Event<'NodeRenamed', NodeRenamed> |
  Event<'NodeRemoved', NodeRemoved> |
  Event<'NodeTypeChanged', NodeTypeChanged> |
  Event<'NodeSchemaChanged', NodeSchemaChanged> |
  Event<'NodeExampleValuesChanged', NodeExampleValuesChanged> |
  Event<'NodesConnected', NodesConnected> |
  Event<'NodesDisconnected', NodesDisconnected> |
  Event<'ProjectAdded', ProjectAdded> |
  Event<'ProjectRenamed', ProjectRenamed> |
  Event<'ChapterAdded', ChapterAdded> |
  Event<'ChapterRenamed', ChapterRenamed>;

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
  nodeRemoved(nodeId: NodeId): Event<'NodeRemoved', NodeRemoved> {
    return {
      type: 'NodeRemoved',
      payload: {nodeId},
      tags: [`nodeId:${nodeId}`]
    };
  },
  nodeTypeChanged(nodeId: NodeId, newType: NodeType): Event<'NodeTypeChanged', NodeTypeChanged> {
    return {
      type: 'NodeTypeChanged',
      payload: {nodeId, newType},
      tags: [`nodeId:${nodeId}`, `type:${newType}`]
    };
  },
  nodeSchemaChanged(nodeId: NodeId, schema: NodePropertySchema[]): Event<'NodeSchemaChanged', NodeSchemaChanged> {
    return {
      type: 'NodeSchemaChanged',
      payload: {nodeId, schema},
      tags: [`nodeId:${nodeId}`]
    };
  },
  nodeExampleValuesChanged(nodeId: NodeId,
                           exampleValues: NodePropertyExampleValues[]): Event<'NodeExampleValuesChanged', NodeExampleValuesChanged> {
    return {
      type: 'NodeExampleValuesChanged',
      payload: {nodeId, exampleValues},
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
      tags: [`nodeId:${sourceNodeId}`, `nodeId:${targetNodeId}`, `role:${defaultedRole}`]
    };
  },
  nodesDisconnected(sourceNodeId: NodeId, targetNodeId: NodeId): Event<'NodesDisconnected', NodesDisconnected> {
    return {
      type: 'NodesDisconnected',
      payload: {sourceNodeId, targetNodeId},
      tags: [`nodeId:${sourceNodeId}`, `nodeId:${targetNodeId}`, `connection:${sourceNodeId}->${targetNodeId}`]
    };
  },
  projectAdded(projectId: ProjectId, name: string): Event<'ProjectAdded', ProjectAdded> {
    return {
      type: 'ProjectAdded',
      payload: {projectId, name},
      tags: [`projectId:${projectId}`]
    };
  },
  projectRenamed(projectId: ProjectId, newName: string): Event<'ProjectRenamed', ProjectRenamed> {
    return {
      type: 'ProjectRenamed',
      payload: {projectId, newName},
      tags: [`projectId:${projectId}`]
    };
  },
  chapterAdded(projectId: ProjectId, chapterId: ChapterId, title: string): Event<'ChapterAdded', ChapterAdded> {
    return {
      type: 'ChapterAdded',
      payload: {projectId, chapterId, title},
      tags: [`projectId:${projectId}`, `chapterId:${chapterId}`]
    };
  },
  chapterRenamed(projectId: ProjectId, chapterId: ChapterId, newTitle: string): Event<'ChapterRenamed', ChapterRenamed> {
    return {
      type: 'ChapterRenamed',
      payload: {projectId, chapterId, newTitle},
      tags: [`projectId:${projectId}`, `chapterId:${chapterId}`]
    };
  }
};
