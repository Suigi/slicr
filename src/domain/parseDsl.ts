import { parser } from '../slicr.parser';
import * as terms from '../slicr.parser.terms';
import { applyMappingsToNodes, parseMapsBlocks } from './dataMapping';
import { validateDataIntegrity } from './dataIntegrity';
import { Edge, NodeData, Parsed, ParseWarning, SliceBoundary, VisualNode } from './types';

type NodeSpec = {
  line: number;
  type: string;
  name: string;
  alias: string | null;
  stream: string | null;
  incoming: ArtifactRef[];
  outgoing: ArtifactRef[];
  data: NodeData;
  srcRange: { from: number; to: number };
  dataEndPos?: number;
  dataKeyRanges?: Record<string, { from: number; to: number }>;
};

type ArtifactRef = {
  type: string;
  name: string;
};

type YamlEntry = {
  indent: number;
  text: string;
};

type ParseCursor = {
  type: { id: number };
  from: number;
  to: number;
  firstChild: () => boolean;
  nextSibling: () => boolean;
  parent: () => boolean;
  next: () => boolean;
};

type EdgeClauseSpec = {
  line: number;
  incoming: ArtifactRef[];
  outgoing: ArtifactRef[];
  from: number;
  to: number;
};

type StreamClauseSpec = {
  line: number;
  stream: string;
};

