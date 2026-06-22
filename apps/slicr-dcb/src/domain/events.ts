import {type NodeType} from './graph';
import {type Event} from './eventSourcing';

export type ProjectId = string;
export type ChapterId = string;
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
  projectId: ProjectId,
  nodeId: NodeId,
  schema: NodePropertySchema[],
};

export type NodeExampleValuesChanged = {
  projectId: ProjectId,
  nodeId: NodeId,
  exampleValues: NodePropertyExampleValues[],
};

export type NodeAdded = {
  projectId: ProjectId,
  chapterId: ChapterId,
  nodeId: NodeId,
  type: NodeType,
  laneId: number,
  label: string,
};
export type NodeChapterChanged = {
  projectId: ProjectId,
  nodeId: NodeId,
  chapterId: ChapterId,
};
export type NodeRenamed = {
  projectId: ProjectId,
  nodeId: NodeId,
  newName: string
};
export type NodeRemoved = {
  projectId: ProjectId,
  nodeId: NodeId
};
export type NodeTypeChanged = {
  projectId: ProjectId,
  nodeId: NodeId,
  newType: NodeType
};
export type NodesConnected = {
  projectId: ProjectId,
  sourceNodeId: NodeId,
  targetNodeId: NodeId,
  role: 'flow' | 'back-reference'
};
export type NodesDisconnected = {
  projectId: ProjectId,
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
  Event<'NodeChapterChanged', NodeChapterChanged> |
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
  nodeAdded(projectId: ProjectId, chapterId: ChapterId, nodeId: NodeId, type: NodeType, laneId: number, label?: string): Event<'NodeAdded', NodeAdded> {
    return {
      type: 'NodeAdded',
      payload: {projectId, chapterId, nodeId, type, label: label ?? type, laneId},
      tags: [`projectId:${projectId}`, `chapterId:${chapterId}`, `nodeId:${nodeId}`, `type:${type}`]
    };
  },
  nodeChapterChanged(projectId: ProjectId, nodeId: NodeId, chapterId: ChapterId): Event<'NodeChapterChanged', NodeChapterChanged> {
    return {
      type: 'NodeChapterChanged',
      payload: {projectId, nodeId, chapterId},
      tags: [`projectId:${projectId}`, `nodeId:${nodeId}`, `chapterId:${chapterId}`]
    };
  },
  nodeRenamed(projectId: ProjectId, nodeId: NodeId, newEventName: string): Event<'NodeRenamed', NodeRenamed> {
    return {
      type: 'NodeRenamed',
      payload: {projectId, nodeId, newName: newEventName},
      tags: [`projectId:${projectId}`, `nodeId:${nodeId}`]
    };
  },
  nodeRemoved(projectId: ProjectId, nodeId: NodeId): Event<'NodeRemoved', NodeRemoved> {
    return {
      type: 'NodeRemoved',
      payload: {projectId, nodeId},
      tags: [`projectId:${projectId}`, `nodeId:${nodeId}`]
    };
  },
  nodeTypeChanged(projectId: ProjectId, nodeId: NodeId, newType: NodeType): Event<'NodeTypeChanged', NodeTypeChanged> {
    return {
      type: 'NodeTypeChanged',
      payload: {projectId, nodeId, newType},
      tags: [`projectId:${projectId}`, `nodeId:${nodeId}`, `type:${newType}`]
    };
  },
  nodeSchemaChanged(projectId: ProjectId, nodeId: NodeId, schema: NodePropertySchema[]): Event<'NodeSchemaChanged', NodeSchemaChanged> {
    return {
      type: 'NodeSchemaChanged',
      payload: {projectId, nodeId, schema},
      tags: [`projectId:${projectId}`, `nodeId:${nodeId}`]
    };
  },
  nodeExampleValuesChanged(projectId: ProjectId, nodeId: NodeId,
                           exampleValues: NodePropertyExampleValues[]): Event<'NodeExampleValuesChanged', NodeExampleValuesChanged> {
    return {
      type: 'NodeExampleValuesChanged',
      payload: {projectId, nodeId, exampleValues},
      tags: [`projectId:${projectId}`, `nodeId:${nodeId}`]
    };
  },
  nodesConnected(projectId: ProjectId, sourceNodeId: NodeId,
                 targetNodeId: NodeId,
                 role?: 'flow' | 'back-reference'): Event<'NodesConnected', NodesConnected> {
    const defaultedRole = role ?? 'flow';
    return {
      type: 'NodesConnected',
      payload: {projectId, sourceNodeId, targetNodeId, role: defaultedRole},
      tags: [`projectId:${projectId}`, `nodeId:${sourceNodeId}`, `nodeId:${targetNodeId}`, `role:${defaultedRole}`, `connection:${sourceNodeId}->${targetNodeId}`]
    };
  },
  nodesDisconnected(projectId: ProjectId, sourceNodeId: NodeId, targetNodeId: NodeId): Event<'NodesDisconnected', NodesDisconnected> {
    return {
      type: 'NodesDisconnected',
      payload: {projectId, sourceNodeId, targetNodeId},
      tags: [`projectId:${projectId}`, `nodeId:${sourceNodeId}`, `nodeId:${targetNodeId}`, `connection:${sourceNodeId}->${targetNodeId}`]
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
