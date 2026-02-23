import { parseUsesBlocks } from './dataMapping';
import { isTraceableNode } from './nodeTracing';
import { Edge, VisualNode } from './types';

type TraceInput = {
  dsl: string;
  nodes: Map<string, VisualNode>;
  edges: Edge[];
  maxDepth?: number;
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
};

export function traceData(input: TraceInput, nodeKey: string, usesKey: string): DataTraceResult | null {
  const node = input.nodes.get(nodeKey);
  if (!node || !isTraceableNode(node)) {
    return null;
  }

  const mappingsByRef = parseUsesBlocks(input.dsl);
  const maxDepth = input.maxDepth ?? 20;
  const hops: DataTraceHop[] = [];
  const visited = new Set<string>();
  let currentNode = node;
  let currentKey = usesKey.trim();

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const nodeRef = toNodeRef(currentNode);
    const mappings = mappingsByRef.get(nodeRef) ?? [];
    const sourcePath = mappings.find((mapping) => mapping.targetKey === currentKey)?.sourcePath ?? currentKey;
    const predecessor = findPredecessorForPath(input.nodes, input.edges, currentNode.key, sourcePath);
    if (!predecessor) {
      return {
        usesKey,
        hops,
        source: null
      };
    }

    const visitKey = `${predecessor.key}:${sourcePath}`;
    if (visited.has(visitKey)) {
      return {
        usesKey,
        hops,
        source: null
      };
    }
    visited.add(visitKey);

    hops.push({
      nodeKey: predecessor.key,
      key: sourcePath
    });

    const value = getPathValue(predecessor.data, sourcePath);
    const rootKey = sourcePath.split('.', 1)[0];
    if (!predecessor.mappedDataKeys?.has(rootKey)) {
      return {
        usesKey,
        hops,
        source: value
      };
    }

    currentNode = predecessor;
    currentKey = rootKey;
  }

  return {
    usesKey,
    hops,
    source: null
  };
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
    if (getPathValue(predecessor.data, sourcePath) !== undefined) {
      return predecessor;
    }
  }
  return null;
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

function toNodeRef(node: VisualNode): string {
  return `${node.type}:${node.name}`;
}