export function parseDsl(src: string): Parsed {
  const tree = parser.parse(src);
  const lines = src.split('\n');
  const lineStarts = buildLineStarts(lines);
  const boundaryLines = collectBoundaryLines(lines);
  const mapsBodyLines = collectMapsBodyLines(lines);
  const mappingsByRef = parseMapsBlocks(src);

  const nodes = new Map<string, VisualNode>();
  const edges: Edge[] = [];
  const warnings: ParseWarning[] = [];
  const boundaries: SliceBoundary[] = [];
  let sliceName = '';
  const specs: NodeSpec[] = [];
  const edgeClauses: EdgeClauseSpec[] = [];
  const streamClauses: StreamClauseSpec[] = [];

  const cursor: ParseCursor = tree.cursor();
  do {
    if (cursorTypeId(cursor) === terms.SliceStatement) {
      cursor.firstChild(); // Move to kw<"slice">
      const movedToSliceName = cursor.nextSibling();
      if (movedToSliceName && cursorTypeId(cursor) === terms.String) {
        const raw = src.slice(cursor.from, cursor.to);
        sliceName = raw.slice(1, -1); // Remove quotes
      }
      cursor.parent();
      continue;
    }

    if (cursorTypeId(cursor) === terms.NodeStatement) {
      // Ensure the node is at the start of a line (no leading whitespace in DSL for top-level nodes)
      const lineIndex = getLineIndexAtPos(lineStarts, cursor.from);
      const lineStart = lineStarts[lineIndex];
      const prefix = src.slice(lineStart, cursor.from);
      if (prefix.length > 0) {
        continue;
      }

      const parsed = parseNodeStatement(cursor, src);
      if (!parsed) {
        continue;
      }

      specs.push({
        line: lineIndex,
        type: parsed.target.type,
        name: parsed.target.name,
        alias: parsed.alias,
        stream: null,
        incoming: parsed.incoming,
        outgoing: parsed.outgoing,
        data: null,
        srcRange: { from: cursor.from, to: cursor.to }
      });
      continue;
    }

    if (cursorTypeId(cursor) === terms.EdgeStatement) {
      const parsed = parseEdgeStatement(cursor, src);
      if (!parsed) {
        continue;
      }

      const lineIndex = getLineIndexAtPos(lineStarts, cursor.from);
      if (mapsBodyLines.has(lineIndex)) {
        continue;
      }
      edgeClauses.push({
        line: lineIndex,
        incoming: parsed.incoming,
        outgoing: parsed.outgoing,
        from: cursor.from,
        to: cursor.to
      });
      continue;
    }

    if (cursorTypeId(cursor) === terms.StreamStatement) {
      const parsed = parseStreamStatement(cursor, src);
      if (!parsed) {
        continue;
      }

      const lineIndex = getLineIndexAtPos(lineStarts, cursor.from);
      streamClauses.push({ line: lineIndex, stream: parsed.stream });
    }
  } while (cursor.next());

  attachStandaloneEdgeClauses(specs, edgeClauses);
  attachStandaloneStreamClauses(specs, streamClauses);

  attachDataBlocks(lines, specs, lineStarts);

  const refToKey = new Map<string, string>();
  const refToSpec = new Map<string, NodeSpec>();
  const usedKeys = new Set<string>();
  const unresolvedEdges: Array<{ fromRef: string; toRef: string; range: { from: number; to: number } }> = [];
  const unresolvedEdgeSet = new Set<string>();

  for (const spec of specs) {
    const ref = toRefId(spec.type, spec.name);
    if (!refToSpec.has(ref)) {
      refToSpec.set(ref, spec);
    }
    let key = refToKey.get(ref);
    if (!key) {
      key = pickNodeKey(spec, usedKeys);
      refToKey.set(ref, key);
      usedKeys.add(key);
    }

    const finalRange = spec.dataEndPos
      ? { from: spec.srcRange.from, to: spec.dataEndPos }
      : spec.srcRange;

    if (!nodes.has(key)) {
      nodes.set(key, {
        type: spec.type,
        name: spec.name,
        alias: spec.alias,
        stream: spec.stream,
        key,
        data: spec.data,
        srcRange: finalRange,
        dataKeyRanges: spec.dataKeyRanges
      });
    } else if (spec.data || spec.alias || spec.stream) {
      const existing = nodes.get(key);
      if (existing) {
        if (!existing.alias && spec.alias) {
          existing.alias = spec.alias;
        }
        if (!existing.stream && spec.stream) {
          existing.stream = spec.stream;
        }
        if (spec.data) {
          existing.data = spec.data;
          existing.srcRange = finalRange;
          existing.dataKeyRanges = spec.dataKeyRanges;
        }
      }
    }

    for (const from of spec.incoming) {
      const fromRef = toRefId(from.type, from.name);
      const edgeKey = `${fromRef}->${ref}`;
      if (unresolvedEdgeSet.has(edgeKey)) {
        continue;
      }
      unresolvedEdgeSet.add(edgeKey);
      unresolvedEdges.push({ fromRef, toRef: ref, range: spec.srcRange });
    }

    for (const to of spec.outgoing) {
      const toRef = toRefId(to.type, to.name);
      const edgeKey = `${ref}->${toRef}`;
      if (unresolvedEdgeSet.has(edgeKey)) {
        continue;
      }
      unresolvedEdgeSet.add(edgeKey);
      unresolvedEdges.push({ fromRef: ref, toRef, range: spec.srcRange });
    }
  }

  for (const edge of unresolvedEdges) {
    const from = refToKey.get(edge.fromRef);
    const to = refToKey.get(edge.toRef);
    if (from && to) {
      edges.push({ from, to, label: null });
    } else if (shouldWarnUnresolvedDependency(edge.fromRef, edge.toRef)) {
      warnings.push({
        message: `Unresolved dependency: ${edge.fromRef} -> ${edge.toRef}`,
        range: edge.range,
        level: 'error'
      });
    }
  }

  warnings.push(...applyMappingsToNodes({ nodes, edges, mappingsByRef }));
  warnings.push(...validateDataIntegrity({ nodes, edges }));
  boundaries.push(...resolveBoundaries(specs, boundaryLines, refToKey));

  return { sliceName, nodes, edges, warnings, boundaries };
}

function collectBoundaryLines(lines: string[]) {
  const boundaryLines: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      boundaryLines.push(i);
    }
  }
  return boundaryLines;
}

function collectMapsBodyLines(lines: string[]) {
  const mapLines = new Set<number>();
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!line.trim().startsWith('maps:')) {
      continue;
    }

    const mapsIndent = (line.match(/^(\s*)/)?.[1] ?? '').length;
    for (let next = lineIndex + 1; next < lines.length; next += 1) {
      const nextLine = lines[next];
      if (!nextLine.trim()) {
        continue;
      }
      const nextIndent = (nextLine.match(/^(\s*)/)?.[1] ?? '').length;
      if (nextIndent <= mapsIndent) {
        break;
      }
      mapLines.add(next);
    }
  }
  return mapLines;
}

