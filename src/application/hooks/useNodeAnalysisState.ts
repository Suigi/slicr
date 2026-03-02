import { useEffect, useMemo, useState } from 'react';
import { createCrossSliceUsageQueryFromParsed } from '../../domain/crossSliceUsage';
import { collectDataIssues } from '../../domain/dataIssues';
import { getCrossSliceDataFromParsed } from '../../domain/crossSliceData';
import { toNodeAnalysisRef, toNodeAnalysisRefFromNode } from '../../domain/nodeAnalysisKey';
import { parseUsesBlocks } from '../../domain/dataMapping';
import { traceData } from '../../domain/dataTrace';
import type { Parsed } from '../../domain/types';
import type { ParsedSliceProjection } from '../../domain/parsedSliceProjection';
import { getSliceNameFromDsl } from '../../sliceLibrary';

type ParsedProjection = ParsedSliceProjection<Parsed>;

type UseNodeAnalysisStateArgs = {
  parsed: Parsed | null;
  currentDsl: string;
  selectedSliceId: string;
  selectedNodeKey: string | null;
  parsedSliceProjectionList: ParsedProjection[];
  parsedSliceProjections: Map<string, ParsedProjection>;
  crossSliceDataEnabled: boolean;
};

function isScenarioNodeKey(nodeKey: string) {
  return nodeKey.startsWith('scn:');
}

function toNodeRef(node: { type: string; name: string }) {
  return `${node.type}:${node.name}`;
}

function getUsesMappingsForNode(
  usesMappingsByRef: ReturnType<typeof parseUsesBlocks>,
  node: { key: string; type: string; name: string }
) {
  if (isScenarioNodeKey(node.key)) {
    return [];
  }
  return usesMappingsByRef.get(toNodeRef(node)) ?? [];
}

