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

export type CrossSliceUsageIndexEntry = {
  nodeRef: string;
  nodeType: string;
  sliceRefs: CrossSliceUsageRef[];
};

export type CrossSliceUsageIndex = Record<string, CrossSliceUsageIndexEntry>;

export function buildCrossSliceUsageIndex(slices: CrossSliceDocument[]): CrossSliceUsageIndex {
  const index: CrossSliceUsageIndex = {};

  for (const slice of slices) {
    const parsed = parseDsl(slice.dsl);
    for (const node of parsed.nodes.values()) {
      if (!isTraceableNode(node)) {
        continue;
      }
      const nodeRef = toNodeRef(node);
      const existing = index[nodeRef];
      if (existing) {
        existing.sliceRefs.push({ sliceId: slice.id, nodeKey: node.key });
        continue;
      }

      index[nodeRef] = {
        nodeRef,
        nodeType: node.type,
        sliceRefs: [{ sliceId: slice.id, nodeKey: node.key }]
      };
    }
  }

  return index;
}

export function getCrossSliceUsage(slices: CrossSliceDocument[], nodeKey: string): CrossSliceUsageRef[] {
  return buildCrossSliceUsageIndex(slices)[nodeKey]?.sliceRefs ?? [];
}

function toNodeRef(node: { type: string; name: string }): string {
  return `${node.type}:${node.name}`;
}