function resolveBoundaries(specs: NodeSpec[], boundaryLines: number[], refToKey: Map<string, string>): SliceBoundary[] {
  if (specs.length === 0 || boundaryLines.length === 0) {
    return [];
  }

  const boundaries: SliceBoundary[] = [];
  let specIndex = 0;
  let lastSpec: NodeSpec | null = null;

  for (const boundaryLine of boundaryLines) {
    while (specIndex < specs.length && specs[specIndex].line < boundaryLine) {
      lastSpec = specs[specIndex];
      specIndex += 1;
    }

    if (!lastSpec) {
      continue;
    }

    const key = refToKey.get(toRefId(lastSpec.type, lastSpec.name));
    if (!key) {
      continue;
    }
    if (boundaries.length > 0 && boundaries[boundaries.length - 1].after === key) {
      continue;
    }
    boundaries.push({ after: key });
  }

  return boundaries;
}

function parseNodeStatement(cursor: ParseCursor, src: string) {
  if (!cursor.firstChild()) {
    return null;
  }

  let target: ArtifactRef | null = null;
  let alias: string | null = null;
  do {
    const typeId = cursorTypeId(cursor);
    if (typeId === terms.ArtifactRef && !target) {
      target = parseArtifactRef(cursor, src);
      continue;
    }
    if (typeId === terms.String && alias === null) {
      alias = unquote(src.slice(cursor.from, cursor.to));
    }
  } while (cursor.nextSibling());

  if (!target) {
    cursor.parent();
    return null;
  }

  const incoming: ArtifactRef[] = [];
  const outgoing: ArtifactRef[] = [];

  cursor.parent();
  return { target, alias, incoming, outgoing };
}

function parseEdgeStatement(cursor: ParseCursor, src: string) {
  if (!cursor.firstChild()) {
    return null;
  }

  const incoming: ArtifactRef[] = [];
  const outgoing: ArtifactRef[] = [];
  if (cursorTypeId(cursor) === terms.IncomingClause) {
    incoming.push(...parseClauseRefs(cursor, src));
  } else if (cursorTypeId(cursor) === terms.OutgoingClause) {
    outgoing.push(...parseClauseRefs(cursor, src));
  }
  cursor.parent();
  return { incoming, outgoing };
}

function parseStreamStatement(cursor: ParseCursor, src: string) {
  if (!cursor.firstChild()) {
    return null;
  }

  let stream: string | null = null;
  do {
    const tid = cursorTypeId(cursor);
    if (tid === terms.String) {
      stream = unquote(src.slice(cursor.from, cursor.to));
      break;
    }
    if (tid === terms.Identifier) {
      stream = src.slice(cursor.from, cursor.to);
      break;
    }
  } while (cursor.nextSibling());

  cursor.parent();
  if (!stream) {
    return null;
  }

  return { stream };
}

function parseClauseRefs(cursor: ParseCursor, src: string): ArtifactRef[] {
  const refs: ArtifactRef[] = [];
  cursor.firstChild(); // Arrow token
  while (cursor.nextSibling()) {
    if (cursorTypeId(cursor) !== terms.ArtifactRef) {
      continue;
    }
    const ref = parseArtifactRef(cursor, src);
    if (ref) {
      refs.push(ref);
    }
  }
  cursor.parent();
  return refs;
}

function attachStandaloneEdgeClauses(specs: NodeSpec[], edgeClauses: EdgeClauseSpec[]) {
  if (specs.length === 0 || edgeClauses.length === 0) {
    return;
  }

  let specIndex = 0;
  for (const clause of edgeClauses) {
    while (specIndex + 1 < specs.length && specs[specIndex + 1].line <= clause.line) {
      specIndex += 1;
    }

    if (specs[specIndex].line > clause.line) {
      continue;
    }

    const owner = specs[specIndex];
    owner.incoming.push(...clause.incoming);
    owner.outgoing.push(...clause.outgoing);
    if (owner.line === clause.line) {
      owner.srcRange.to = Math.max(owner.srcRange.to, clause.to);
    }
  }
}

