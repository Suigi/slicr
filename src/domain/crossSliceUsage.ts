import { parseDsl } from './parseDsl';
import { isTraceableNode } from './nodeTracing';

export type CrossSliceDocument = {
  id: string;
  dsl: string;
};

export type CrossSliceUsageRef = {
  sliceId: string;
  nodeKey: string;
};

export function getCrossSliceUsage(slices: CrossSliceDocument[], nodeKey: string): CrossSliceUsageRef[] {
  const result: CrossSliceUsageRef[] = [];

  for (const slice of slices) {
    const parsed = parseDsl(slice.dsl);
    const node = parsed.nodes.get(nodeKey);
    if (!node || !isTraceableNode(node)) {
      continue;
    }

    result.push({ sliceId: slice.id, nodeKey: node.key });
  }

  return result;
}
