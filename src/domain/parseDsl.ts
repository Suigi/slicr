import { parser } from '../slicr.parser';
import * as terms from '../slicr.parser.terms';
import { Edge, NodeData, Parsed, ParseWarning, VisualNode } from './types';

type NodeSpec = {
  line: number;
  type: string;
  name: string;
  incoming: ArtifactRef[];
  data: NodeData;
  srcRange: { from: number; to: number };
  dataEndPos?: number;
};

type ArtifactRef = {
  type: string;
  name: string;
};

type YamlEntry = {
  indent: number;
  text: string;
};

export function parseDsl(src: string): Parsed {
  const tree = parser.parse(src);
  const lines = src.split('\n');
  const lineStarts = buildLineStarts(lines);

  const nodes = new Map<string, VisualNode>();
  const edges: Edge[] = [];
  const warnings: ParseWarning[] = [];
  let sliceName = '';
  const specs: NodeSpec[] = [];

  const cursor = tree.cursor();
  do {
    if (cursor.type.id === terms.SliceStatement) {
      cursor.firstChild(); // Move to kw<"slice">
      // @ts-ignore cursor is being modified by cursor.nextSibling()
      if (cursor.nextSibling() && cursor.type.id === terms.String) {
        const raw = src.slice(cursor.from, cursor.to);
        sliceName = raw.slice(1, -1); // Remove quotes
      }
      cursor.parent();
      continue;
    }

    if (cursor.type.id === terms.NodeStatement) {
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
        incoming: parsed.incoming,
        data: null,
        srcRange: { from: cursor.from, to: cursor.to }
      });
    }
  } while (cursor.next());

  attachDataBlocks(lines, specs, lineStarts);

  const refToKey = new Map<string, string>();
  const refToSpec = new Map<string, NodeSpec>();
  const usedKeys = new Set<string>();
  const unresolvedEdges: Array<{ fromRef: string; toRef: string }> = [];

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
        key,
        data: spec.data,
        srcRange: finalRange
      });
    } else if (spec.data) {
      const existing = nodes.get(key);
      if (existing) {
        existing.data = spec.data;
        existing.srcRange = finalRange;
      }
    }

    for (const from of spec.incoming) {
      unresolvedEdges.push({ fromRef: toRefId(from.type, from.name), toRef: ref });
    }
  }

  for (const edge of unresolvedEdges) {
    const from = refToKey.get(edge.fromRef);
    const to = refToKey.get(edge.toRef);
    if (from && to) {
      edges.push({ from, to, label: null });
    } else if (shouldWarnUnresolvedDependency(edge.fromRef, edge.toRef)) {
      const targetSpec = refToSpec.get(edge.toRef);
      const range = targetSpec?.srcRange ?? { from: 0, to: 0 };
      warnings.push({
        message: `Unresolved dependency: ${edge.fromRef} -> ${edge.toRef}`,
        range
      });
    }
  }

  return { sliceName, nodes, edges, warnings };
}

function parseNodeStatement(cursor: any, src: string) {
  cursor.firstChild(); // Move to ArtifactRef
  const target = parseArtifactRef(cursor, src);
  if (!target) {
    cursor.parent();
    return null;
  }

  const incoming: ArtifactRef[] = [];
  if (cursor.nextSibling() && cursor.type.id === terms.IncomingClause) {
    cursor.firstChild(); // Move to DependsArrow
    while (cursor.nextSibling()) {
      if (cursor.type.id === terms.ArtifactRef) {
        const ref = parseArtifactRef(cursor, src);
        if (ref) {
          incoming.push(ref);
        }
      }
    }
    cursor.parent();
  }

  cursor.parent();
  return { target, incoming };
}

function parseArtifactRef(cursor: any, src: string): ArtifactRef | null {
  if (cursor.type.id !== terms.ArtifactRef) {
    return null;
  }

  cursor.firstChild(); // Move to specific ref (RmRef, UiRef, etc.)
  const typeId = cursor.type.id;

  let type = '';
  if (typeId === terms.RmRef) type = 'rm';
  else if (typeId === terms.UiRef) type = 'ui';
  else if (typeId === terms.CmdRef) type = 'cmd';
  else if (typeId === terms.EvtRef) type = 'evt';
  else if (typeId === terms.ExcRef) type = 'exc';
  else if (typeId === terms.AutRef) type = 'aut';
  else if (typeId === terms.ExtRef) type = 'ext';
  else if (typeId === terms.GenericRef) {
    cursor.firstChild();
    type = src.slice(cursor.from, cursor.to);
    cursor.parent();
  }

  if (!type) {
    cursor.parent();
    return null;
  }

  let name = '';
  let version = '';

  // Traverse children of the specific ref to find Name and Version
  cursor.firstChild();
  do {
    const tid = cursor.type.id;
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

function shouldWarnUnresolvedDependency(fromRef: string, toRef: string) {
  const fromType = fromRef.split(':', 1)[0];
  const toType = toRef.split(':', 1)[0];

  // Commands can originate outside the slice and trigger an event entrypoint.
  if (fromType === 'cmd' && toType === 'evt') {
    return false;
  }

  return true;
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
      specs[lastSpecIndex].dataEndPos = lineStarts[lastNonEmptyNext] + lines[lastNonEmptyNext].length;
    }
  }
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