function attachStandaloneStreamClauses(specs: NodeSpec[], streamClauses: StreamClauseSpec[]) {
  if (specs.length === 0 || streamClauses.length === 0) {
    return;
  }

  let specIndex = 0;
  for (const clause of streamClauses) {
    while (specIndex + 1 < specs.length && specs[specIndex + 1].line <= clause.line) {
      specIndex += 1;
    }

    if (specs[specIndex].line > clause.line) {
      continue;
    }

    const owner = specs[specIndex];
    if (owner.type === 'evt') {
      owner.stream = clause.stream;
    }
  }
}

function parseArtifactRef(cursor: ParseCursor, src: string): ArtifactRef | null {
  if (cursorTypeId(cursor) !== terms.ArtifactRef) {
    return null;
  }

  cursor.firstChild(); // Move to specific ref (RmRef, UiRef, etc.)
  const typeId = cursorTypeId(cursor);

  let type = '';
  if (typeId === terms.RmRef) type = 'rm';
  else if (typeId === terms.UiRef) type = 'ui';
  else if (typeId === terms.CmdRef) type = 'cmd';
  else if (typeId === terms.EvtRef) type = 'evt';
  else if (typeId === terms.ExcRef) type = 'exc';
  else if (typeId === terms.AutRef) type = 'aut';
  else if (typeId === terms.ExtRef) type = 'ext';
  else if (typeId === terms.GenericRef) type = 'generic';

  if (!type) {
    cursor.parent();
    return null;
  }

  let name = '';
  let version = '';

  // Traverse children of the specific ref to find Name and Version
  cursor.firstChild();
  do {
    const tid = cursorTypeId(cursor);
    if (
      tid === terms.RmName ||
      tid === terms.UiName ||
      tid === terms.CmdName ||
      tid === terms.EvtName ||
      (typeId === terms.GenericRef && tid === terms.Identifier && name === '')
    ) {
      name = src.slice(cursor.from, cursor.to);
    } else if (tid === terms.Identifier && name === '') {
      // For ExcRef, AutRef, ExtRef which use Identifier directly in grammar
      name = src.slice(cursor.from, cursor.to);
    } else if (tid === terms.Version) {
      version = src.slice(cursor.from, cursor.to);
    }
  } while (cursor.nextSibling());

  cursor.parent(); // Back to specific ref
  cursor.parent(); // Back to ArtifactRef

  return { type, name: name + version };
}

function toRefId(type: string, name: string) {
  return `${type}:${name}`;
}

