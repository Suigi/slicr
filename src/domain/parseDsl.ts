import { Edge, NodeData, Parsed, VisualNode } from './types';
import { DslToken, tokenizeDslLine } from '../dslTokenizer';

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
    const tokens = tokenizeDslLine(line);
    const first = tokens[0];
    const second = tokens[1];

    if (first?.type === 'keyword' && first.text === 'slice' && second?.type === 'string') {
      sliceName = second.text.slice(1, -1);
      break;
    }
  }

  const items: Item[] = [];
  for (const line of lines) {
    const tokens = tokenizeDslLine(line);
    if (tokens.length === 0 || (tokens[0].type === 'keyword' && tokens[0].text === 'slice')) {
      continue;
    }

    const indent = (line.match(/^(\s*)/)?.[1] ?? '').length;

    if (isDataLine(tokens) && items.length > 0) {
      try {
        const colon = line.indexOf(':');
        if (colon >= 0) {
          const raw = line.slice(colon + 1).trim();
          items[items.length - 1].data = JSON.parse(raw) as Record<string, unknown>;
        }
      } catch {
        // Keep parity with existing behavior: ignore bad data blocks.
      }
      continue;
    }

    const parsedArrow = parseArrowLine(tokens);
    if (parsedArrow) {
      items.push({
        kind: 'arrow',
        indent,
        type: parsedArrow.type,
        name: parsedArrow.name,
        label: parsedArrow.label,
        data: null
      });
      continue;
    }

    const parsedArtifact = parseArtifactLine(tokens);
    if (parsedArtifact) {
      items.push({
        kind: 'artifact',
        indent,
        type: parsedArtifact.type,
        name: parsedArtifact.name,
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

function isDataLine(tokens: DslToken[]) {
  return tokens[0]?.type === 'keyword' && tokens[0].text === 'data' && tokens[1]?.type === 'punctuation';
}

function parseArrowLine(tokens: DslToken[]) {
  if (tokens[0]?.type !== 'operator') {
    return null;
  }
  if (!isTypeToken(tokens[1])) {
    return null;
  }
  if (tokens[2]?.type !== 'punctuation') {
    return null;
  }
  if (tokens[3]?.type !== 'variableName') {
    return null;
  }
  const labelToken = tokens[4];
  if (labelToken && labelToken.type !== 'attributeName') {
    return null;
  }
  if (tokens.length > 5) {
    return null;
  }

  return {
    type: tokens[1].text,
    name: tokens[3].text,
    label: labelToken ? labelToken.text.slice(1, -1) : null
  };
}

function parseArtifactLine(tokens: DslToken[]) {
  if (!isTypeToken(tokens[0])) {
    return null;
  }
  if (tokens[1]?.type !== 'punctuation') {
    return null;
  }
  if (tokens[2]?.type !== 'variableName') {
    return null;
  }
  if (tokens.length > 3) {
    return null;
  }

  return {
    type: tokens[0].text,
    name: tokens[2].text
  };
}

function isTypeToken(token: DslToken | undefined) {
  return (
    token?.type === 'rmType' ||
    token?.type === 'uiType' ||
    token?.type === 'cmdType' ||
    token?.type === 'evtType' ||
    token?.type === 'typeName'
  );
}
