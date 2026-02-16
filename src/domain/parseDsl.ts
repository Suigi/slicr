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
  const lines = src.split('\n');
  const nodes = new Map<string, VisualNode>();
  const edges: Edge[] = [];
  let sliceName = '';
  const nameCounts: Record<string, number> = {};

  for (const line of lines) {
    const match = line.match(/^slice\s+"([^"]+)"/);
    if (match) {
      sliceName = match[1];
      break;
    }
  }

  const items: Item[] = [];
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('slice')) {
      continue;
    }

    const indent = (line.match(/^(\s*)/)?.[1] ?? '').length;
    const content = line.trim();

    const dataMatch = content.match(/^data:\s*(.+)$/);
    if (dataMatch && items.length > 0) {
      try {
        items[items.length - 1].data = JSON.parse(dataMatch[1]) as Record<string, unknown>;
      } catch {
        // Keep parity with existing behavior: ignore bad data blocks.
      }
      continue;
    }

    const arrowMatch = content.match(/^->\s+([a-z]+):([^\s\[]+)(?:\s+\[([^\]]+)])?$/);
    if (arrowMatch) {
      items.push({
        kind: 'arrow',
        indent,
        type: arrowMatch[1],
        name: arrowMatch[2],
        label: arrowMatch[3] ?? null,
        data: null
      });
      continue;
    }

    const artifactMatch = content.match(/^([a-z]+):([^\s\[]+)$/);
    if (artifactMatch) {
      items.push({
        kind: 'artifact',
        indent,
        type: artifactMatch[1],
        name: artifactMatch[2],
        data: null
      });
    }
  }

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
