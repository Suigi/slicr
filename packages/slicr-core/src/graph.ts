import {type NodeId, type NodePropertyExampleValues, type NodePropertySchema} from './events';

export type NodeType = 'ui' | 'cmd' | 'evt' | 'rm' | 'dm' | 'processor';

export type Node = {
  nodeId: NodeId;
  nodeType: NodeType;
  label: string;
  laneId: number;
};

export type Edge = {
  sourceNodeId: NodeId;
  targetNodeId: NodeId;
  role: 'flow' | 'back-reference';
};

export type Lane = {
  id: string;
  order: number;
};

export type ModelGraph = {
  nodes: Node[];
  edges: Edge[];
  lanes: Lane[];
  nodeSchemas: Record<NodeId, NodePropertySchema[]>;
  nodeExampleValues: Record<NodeId, NodePropertyExampleValues[]>;
};
