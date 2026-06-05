import type {EdgeInput, LaneInput} from 'layout-lib';

import type {NodePropertyExampleValues, NodePropertySchema} from '../domain/events';
import type {ModelGraph} from '../domain/graph';
import {NODE_HEIGHT, NODE_WIDTH, laneIdForOrder} from './constants';
import type {GraphNode} from './types';

export type RendererGraph = {
  nodes: GraphNode[];
  edges: EdgeInput[];
  lanes: LaneInput[];
  nodeSchemas: Record<string, NodePropertySchema[]>;
  nodeExampleValues: Record<string, NodePropertyExampleValues[]>;
};

export function adaptModelGraphToRenderer(model: ModelGraph): RendererGraph {
  return {
    nodes: model.nodes.map((node) => ({
      id: node.nodeId,
      label: node.label,
      type: node.nodeType,
      laneId: laneIdForOrder(node.laneId),
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: model.edges.map((edge) => ({
      id: `edge-${edge.sourceNodeId}-${edge.targetNodeId}`,
      sourceId: edge.sourceNodeId,
      targetId: edge.targetNodeId,
      role: edge.role,
    })),
    lanes: model.lanes.map((lane) => ({...lane})),
    nodeSchemas: {...model.nodeSchemas},
    nodeExampleValues: {...model.nodeExampleValues},
  };
}