function unquote(value: string) {
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

function cursorTypeId(cursor: ParseCursor) {
  return cursor.type.id;
}

function shouldWarnUnresolvedDependency(fromRef: string, toRef: string) {
  const fromType = fromRef.split(':', 1)[0];
  const toType = toRef.split(':', 1)[0];

  // Commands can originate outside the slice and trigger an event entrypoint.
  return !(fromType === 'cmd' && toType === 'evt');


}

function pickNodeKey(spec: NodeSpec, usedKeys: Set<string>) {
  if (!usedKeys.has(spec.name)) {
    return spec.name;
  }

  const typed = `${spec.type}:${spec.name}`;
  if (!usedKeys.has(typed)) {
    return typed;
  }

  let suffix = 2;
  while (usedKeys.has(`${typed}#${suffix}`)) {
    suffix += 1;
  }
  return `${typed}#${suffix}`;
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

function getLineIndexAtPos(lineStarts: number[], pos: number) {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const start = lineStarts[mid];
    const nextStart = mid + 1 < lineStarts.length ? lineStarts[mid + 1] : Number.POSITIVE_INFINITY;
    if (pos >= start && pos < nextStart) {
      return mid;
    }
    if (pos < start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return Math.max(0, lineStarts.length - 1);
}

function attachDataBlocks(lines: string[], specs: NodeSpec[], lineStarts: number[]) {
  let specCursor = 0;
  let lastSpecIndex: number | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    while (specCursor < specs.length && specs[specCursor].line <= lineIndex) {
      lastSpecIndex = specCursor;
      specCursor += 1;
    }

    const line = lines[lineIndex];
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:') || lastSpecIndex === null) {
      continue;
    }

    const dataIndent = (line.match(/^(\s*)/)?.[1] ?? '').length;
    const inlineRaw = trimmed.slice('data:'.length).trim();
    if (inlineRaw) {
      try {
        specs[lastSpecIndex].data = JSON.parse(inlineRaw) as Record<string, unknown>;
        specs[lastSpecIndex].dataEndPos = lineStarts[lineIndex] + line.length;
      } catch {
        // Keep parity with previous behavior: ignore malformed data blocks.
      }
      continue;
    }

    const blockLines: string[] = [];
    let lastNonEmptyNext = lineIndex;
    for (let next = lineIndex + 1; next < lines.length; next += 1) {
      const nextLine = lines[next];
      if (!nextLine.trim()) {
        blockLines.push(nextLine);
        continue;
      }

      const nextIndent = (nextLine.match(/^(\s*)/)?.[1] ?? '').length;
      if (nextIndent <= dataIndent) {
        break;
      }

      blockLines.push(nextLine);
      lastNonEmptyNext = next;
    }

    const parsedYaml = parseYamlBlock(blockLines);
    if (parsedYaml) {
      specs[lastSpecIndex].data = parsedYaml;
      specs[lastSpecIndex].dataKeyRanges = collectTopLevelYamlKeyRanges({
        lines,
        lineStarts,
        blockLineIndices: collectLineIndices(lineIndex + 1, lastNonEmptyNext)
      });
      specs[lastSpecIndex].dataEndPos = lineStarts[lastNonEmptyNext] + lines[lastNonEmptyNext].length;
    }
  }
}

function collectLineIndices(from: number, to: number): number[] {
  const result: number[] = [];
  for (let index = from; index <= to; index += 1) {
    result.push(index);
  }
  return result;
}

function collectTopLevelYamlKeyRanges(input: {
  lines: string[];
  lineStarts: number[];
  blockLineIndices: number[];
}): Record<string, { from: number; to: number }> | undefined {
  const entries = input.blockLineIndices
    .map((lineIndex) => {
      const line = input.lines[lineIndex];
      return {
        lineIndex,
        line,
        trimmed: line.trim(),
        indent: (line.match(/^(\s*)/)?.[1] ?? '').length
      };
    })
    .filter((entry) => entry.trimmed.length > 0);

  if (entries.length === 0) {
    return undefined;
  }

  const baseIndent = Math.min(...entries.map((entry) => entry.indent));
  const keyRanges: Record<string, { from: number; to: number }> = {};

  for (const entry of entries) {
    if (entry.indent !== baseIndent || entry.trimmed.startsWith('- ')) {
      continue;
    }

    const match = entry.trimmed.match(/^([^:]+):(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1].trim();
    if (!key) {
      continue;
    }

    const trimmedOffset = entry.line.length - entry.trimmed.length;
    const keyOffset = entry.trimmed.indexOf(match[1]);
    const from = input.lineStarts[entry.lineIndex] + trimmedOffset + Math.max(0, keyOffset);
    keyRanges[key] = { from, to: from + key.length };
  }

  return Object.keys(keyRanges).length > 0 ? keyRanges : undefined;
}

function parseYamlBlock(lines: string[]) {
  const entries = lines
    .map((line) => ({
      indent: (line.match(/^(\s*)/)?.[1] ?? '').length,
      text: line.trim()
    }))
    .filter((entry) => entry.text.length > 0);

  if (entries.length === 0) {
    return null;
  }

  const baseIndent = Math.min(...entries.map((entry) => entry.indent));
  const normalized = entries.map((entry) => ({
    indent: entry.indent - baseIndent,
    text: entry.text
  }));

  let index = 0;
  const value = parseYamlNode(normalized, () => index, (next) => {
    index = next;
  }, normalized[0].indent);

  if (value === undefined || index !== normalized.length) {
    return null;
  }

  return isRecord(value) ? value : null;
}

function parseYamlNode(
  entries: YamlEntry[],
  getIndex: () => number,
  setIndex: (index: number) => void,
  indent: number
): unknown {
  const index = getIndex();
  if (index >= entries.length || entries[index].indent !== indent) {
    return undefined;
  }

  if (entries[index].text.startsWith('- ')) {
    return parseYamlArray(entries, getIndex, setIndex, indent);
  }

  return parseYamlObject(entries, getIndex, setIndex, indent);
}

function parseYamlArray(
  entries: YamlEntry[],
  getIndex: () => number,
  setIndex: (index: number) => void,
  indent: number
) {
  const values: unknown[] = [];

  while (getIndex() < entries.length) {
    const current = entries[getIndex()];
    if (current.indent !== indent || !current.text.startsWith('- ')) {
      break;
    }

    const itemText = current.text.slice(2).trim();
    setIndex(getIndex() + 1);

    if (!itemText) {
      const next = entries[getIndex()];
      if (!next || next.indent <= indent) {
        values.push(null);
      } else {
        values.push(parseYamlNode(entries, getIndex, setIndex, next.indent) ?? null);
      }
      continue;
    }

    const inlineObject = parseInlineYamlProperty(itemText);
    if (inlineObject) {
      const objectValue: Record<string, unknown> = {};
      objectValue[inlineObject.key] = inlineObject.value;

      while (getIndex() < entries.length) {
        const next = entries[getIndex()];
        if (next.indent <= indent || next.text.startsWith('- ')) {
          break;
        }

        const nested = parseObjectProperty(entries, getIndex, setIndex, next.indent);
        if (!nested) {
          return undefined;
        }
        objectValue[nested.key] = nested.value;
      }

      values.push(objectValue);
      continue;
    }

    values.push(parseYamlScalar(itemText));
  }

  return values;
}

function parseYamlObject(
  entries: YamlEntry[],
  getIndex: () => number,
  setIndex: (index: number) => void,
  indent: number
) {
  const value: Record<string, unknown> = {};

  while (getIndex() < entries.length) {
    const current = entries[getIndex()];
    if (current.indent !== indent || current.text.startsWith('- ')) {
      break;
    }

    const property = parseObjectProperty(entries, getIndex, setIndex, indent);
    if (!property) {
      return undefined;
    }

    value[property.key] = property.value;
  }

  return value;
}

function parseObjectProperty(
  entries: YamlEntry[],
  getIndex: () => number,
  setIndex: (index: number) => void,
  indent: number
) {
  const entry = entries[getIndex()];
  if (!entry || entry.indent !== indent || entry.text.startsWith('- ')) {
    return null;
  }

  const parsed = parseInlineYamlProperty(entry.text);
  if (!parsed) {
    return null;
  }

  setIndex(getIndex() + 1);
  if (parsed.fromInline) {
    return { key: parsed.key, value: parsed.value };
  }

  const next = entries[getIndex()];
  if (!next || next.indent <= indent) {
    return { key: parsed.key, value: null };
  }

  return {
    key: parsed.key,
    value: parseYamlNode(entries, getIndex, setIndex, next.indent) ?? null
  };
}

function parseInlineYamlProperty(text: string) {
  const match = text.match(/^([^:]+):(.*)$/);
  if (!match) {
    return null;
  }

  const key = match[1].trim();
  const rest = match[2].trim();
  if (!key) {
    return null;
  }

  if (rest.length === 0) {
    return { key, value: null, fromInline: false };
  }

  return { key, value: parseYamlScalar(rest), fromInline: true };
}

function parseYamlScalar(raw: string): unknown {
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  if (raw === 'null') {
    return null;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    return Number(raw);
  }

  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    const quote = raw[0];
    if (quote === '"') {
      try {
        return JSON.parse(raw);
      } catch {
        return raw.slice(1, -1);
      }
    }
    return raw.slice(1, -1);
  }

  return raw;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