export function useNodeAnalysisState(args: UseNodeAnalysisStateArgs) {
  const {
    parsed,
    currentDsl,
    selectedSliceId,
    selectedNodeKey,
    parsedSliceProjectionList,
    parsedSliceProjections,
    crossSliceDataEnabled
  } = args;

  const [selectedNodePanelTab, setSelectedNodePanelTab] = useState<'usage' | 'crossSliceData' | 'trace'>('usage');
  const [sourceOverrides, setSourceOverrides] = useState<Record<string, string>>({});
  const [hoveredTraceNodeKey, setHoveredTraceNodeKey] = useState<string | null>(null);
  const [crossSliceDataExpandedKeys, setCrossSliceDataExpandedKeys] = useState<Record<string, boolean>>({});
  const [crossSliceTraceExpandedKeys, setCrossSliceTraceExpandedKeys] = useState<Record<string, boolean>>({});

  const selectedNode = useMemo(() => {
    if (!parsed || !selectedNodeKey) {
      return null;
    }
    return parsed.nodes.get(selectedNodeKey) ?? null;
  }, [parsed, selectedNodeKey]);

  const showDataTraceTab = selectedNode ? !isScenarioNodeKey(selectedNode.key) : false;

  useEffect(() => {
    if (!crossSliceDataEnabled && selectedNodePanelTab === 'crossSliceData') {
      setSelectedNodePanelTab('usage');
    }
  }, [crossSliceDataEnabled, selectedNodePanelTab]);

  useEffect(() => {
    if (!showDataTraceTab && selectedNodePanelTab === 'trace') {
      setSelectedNodePanelTab('usage');
    }
  }, [selectedNodePanelTab, showDataTraceTab]);

  const selectedNodeAnalysisRef = useMemo(() => {
    if (!selectedNode) {
      return null;
    }
    return toNodeAnalysisRefFromNode(selectedNode);
  }, [selectedNode]);

  const selectedNodeAnalysisHeader = useMemo(() => {
    if (!selectedNodeAnalysisRef) {
      return { type: '', key: '' };
    }
    const splitAt = selectedNodeAnalysisRef.indexOf(':');
    if (splitAt < 0) {
      return { type: '', key: selectedNodeAnalysisRef };
    }
    return {
      type: selectedNodeAnalysisRef.slice(0, splitAt),
      key: selectedNodeAnalysisRef.slice(splitAt + 1)
    };
  }, [selectedNodeAnalysisRef]);

  const selectedNodeAnalysisNodes = useMemo(() => {
    if (!parsed || !selectedNodeAnalysisRef || !selectedNode) {
      return [];
    }
    if (isScenarioNodeKey(selectedNode.key)) {
      return [selectedNode];
    }
    return [...parsed.nodes.values()].filter((node) => toNodeAnalysisRefFromNode(node) === selectedNodeAnalysisRef);
  }, [parsed, selectedNode, selectedNodeAnalysisRef]);

  const usesMappingsByRef = useMemo(() => parseUsesBlocks(currentDsl), [currentDsl]);

  const crossSliceUsage = useMemo(() => {
    if (!selectedNodeAnalysisRef) {
      return [];
    }
    const query = createCrossSliceUsageQueryFromParsed(parsedSliceProjectionList);
    return query.getCrossSliceUsage(selectedNodeAnalysisRef);
  }, [parsedSliceProjectionList, selectedNodeAnalysisRef]);

  const dataIssues = useMemo(() => {
    if (!parsed) {
      return [];
    }
    return collectDataIssues({
      dsl: currentDsl,
      nodes: parsed.nodes,
      edges: parsed.edges,
      sliceId: selectedSliceId,
      sourceOverrides
    });
  }, [currentDsl, selectedSliceId, parsed, sourceOverrides]);

  const selectedNodeIssues = useMemo(() => {
    if (!selectedNodeAnalysisRef || !selectedNode) {
      return [];
    }
    if (isScenarioNodeKey(selectedNode.key)) {
      return dataIssues.filter((issue) => issue.nodeKey === selectedNode.key);
    }
    return dataIssues.filter((issue) => toNodeAnalysisRef(issue.nodeRef) === selectedNodeAnalysisRef);
  }, [dataIssues, selectedNode, selectedNodeAnalysisRef]);

  const selectedNodeIssuesByKey = useMemo(() => {
    const grouped: Record<string, typeof selectedNodeIssues> = {};
    for (const issue of selectedNodeIssues) {
      grouped[issue.key] ??= [];
      grouped[issue.key].push(issue);
    }
    return grouped;
  }, [selectedNodeIssues]);

  const missingSourceIssueKeys = useMemo(
    () => new Set(selectedNodeIssues.filter((issue) => issue.code === 'missing-source').map((issue) => issue.key)),
    [selectedNodeIssues]
  );

  const selectedNodeUsesKeys = useMemo(() => {
    if (!selectedNode || isScenarioNodeKey(selectedNode.key)) {
      return [];
    }
    const seen = new Set<string>();
    const mappings = getUsesMappingsForNode(usesMappingsByRef, selectedNode);
    for (const mapping of mappings) {
      seen.add(mapping.targetKey);
    }
    return [...seen].sort((left, right) => left.localeCompare(right));
  }, [selectedNode, usesMappingsByRef]);

  const selectedNodeCrossSliceData = useMemo(() => {
    if (!selectedNodeAnalysisRef) {
      return { keys: [], byKey: {} };
    }
    return getCrossSliceDataFromParsed(parsedSliceProjectionList, selectedNodeAnalysisRef);
  }, [parsedSliceProjectionList, selectedNodeAnalysisRef]);

  const selectedNodeTraceResultsByKey = useMemo(() => {
    if (!parsed || !selectedNode) {
      return {} as Record<string, Array<{ nodeKey: string; result: NonNullable<ReturnType<typeof traceData>> }>>;
    }

    const byKey: Record<string, Array<{ nodeKey: string; result: NonNullable<ReturnType<typeof traceData>> }>> = {};
    for (const traceKey of selectedNodeUsesKeys) {
      byKey[traceKey] = [selectedNode.key]
        .map((nodeKey) => ({
          nodeKey,
          result: traceData({ dsl: currentDsl, nodes: parsed.nodes, edges: parsed.edges }, nodeKey, traceKey)
        }))
        .filter(
          (entry): entry is { nodeKey: string; result: NonNullable<ReturnType<typeof traceData>> } => entry.result !== null
        );
    }

    return byKey;
  }, [currentDsl, parsed, selectedNode, selectedNodeUsesKeys]);

  const crossSliceUsageEntries = useMemo(() => {
    return crossSliceUsage.map((usage) => {
      const projection = parsedSliceProjections.get(usage.sliceId) ?? null;
      const sliceName = projection ? getSliceNameFromDsl(projection.dsl) : usage.sliceId;
      const usageNode = projection ? projection.parsed.nodes.get(usage.nodeKey) ?? null : null;
      return {
        usage,
        sliceName,
        node: usageNode
      };
    });
  }, [crossSliceUsage, parsedSliceProjections]);

  const crossSliceUsageGroups = useMemo(() => {
    const grouped = new Map<string, { sliceId: string; sliceName: string; entries: typeof crossSliceUsageEntries }>();
    for (const entry of crossSliceUsageEntries) {
      const existing = grouped.get(entry.usage.sliceId);
      if (existing) {
        existing.entries.push(entry);
        continue;
      }
      grouped.set(entry.usage.sliceId, {
        sliceId: entry.usage.sliceId,
        sliceName: entry.usage.sliceId === selectedSliceId ? `${entry.sliceName} (this Slice)` : entry.sliceName,
        entries: [entry]
      });
    }
    return [...grouped.values()].map((group) => ({
      ...group,
      entries: [...group.entries].sort((left, right) => left.usage.nodeKey.localeCompare(right.usage.nodeKey))
    }));
  }, [crossSliceUsageEntries, selectedSliceId]);

  return {
    selectedNode,
    selectedNodePanelTab,
    setSelectedNodePanelTab,
    sourceOverrides,
    setSourceOverrides,
    hoveredTraceNodeKey,
    setHoveredTraceNodeKey,
    crossSliceDataExpandedKeys,
    setCrossSliceDataExpandedKeys,
    crossSliceTraceExpandedKeys,
    setCrossSliceTraceExpandedKeys,
    selectedNodeAnalysisRef,
    selectedNodeAnalysisHeader,
    selectedNodeAnalysisNodes,
    selectedNodeIssues,
    selectedNodeIssuesByKey,
    missingSourceIssueKeys,
    selectedNodeUsesKeys,
    selectedNodeCrossSliceData,
    selectedNodeTraceResultsByKey,
    crossSliceUsageGroups,
    showDataTraceTab
  };
}
