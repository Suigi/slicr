import type { OverviewNodeMetadata } from './diagramEngine';
import type { Parsed } from './types';
import type { ParsedSliceProjection } from './parsedSliceProjection';

export type OverviewBoundaryNode = {
  overviewNodeKey: string;
  sourceSliceId: string;
  sourceSliceName: string;
  sourceNodeKey: string;
  nodeType: string;
  nodeName: string;
  logicalRef: string;
  sliceIndex: number;
  hasIncoming: boolean;
  hasOutgoing: boolean;
};

export type OverviewCrossSliceLink = {
  key: string;
  logicalRef: string;
  fromOverviewNodeKey: string;
  toOverviewNodeKey: string;
  fromSliceId: string;
  toSliceId: string;
  fromSliceIndex: number;
  toSliceIndex: number;
  distance: number;
  renderMode: 'shared-node' | 'dashed-connector';
};

export function toCrossSliceLogicalRef(type: string, name: string): string {
  return `${type}:${name.replace(/@[^@]*$/, '')}`;
}

export function collectOverviewBoundaryNodes(
  parsedSlices: ParsedSliceProjection<Parsed>[],
  overviewNodeMetadataByKey: Map<string, OverviewNodeMetadata>
): OverviewBoundaryNode[] {
  const overviewNodeKeyBySliceNode = new Map<string, string>();

  for (const [overviewNodeKey, metadata] of overviewNodeMetadataByKey.entries()) {
    overviewNodeKeyBySliceNode.set(`${metadata.sourceSliceId}::${metadata.sourceNodeKey}`, overviewNodeKey);
  }

  return parsedSlices.flatMap((slice, sliceIndex) => {
    const scenarioOnlyNodeKeys = new Set(slice.parsed.scenarioOnlyNodeKeys);
    const diagramNodeKeys = new Set(
      [...slice.parsed.nodes.keys()].filter((nodeKey) => !scenarioOnlyNodeKeys.has(nodeKey))
    );
    const incomingCountByNodeKey = new Map<string, number>();
    const outgoingCountByNodeKey = new Map<string, number>();

    for (const edge of slice.parsed.edges) {
      if (!diagramNodeKeys.has(edge.from) || !diagramNodeKeys.has(edge.to)) {
        continue;
      }
      outgoingCountByNodeKey.set(edge.from, (outgoingCountByNodeKey.get(edge.from) ?? 0) + 1);
      incomingCountByNodeKey.set(edge.to, (incomingCountByNodeKey.get(edge.to) ?? 0) + 1);
    }

    return [...slice.parsed.nodes.values()]
      .filter((node) => !scenarioOnlyNodeKeys.has(node.key))
      .flatMap((node) => {
        const hasIncoming = (incomingCountByNodeKey.get(node.key) ?? 0) > 0;
        const hasOutgoing = (outgoingCountByNodeKey.get(node.key) ?? 0) > 0;
        if (hasIncoming && hasOutgoing) {
          return [];
        }

        const overviewNodeKey = overviewNodeKeyBySliceNode.get(`${slice.id}::${node.key}`);
        if (!overviewNodeKey) {
          return [];
        }

        return [{
          overviewNodeKey,
          sourceSliceId: slice.id,
          sourceSliceName: slice.parsed.sliceName,
          sourceNodeKey: node.key,
          nodeType: node.type,
          nodeName: node.name,
          logicalRef: toCrossSliceLogicalRef(node.type, node.name),
          sliceIndex,
          hasIncoming,
          hasOutgoing
        }];
      });
  });
}

export function deriveOverviewCrossSliceLinks(
  parsedSlices: ParsedSliceProjection<Parsed>[],
  overviewNodeMetadataByKey: Map<string, OverviewNodeMetadata>
): OverviewCrossSliceLink[] {
  const candidates = collectOverviewBoundaryNodes(parsedSlices, overviewNodeMetadataByKey);
  const sourceCandidatesByLogicalRef = new Map<string, OverviewBoundaryNode[]>();
  const targetCandidatesByLogicalRef = new Map<string, OverviewBoundaryNode[]>();

  for (const candidate of candidates) {
    if (!candidate.hasOutgoing) {
      const sourceCandidates = sourceCandidatesByLogicalRef.get(candidate.logicalRef) ?? [];
      sourceCandidates.push(candidate);
      sourceCandidatesByLogicalRef.set(candidate.logicalRef, sourceCandidates);
    }
    if (!candidate.hasIncoming) {
      const targetCandidates = targetCandidatesByLogicalRef.get(candidate.logicalRef) ?? [];
      targetCandidates.push(candidate);
      targetCandidatesByLogicalRef.set(candidate.logicalRef, targetCandidates);
    }
  }

  const links: OverviewCrossSliceLink[] = [];
  const seenPairs = new Set<string>();

  for (const [logicalRef, sourceCandidates] of sourceCandidatesByLogicalRef.entries()) {
    const targetCandidates = targetCandidatesByLogicalRef.get(logicalRef) ?? [];

    for (const sourceCandidate of sourceCandidates) {
      for (const targetCandidate of targetCandidates) {
        const distance = targetCandidate.sliceIndex - sourceCandidate.sliceIndex;
        if (distance <= 0) {
          continue;
        }

        const pairKey = `${sourceCandidate.overviewNodeKey}->${targetCandidate.overviewNodeKey}`;
        if (seenPairs.has(pairKey)) {
          continue;
        }
        seenPairs.add(pairKey);

        links.push({
          key: pairKey,
          logicalRef,
          fromOverviewNodeKey: sourceCandidate.overviewNodeKey,
          toOverviewNodeKey: targetCandidate.overviewNodeKey,
          fromSliceId: sourceCandidate.sourceSliceId,
          toSliceId: targetCandidate.sourceSliceId,
          fromSliceIndex: sourceCandidate.sliceIndex,
          toSliceIndex: targetCandidate.sliceIndex,
          distance,
          renderMode: distance === 1 ? 'shared-node' : 'dashed-connector'
        });
      }
    }
  }

  return links;
}
