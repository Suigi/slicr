import { parseDsl } from './parseDsl';
import { isTraceableNode } from './nodeTracing';
import { toNodeAnalysisRef, toNodeAnalysisRefFromNode } from './nodeAnalysisKey';
import type { ParsedSliceProjection } from './parsedSliceProjection';
import type { Parsed } from './types';

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

export type CrossSliceUsageQuery = {
  getCrossSliceUsage: (nodeId: string) => CrossSliceUsageRef[];
};

export type CrossSliceParsedDocument = ParsedSliceProjection<Parsed>;

export function buildCrossSliceUsageIndex(slices: CrossSliceDocument[]): CrossSliceUsageIndex {
  return buildCrossSliceUsageIndexFromParsed(
    slices.map((slice) => ({ id: slice.id, dsl: slice.dsl, parsed: parseDsl(slice.dsl) }))
  );
}

export function buildCrossSliceUsageIndexFromParsed(slices: CrossSliceParsedDocument[]): CrossSliceUsageIndex {
  const index: CrossSliceUsageIndex = {};

  for (const slice of slices) {
    for (const node of slice.parsed.nodes.values()) {
      if (!isTraceableNode(node)) {
        continue;
      }
      const nodeRef = toNodeAnalysisRefFromNode(node);
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
  return buildCrossSliceUsageIndex(slices)[toNodeAnalysisRef(nodeKey)]?.sliceRefs ?? [];
}

export function createCrossSliceUsageQuery(slices: CrossSliceDocument[]): CrossSliceUsageQuery {
  return createCrossSliceUsageQueryFromParsed(
    slices.map((slice) => ({ id: slice.id, dsl: slice.dsl, parsed: parseDsl(slice.dsl) }))
  );
}

export function createCrossSliceUsageQueryFromParsed(slices: CrossSliceParsedDocument[]): CrossSliceUsageQuery {
  const index = buildCrossSliceUsageIndexFromParsed(slices);
  return {
    getCrossSliceUsage(nodeId: string) {
      return index[toNodeAnalysisRef(nodeId)]?.sliceRefs ?? [];
    }
  };
}
