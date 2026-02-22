import { Edge, ParseWarning, VisualNode } from './types';

export type MappingEntry = {
  targetKey: string;
  sourcePath: string;
  range: { from: number; to: number };
};

export const MISSING_DATA_VALUE = '<missing>';

export function parseMapsBlocks(dsl: string): Map<string, MappingEntry[]> {
  const lines = dsl.split('\n');
  const lineStarts = buildLineStarts(lines);
  const result = new Map<string, MappingEntry[]>();
  let currentNodeRef: string | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const nodeMatch = line.match(/^(rm|ui|cmd|evt|exc|aut|ext):([^\s"]+)/);
    if (nodeMatch) {
      currentNodeRef = `${nodeMatch[1]}:${nodeMatch[2]}`;
    }

    const trimmed = line.trim();
    if (!currentNodeRef || !trimmed.startsWith('maps:')) {
      continue;
    }

    const mapsIndent = getIndent(line);
    const mappings: MappingEntry[] = [];
    for (let next = i + 1; next < lines.length; next += 1) {
      const nextLine = lines[next];
      const nextTrimmed = nextLine.trim();
      if (!nextTrimmed) {
        continue;
      }
      if (getIndent(nextLine) <= mapsIndent) {
        break;
      }

      const mapping = parseMappingLine(nextLine, lineStarts[next]);
      if (mapping) {
        mappings.push(mapping);
      }
    }

    result.set(currentNodeRef, mappings);
  }

  return result;
}

export function applyMappingsToNodes(input: {
  nodes: Map<string, VisualNode>;
  edges: Edge[];
  mappingsByRef: Map<string, MappingEntry[]>;
}): ParseWarning[] {
  const warnings: ParseWarning[] = [];
  const nodeByRef = new Map<string, VisualNode>();
  for (const node of input.nodes.values()) {
    nodeByRef.set(toNodeRef(node), node);
  }

  for (const [targetRef, mappings] of input.mappingsByRef.entries()) {
    const targetNode = nodeByRef.get(targetRef);
    if (!targetNode || mappings.length === 0) {
      continue;
    }

    const mappedData: Record<string, unknown> = {};
    const baseData = isRecord(targetNode.data) ? targetNode.data : {};
    for (const mapping of mappings) {
      if (mapping.targetKey in baseData) {
        warnings.push({
          message: `Duplicate data key "${mapping.targetKey}" in node ${targetRef} (declared in both data and maps)`,
          range: mapping.range,
          level: 'warning'
        });
        continue;
      }

      const value = resolveMappingValue(input.nodes, input.edges, targetNode.key, mapping.sourcePath);
      if (value === undefined) {
        mappedData[mapping.targetKey] = MISSING_DATA_VALUE;
        warnings.push({
          message: `Missing data source for key "${mapping.targetKey}"`,
          range: mapping.range,
          level: 'warning'
        });
        continue;
      }
      mappedData[mapping.targetKey] = value;
    }

    const mergedData = { ...mappedData, ...baseData };
    targetNode.data = Object.keys(mergedData).length > 0 ? mergedData : null;
  }

  return warnings;
}

function resolveMappingValue(
  nodes: Map<string, VisualNode>,
  edges: Edge[],
  targetNodeKey: string,
  sourcePath: string
): unknown {
  const predecessorKeys = edges.filter((edge) => edge.to === targetNodeKey).map((edge) => edge.from);
  for (const predecessorKey of predecessorKeys) {
    const predecessor = nodes.get(predecessorKey);
    if (!predecessor?.data) {
      continue;
    }
    const value = getPathValue(predecessor.data, sourcePath);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function parseMappingLine(line: string, lineStart: number): MappingEntry | null {
  const contentStart = line.search(/\S/);
  if (contentStart === -1) {
    return null;
  }
  const content = line.slice(contentStart);
  const arrowIndex = content.indexOf('<-');
  if (arrowIndex === -1) {
    const key = content.trim();
    if (!key) {
      return null;
    }
    return {
      targetKey: key,
      sourcePath: key,
      range: {
        from: lineStart + contentStart,
        to: lineStart + contentStart + key.length
      }
    };
  }

  const targetPart = content.slice(0, arrowIndex);
  const targetKey = targetPart.trim();
  const sourcePath = content.slice(arrowIndex + 2).trim();
  if (!targetKey) {
    return null;
  }

  const targetStartOffset = targetPart.length - targetPart.trimStart().length;
  const targetEndOffset = targetPart.trimEnd().length;

  return {
    targetKey,
    sourcePath: sourcePath || targetKey,
    range: {
      from: lineStart + contentStart + targetStartOffset,
      to: lineStart + contentStart + targetEndOffset
    }
  };
}

function getPathValue(data: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.').filter(Boolean);
  if (segments.length === 0) {
    return undefined;
  }

  let current: unknown = data;
  for (const segment of segments) {
    if (!isRecord(current)) {
      return undefined;
    }
    if (!(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function getIndent(line: string): number {
  return (line.match(/^(\s*)/)?.[1] ?? '').length;
}

function buildLineStarts(lines: string[]) {
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  return starts;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toNodeRef(node: VisualNode): string {
  if (node.type === 'generic') {
    return node.name;
  }
  return `${node.type}:${node.name}`;
}
