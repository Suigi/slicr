import { parseUsesBlocks } from './dataMapping';
import { traceData } from './dataTrace';
import { Edge, VisualNode } from './types';

export type DataIssueCode = 'missing-source' | 'ambiguous-source';

export type DataIssue = {
  code: DataIssueCode;
  severity: 'warning';
  sliceId: string | null;
  nodeKey: string;
  nodeRef: string;
  key: string;
  range: { from: number; to: number };
};

type IssueInput = {
  dsl: string;
  nodes: Map<string, VisualNode>;
  edges: Edge[];
  sliceId?: string;
  sourceOverrides?: Record<string, string>;
};

export function collectDataIssues(input: IssueInput): DataIssue[] {
  const issues: DataIssue[] = [];
  const mappingsByRef = parseUsesBlocks(input.dsl);
  const nodesByRef = new Map<string, VisualNode>();
  for (const node of input.nodes.values()) {
    if (isScenarioNodeKey(node.key)) {
      continue;
    }
    nodesByRef.set(`${node.type}:${node.name}`, node);
  }

  for (const [nodeRef, mappings] of mappingsByRef.entries()) {
    const node = nodesByRef.get(nodeRef);
    if (!node) {
      continue;
    }
    for (const mapping of mappings) {
      const ambiguousCandidates = getAmbiguousSourceCandidatesForPath(input, node.key, mapping.sourcePath);
      const override = input.sourceOverrides?.[`${node.key}:${mapping.targetKey}`];
      const hasValidOverride = override ? ambiguousCandidates.includes(override) : false;
      if (ambiguousCandidates.length > 1 && !hasValidOverride) {
        issues.push({
          code: 'ambiguous-source',
          severity: 'warning',
          sliceId: input.sliceId ?? null,
          nodeKey: node.key,
          nodeRef,
          key: mapping.targetKey,
          range: mapping.range
        });
      }

      const traced = traceData(input, node.key, mapping.targetKey);
      if (traced?.source !== null) {
        continue;
      }
      issues.push({
        code: 'missing-source',
        severity: 'warning',
        sliceId: input.sliceId ?? null,
        nodeKey: node.key,
        nodeRef,
        key: mapping.targetKey,
        range: mapping.range
      });
    }
  }

  return issues;
}

export function getAmbiguousSourceCandidates(input: IssueInput, nodeKey: string, key: string): string[] {
  const mappingsByRef = parseUsesBlocks(input.dsl);
  const node = input.nodes.get(nodeKey);
  if (!node) {
    return [];
  }
  if (isScenarioNodeKey(node.key)) {
    return getAmbiguousSourceCandidatesForPath(input, node.key, key);
  }
  const nodeRef = `${node.type}:${node.name}`;
  const mapping = mappingsByRef.get(nodeRef)?.find((entry) => entry.targetKey === key);
  const sourcePath = mapping?.sourcePath ?? key;
  return getAmbiguousSourceCandidatesForPath(input, node.key, sourcePath);
}

function isScenarioNodeKey(nodeKey: string): boolean {
  return nodeKey.startsWith('scn:');
}

function getAmbiguousSourceCandidatesForPath(input: IssueInput, nodeKey: string, sourcePath: string): string[] {
  return input.edges
    .filter((edge) => edge.to === nodeKey)
    .map((edge) => input.nodes.get(edge.from))
    .filter((candidate): candidate is VisualNode => Boolean(candidate))
    .filter((candidate) => getPathValue(candidate.data, sourcePath) !== undefined)
    .map((candidate) => candidate.key);
}

function getPathValue(data: unknown, path: string): unknown {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const segments = path.split('.').filter(Boolean);
  let current: unknown = data;
  for (const segment of segments) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    if (!(segment in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
