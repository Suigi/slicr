import { parseUsesBlocks } from './dataMapping';
import { traceData } from './dataTrace';
import { Edge, VisualNode } from './types';

export type DataIssueCode = 'missing-source' | 'ambiguous-source';

export type DataIssue = {
  code: DataIssueCode;
  severity: 'warning';
  nodeKey: string;
  key: string;
  range: { from: number; to: number };
};

type IssueInput = {
  dsl: string;
  nodes: Map<string, VisualNode>;
  edges: Edge[];
};

export function collectDataIssues(input: IssueInput): DataIssue[] {
  const issues: DataIssue[] = [];
  const mappingsByRef = parseUsesBlocks(input.dsl);
  const nodesByRef = new Map<string, VisualNode>();
  for (const node of input.nodes.values()) {
    nodesByRef.set(`${node.type}:${node.name}`, node);
  }

  for (const [nodeRef, mappings] of mappingsByRef.entries()) {
    const node = nodesByRef.get(nodeRef);
    if (!node) {
      continue;
    }
    for (const mapping of mappings) {
      const ambiguousCandidates = input.edges
        .filter((edge) => edge.to === node.key)
        .map((edge) => input.nodes.get(edge.from))
        .filter((candidate): candidate is VisualNode => Boolean(candidate))
        .filter((candidate) => getPathValue(candidate.data, mapping.sourcePath) !== undefined);
      if (ambiguousCandidates.length > 1) {
        issues.push({
          code: 'ambiguous-source',
          severity: 'warning',
          nodeKey: node.key,
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
        nodeKey: node.key,
        key: mapping.targetKey,
        range: mapping.range
      });
    }
  }

  return issues;
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
