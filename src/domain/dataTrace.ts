import { isTraceableNode } from './nodeTracing';
import { VisualNode } from './types';

type TraceInput = {
  nodes: Map<string, VisualNode>;
};

export type DataTraceHop = {
  nodeKey: string;
  key: string;
};

export type DataTraceResult = {
  usesKey: string;
  hops: DataTraceHop[];
  source: unknown;
};

export function traceData(input: TraceInput, nodeKey: string, usesKey: string): DataTraceResult | null {
  const node = input.nodes.get(nodeKey);
  if (!node || !isTraceableNode(node)) {
    return null;
  }

  return {
    usesKey,
    hops: [],
    source: null
  };
}
