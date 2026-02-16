import { parser } from '../slicr.parser.js';
import * as terms from '../slicr.parser.terms.js';
import { Edge, NodeData, Parsed, VisualNode } from './types';

type NodeSpec = {
  line: number;
  type: string;
  name: string;
  incoming: ArtifactRef[];
  data: NodeData;
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
  let sliceName = '';
  const specs: NodeSpec[] = [];

  const cursor = tree.cursor();
  do {
    const statementText = src.slice(cursor.from, cursor.to).trim();
    if (!statementText) {
      continue;
    }

    if (cursor.type.id === terms.SliceStatement) {
      const match = statementText.match(/^slice\s+"([^"]+)"/);
      if (match) {
        sliceName = match[1];
      }
      continue;
    }

    if (cursor.type.id === terms.NodeStatement) {
      const parsed = parseNodeStatement(statementText);
      if (!parsed) {
        continue;
      }

      specs.push({
        line: getLineIndexAtPos(lineStarts, cursor.from),
        type: parsed.target.type,
        name: parsed.target.name,
        incoming: parsed.incoming,
        data: null
      });
    }
  } while (cursor.next());

  attachDataBlocks(lines, specs);

  const refToKey = new Map<string, string>();
  const usedKeys = new Set<string>();
  const unresolvedEdges: Array<{ fromRef: string; toRef: string }> = [];

  for (const spec of specs) {
    const ref = toRefId(spec.type, spec.name);
    let key = refToKey.get(ref);
    if (!key) {
      key = pickNodeKey(spec, usedKeys);
      refToKey.set(ref, key);
      usedKeys.add(key);
    }

    if (!nodes.has(key)) {
      nodes.set(key, {
        type: spec.type,
        name: spec.name,
        key,
        data: spec.data
      });
    } else if (spec.data) {
      const existing = nodes.get(key);
      if (existing) {
        existing.data = spec.data;
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
    }
  }

  return { sliceName, nodes, edges };
}

function parseNodeStatement(text: string) {
  const match = text.match(/^([a-z]+):([^\s<,]+)(?:\s*<-\s*(.+))?$/);
  if (!match) {
    return null;
  }

  const target: ArtifactRef = { type: match[1], name: match[2] };
  const incoming = match[3]
    ? splitRefs(match[3]).map(parseArtifactRef).filter((value): value is ArtifactRef => value !== null)
    : [];

  if (match[3] && incoming.length === 0) {
    return null;
  }

  return { target, incoming };
}

function splitRefs(text: string) {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseArtifactRef(text: string): ArtifactRef | null {
  const match = text.match(/^([a-z]+):([^\s,]+)$/);
  if (!match) {
    return null;
  }
  return { type: match[1], name: match[2] };
}

function toRefId(type: string, name: string) {
  return `${type}:${name}`;
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

function attachDataBlocks(lines: string[], specs: NodeSpec[]) {
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
      } catch {
        // Keep parity with previous behavior: ignore malformed data blocks.
      }
      continue;
    }

    const blockLines: string[] = [];
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
    }

    const parsedYaml = parseYamlBlock(blockLines);
    if (parsedYaml) {
      specs[lastSpecIndex].data = parsedYaml;
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
