import { parser } from '../slicr.parser.js';
import * as terms from '../slicr.parser.terms.js';
import { Edge, NodeData, Parsed, VisualNode } from './types';

type Item = {
  kind: 'arrow' | 'artifact';
  indent: number;
  type: string;
  name: string;
  label?: string | null;
  data: NodeData;
};

export function parseDsl(src: string): Parsed {
  const tree = parser.parse(src);
  const nodes = new Map<string, VisualNode>();
  const edges: Edge[] = [];
  let sliceName = '';
  const nameCounts: Record<string, number> = {};
  const items: Item[] = [];

  const cursor = tree.cursor();
  do {
    const typeId = cursor.type.id;
    const statementText = src.slice(cursor.from, cursor.to).trim();

    if (typeId === terms.SliceStatement) {
      const match = statementText.match(/^slice\s+"([^"]+)"/);
      if (match) {
        sliceName = match[1];
      }
      continue;
    }

    if (typeId === terms.ArtifactStatement) {
      const parsed = parseArtifactText(statementText);
      if (parsed) {
        items.push({
          kind: 'artifact',
          indent: getIndent(src, cursor.from),
          type: parsed.type,
          name: parsed.name,
          data: null
        });
      }
      continue;
    }

    if (typeId === terms.ArrowStatement) {
      const parsed = parseArrowText(statementText);
      if (parsed) {
        items.push({
          kind: 'arrow',
          indent: getIndent(src, cursor.from),
          type: parsed.type,
          name: parsed.name,
          label: parsed.label,
          data: null
        });
      }
      continue;
    }

    if (typeId === terms.DataStatement && items.length > 0) {
      const parsed = parseDataText(statementText);
      if (!parsed) {
        continue;
      }
      try {
        items[items.length - 1].data = JSON.parse(parsed) as Record<string, unknown>;
      } catch {
        // Keep parity with previous behavior: ignore malformed data blocks.
      }
    }
  } while (cursor.next());

  const makeKey = (type: string, name: string) => {
    if (type === 'rm' || type === 'ui') {
      const count = (nameCounts[name] ?? 0) + 1;
      nameCounts[name] = count;
      return count === 1 ? name : `${name}#${count}`;
    }
    return name;
  };

  const ownerAt: Record<number, string> = {};

  for (const item of items) {
    const key = makeKey(item.type, item.name);

    if (!nodes.has(key)) {
      nodes.set(key, {
        type: item.type,
        name: item.name,
        key,
        data: item.data
      });
    } else if (item.data) {
      const current = nodes.get(key);
      if (current) {
        current.data = item.data;
      }
    }

    if (item.kind === 'artifact') {
      ownerAt[item.indent] = key;
      continue;
    }

    let from: string | null = null;
    const sorted = Object.keys(ownerAt)
      .map(Number)
      .sort((a, b) => b - a);

    for (const value of sorted) {
      if (value < item.indent) {
        from = ownerAt[value];
        break;
      }
    }

    if (from) {
      edges.push({ from, to: key, label: item.label ?? null });
    }

    ownerAt[item.indent] = key;
  }

  return { sliceName, nodes, edges };
}

function parseArtifactText(text: string) {
  const match = text.match(/^([a-z]+):([^\s[]+)$/);
  if (!match) {
    return null;
  }
  return { type: match[1], name: match[2] };
}

function parseArrowText(text: string) {
  const match = text.match(/^->\s+([a-z]+):([^\s[]+)(?:\s+\[([^\]]+)])?$/);
  if (!match) {
    return null;
  }
  return { type: match[1], name: match[2], label: match[3] ?? null };
}

function parseDataText(text: string) {
  const match = text.match(/^data:\s*(.+)$/);
  return match ? match[1] : null;
}

function getIndent(src: string, pos: number): number {
  const lastNewline = src.lastIndexOf('\n', pos - 1);
  const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
  let indent = 0;
  for (let i = lineStart; i < pos; i += 1) {
    const char = src[i];
    if (char === ' ' || char === '\t') {
      indent += 1;
    } else {
      break;
    }
  }
  return indent;
}
