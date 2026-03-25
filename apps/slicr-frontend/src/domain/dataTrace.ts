import { MappingEntry, parseUsesBlocks } from './dataMapping';
import { JSONPath } from 'jsonpath-plus';
import { isTraceableNode } from './nodeTracing';
import { Edge, VisualNode } from './types';

type TraceInput = {
  dsl: string;
  nodes: Map<string, VisualNode>;
  edges: Edge[];
  maxDepth?: number;
};

type TraceRuntimeInput = TraceInput & {
  mappingsByRef: Map<string, MappingEntry[]>;
  maxDepth: number;
};

export type DataTraceQuery = {
  traceData: (nodeId: string, usesKey: string) => DataTraceResult | null;
};

export type DataTraceHop = {
  nodeKey: string;
  key: string;
};

export type DataTraceResult = {
  usesKey: string;
  hops: DataTraceHop[];
  source: unknown;
  contributors?: DataTraceContributor[];
};

export type DataTraceContributor = {
  label: string;
  hops: DataTraceHop[];
};

export function traceData(input: TraceInput, nodeKey: string, usesKey: string): DataTraceResult | null {
  const node = input.nodes.get(nodeKey);
  if (!node || !isTraceableNode(node)) {
    return null;
  }

  const mappingsByRef = parseUsesBlocks(input.dsl);
  return traceFromNode(
    { ...input, mappingsByRef, maxDepth: input.maxDepth ?? 20 },
    node,
    usesKey.trim(),
    usesKey
  );
}

export function createDataTraceQuery(input: TraceInput): DataTraceQuery {
  return {
    traceData(nodeId: string, usesKey: string) {
      return traceData(input, nodeId, usesKey);
    }
  };
}

function findPredecessorForPath(
  nodes: Map<string, VisualNode>,
  edges: Edge[],
  targetNodeKey: string,
  sourcePath: string
): VisualNode | null {
  const predecessors = edges
    .filter((edge) => edge.to === targetNodeKey)
    .map((edge) => nodes.get(edge.from))
    .filter((node): node is VisualNode => Boolean(node));
  for (const predecessor of predecessors) {
    if (resolvePathValue(predecessor.data, sourcePath) !== undefined) {
      return predecessor;
    }
  }
  return null;
}

function traceFromNode(
  input: TraceRuntimeInput,
  startNode: VisualNode,
  startKey: string,
  usesKeyLabel: string
): DataTraceResult {
  const hops: DataTraceHop[] = [];
  const visited = new Set<string>();
  let currentNode = startNode;
  let currentKey = startKey;

  for (let depth = 0; depth < input.maxDepth; depth += 1) {
    const nodeRef = toNodeRef(currentNode);
    const mappings = input.mappingsByRef.get(nodeRef) ?? [];
    const sourcePath = mappings.find((mapping) => mapping.targetKey === currentKey)?.sourcePath ?? currentKey;

    if (isCollectExpression(sourcePath)) {
      const contributors = findCollectContributors(input, currentNode.key, sourcePath);
      return {
        usesKey: usesKeyLabel,
        hops: [...hops, ...contributors.flatMap((entry) => entry.hops)],
        contributors,
        source: currentNode.data && typeof currentNode.data === 'object'
          ? currentNode.data[currentKey]
          : null
      };
    }

    const predecessor = findPredecessorForPath(input.nodes, input.edges, currentNode.key, sourcePath);
    if (!predecessor) {
      return {
        usesKey: usesKeyLabel,
        hops,
        source: null
      };
    }

    const visitKey = `${predecessor.key}:${sourcePath}`;
    if (visited.has(visitKey)) {
      return {
        usesKey: usesKeyLabel,
        hops,
        source: null
      };
    }
    visited.add(visitKey);

    hops.push({
      nodeKey: predecessor.key,
      key: sourcePath
    });

    const value = resolvePathValue(predecessor.data, sourcePath);
    const rootKey = rootKeyForSourcePath(sourcePath);
    if (!predecessor.mappedDataKeys?.has(rootKey)) {
      return {
        usesKey: usesKeyLabel,
        hops,
        source: value
      };
    }

    currentNode = predecessor;
    currentKey = rootKey;
  }

  return {
    usesKey: usesKeyLabel,
    hops,
    source: null
  };
}

function resolvePathValue(data: unknown, path: string): unknown {
  if (path.startsWith('$')) {
    return getJsonPathValue(data, path);
  }
  return getPathValue(data, path);
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

function getJsonPathValue(data: unknown, path: string): unknown {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  try {
    const values = JSONPath({
      path,
      json: data,
      wrap: true
    });
    if (!Array.isArray(values) || values.length === 0) {
      return undefined;
    }
    return values[0];
  } catch {
    return undefined;
  }
}

function rootKeyForSourcePath(sourcePath: string): string {
  if (sourcePath.startsWith('$')) {
    const match = sourcePath.match(/^\$\.(["']?)([a-zA-Z0-9_-]+)\1/);
    if (match) {
      return match[2];
    }
  }
  return sourcePath.split('.', 1)[0];
}

function isCollectExpression(sourcePath: string): boolean {
  return /^collect\s*\(\s*\{[\s\S]*\}\s*\)\s*$/.test(sourcePath);
}

function findCollectContributors(
  input: TraceRuntimeInput,
  targetNodeKey: string,
  sourcePath: string
): DataTraceContributor[] {
  const collectFields = parseCollectFields(sourcePath);
  if (!collectFields) {
    return [];
  }

  return input.edges
    .filter((edge) => edge.to === targetNodeKey)
    .map((edge) => input.nodes.get(edge.from))
    .filter((node): node is VisualNode => Boolean(node))
    .filter((node) => collectFields.every((field) => resolvePathValue(node.data, field) !== undefined))
    .map((node, index) => {
      const hops: DataTraceHop[] = [{ nodeKey: node.key, key: sourcePath }];
      for (const field of collectFields) {
        const traced = traceFromNode(input, node, rootKeyForSourcePath(field), rootKeyForSourcePath(field));
        for (const hop of traced.hops) {
          if (!hops.some((existing) => existing.nodeKey === hop.nodeKey && existing.key === hop.key)) {
            hops.push(hop);
          }
        }
      }
      return {
        label: `item[${index}]`,
        hops
      };
    });
}

function parseCollectFields(sourcePath: string): string[] | null {
  const match = sourcePath.match(/^collect\s*\(\s*\{([\s\S]*)\}\s*\)\s*$/);
  if (!match) {
    return null;
  }
  return match[1]
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function toNodeRef(node: VisualNode): string {
  return `${node.type}:${node.name}`;
}
