import {type Command} from '../eventSourcing';
import {type NodeType} from '../../graph/types';
import {type NodePropertyExampleValues, type NodePropertySchema, type ProjectId, type ChapterId} from '../events';

export type AddChapter = Command<
  'AddChapter',
  {
    projectId: ProjectId;
    title: string;
  }
>;

export type AddNode = Command<
  'AddNode',
  {
    projectId: ProjectId;
    chapterId: ChapterId;
    nodeType: NodeType;
    laneId: number;
    label: string;
  }
>;

export type AddConnectedNode = Command<
  'AddConnectedNode',
  {
    projectId: ProjectId;
    chapterId: ChapterId;
    sourceNodeId: string;
    nodeType: NodeType;
    laneId: number;
    label: string;
    role?: 'flow' | 'back-reference';
  }
>;

export type ConnectNodes = Command<
  'ConnectNodes',
  {
    projectId: ProjectId;
    sourceNodeId: string;
    targetNodeId: string;
    role?: 'flow' | 'back-reference';
  }
>;

export type DisconnectNodes = Command<
  'DisconnectNodes',
  {
    projectId: ProjectId;
    sourceNodeId: string;
    targetNodeId: string;
  }
>;

export type RenameNode = Command<
  'RenameNode',
  {
    projectId: ProjectId;
    nodeId: string;
    newName: string;
  }
>;

export type ChangeNodeType = Command<
  'ChangeNodeType',
  {
    projectId: ProjectId;
    nodeId: string;
    newType: NodeType;
  }
>;

export type DeleteNode = Command<
  'DeleteNode',
  {
    projectId: ProjectId;
    nodeId: string;
  }
>;

export type ChangeNodeSchema = Command<
  'ChangeNodeSchema',
  {
    projectId: ProjectId;
    nodeId: string;
    schema: NodePropertySchema[];
  }
>;

export type ChangeNodeExampleValues = Command<
  'ChangeNodeExampleValues',
  {
    projectId: ProjectId;
    nodeId: string;
    exampleValues: NodePropertyExampleValues[];
  }
>;
