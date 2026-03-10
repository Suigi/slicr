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
