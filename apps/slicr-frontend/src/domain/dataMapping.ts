import { Edge, ParseWarning, VisualNode } from './types';
import { JSONPath } from 'jsonpath-plus';

export type MappingEntry = {
  targetKey: string;
  sourcePath: string;
  range: { from: number; to: number };
};

export const MISSING_DATA_VALUE = '<missing>';

export function parseUsesBlocks(dsl: string): Map<string, MappingEntry[]> {
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
    if (!currentNodeRef || !(trimmed.startsWith('uses:') || trimmed.startsWith('maps:'))) {
      continue;
    }

    const mapsIndent = getIndent(line);
    const mappings: MappingEntry[] = [];
    const sourceContexts: Array<{ indent: number; prefix: string }> = [];
    for (let next = i + 1; next < lines.length; next += 1) {
      const nextLine = lines[next];
      const nextTrimmed = nextLine.trim();
      if (!nextTrimmed) {
        continue;
      }
      if (getIndent(nextLine) <= mapsIndent) {
        break;
      }

      const nextIndent = getIndent(nextLine);
      while (sourceContexts.length > 0 && sourceContexts[sourceContexts.length - 1].indent >= nextIndent) {
        sourceContexts.pop();
      }

      if (isSourceContextHeader(nextTrimmed)) {
        sourceContexts.push({
          indent: nextIndent,
          prefix: nextTrimmed.slice(0, -1).trim()
        });
        continue;
      }

      const contextPrefix = sourceContexts.map((entry) => entry.prefix).join('.');
      const mapping = parseMappingLine(nextLine, lineStarts[next], contextPrefix || null);
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
  targetNodeKeyByRef?: Map<string, string>;
}): ParseWarning[] {
  const warnings: ParseWarning[] = [];
  const nodeByRef = new Map<string, VisualNode>();
  for (const node of input.nodes.values()) {
    nodeByRef.set(toNodeRef(node), node);
  }

  for (const [targetRef, mappings] of input.mappingsByRef.entries()) {
    const mappedTargetKey = input.targetNodeKeyByRef?.get(targetRef);
    const targetNode = mappedTargetKey
      ? input.nodes.get(mappedTargetKey)
      : nodeByRef.get(targetRef);
    if (!targetNode || mappings.length === 0) {
      continue;
    }

    const mappedData: Record<string, unknown> = {};
    const mappedKeys = new Set<string>();
    const baseData = isRecord(targetNode.data) ? targetNode.data : {};
    for (const mapping of mappings) {
      if (mapping.targetKey in baseData) {
        warnings.push({
          message: `Duplicate data key "${mapping.targetKey}" in node ${targetRef} (declared in both data and uses)`,
          range: mapping.range,
          level: 'warning'
        });
        continue;
      }

      const value = resolveMappingValue(input.nodes, input.edges, targetNode.key, mapping.sourcePath);
      if (value === undefined) {
        mappedData[mapping.targetKey] = MISSING_DATA_VALUE;
        mappedKeys.add(mapping.targetKey);
        warnings.push({
          message: `Missing data source for key "${mapping.targetKey}"`,
          range: mapping.range,
          level: 'warning'
        });
        continue;
      }
      mappedData[mapping.targetKey] = value;
      mappedKeys.add(mapping.targetKey);
    }

    const mergedData = { ...mappedData, ...baseData };
    targetNode.data = Object.keys(mergedData).length > 0 ? mergedData : null;
    targetNode.mappedDataKeys = mappedKeys.size > 0 ? mappedKeys : undefined;
  }

  return warnings;
}

function resolveMappingValue(
  nodes: Map<string, VisualNode>,
  edges: Edge[],
  targetNodeKey: string,
  sourcePath: string
): unknown {
  const collectFields = parseCollectFields(sourcePath);
  if (collectFields) {
    return resolveCollectedValues(nodes, edges, targetNodeKey, collectFields);
  }

  const predecessorKeys = edges.filter((edge) => edge.to === targetNodeKey).map((edge) => edge.from);
  for (const predecessorKey of predecessorKeys) {
    const predecessor = nodes.get(predecessorKey);
    if (!predecessor?.data) {
      continue;
    }
    const value = resolveSourcePathValue(predecessor.data, sourcePath);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function resolveCollectedValues(
  nodes: Map<string, VisualNode>,
  edges: Edge[],
  targetNodeKey: string,
  fieldRefs: string[]
) {
  const predecessorKeys = edges.filter((edge) => edge.to === targetNodeKey).map((edge) => edge.from);
  const collected: Array<Record<string, unknown>> = [];

  for (const predecessorKey of predecessorKeys) {
    const predecessor = nodes.get(predecessorKey);
    if (!predecessor?.data) {
      continue;
    }

    const item: Record<string, unknown> = {};
    let isComplete = true;
    for (const fieldRef of fieldRefs) {
      const value = resolveSourcePathValue(predecessor.data, fieldRef);
      if (value === undefined) {
        isComplete = false;
        break;
      }
      item[collectFieldKey(fieldRef)] = value;
    }

    if (isComplete) {
      collected.push(item);
    }
  }

  return collected;
}

function parseCollectFields(sourcePath: string): string[] | null {
  const match = sourcePath.match(/^collect\s*\(\s*\{([\s\S]*)\}\s*\)\s*$/);
  if (!match) {
    return null;
  }

  const fields = match[1]
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return fields.length > 0 ? fields : [];
}

function collectFieldKey(fieldRef: string): string {
  if (!fieldRef.startsWith('$')) {
    return fieldRef;
  }
  const cleaned = fieldRef.replace(/\[(?:\*|\?\([^\]]+\)|\d+)\]/g, '');
  const segments = cleaned.split('.').filter((segment) => segment !== '$' && segment.length > 0);
  return segments[segments.length - 1] ?? fieldRef;
}

function resolveSourcePathValue(data: Record<string, unknown>, sourcePath: string): unknown {
  if (sourcePath.startsWith('$')) {
    return getJsonPathValue(data, sourcePath);
  }
  return getPathValue(data, sourcePath);
}

function parseMappingLine(line: string, lineStart: number, contextPrefix: string | null): MappingEntry | null {
  const base = parseMappingLineWithoutContext(line, lineStart);
  if (!base) {
    return null;
  }
  if (contextPrefix && !line.includes('<-')) {
    return {
      ...base,
      sourcePath: `${contextPrefix}.${base.sourcePath}`
    };
  }
  return base;
}

function parseMappingLineWithoutContext(line: string, lineStart: number): MappingEntry | null {
  const contentStart = line.search(/\S/);
  if (contentStart === -1) {
    return null;
  }
  const content = line.slice(contentStart);
  const arrowIndex = content.indexOf('<-');
  if (arrowIndex === -1) {
    const key = normalizeMappingKey(content.trim());
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
  const targetKey = normalizeMappingKey(targetPart.trim());
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

function normalizeMappingKey(value: string): string {
  return value.replace(/^-+\s*/, '').trim();
}

function isSourceContextHeader(line: string): boolean {
  return line.endsWith(':') && !line.includes('<-');
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

function getJsonPathValue(data: Record<string, unknown>, sourcePath: string): unknown {
  try {
    const matches = JSONPath({
      path: sourcePath,
      json: data,
      wrap: true
    });
    if (!Array.isArray(matches) || matches.length === 0) {
      return undefined;
    }
    return matches[0];
  } catch {
    return undefined;
  }
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
