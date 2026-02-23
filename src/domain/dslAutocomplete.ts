import { parseDsl } from './parseDsl';

const NODE_REF_LINE = /^(?:([a-zA-Z][\w-]*):)?([^\s<"]+)(?:\s+"(?:[^"\\]|\\.)*")?\s*(?:(?:<-|->).*)?$/;
const ARROW_RE = /(<-|->)/;

export function getDependencySuggestions(dsl: string, cursorPos: number): string[] {
  const safeCursor = clamp(cursorPos, 0, dsl.length);
  const beforeCursor = dsl.slice(0, safeCursor);
  const lineStart = beforeCursor.lastIndexOf('\n') + 1;
  const lineText = beforeCursor.slice(lineStart);
  const arrowMatch = lineText.match(ARROW_RE);
  if (!arrowMatch || arrowMatch.index === undefined) {
    return [];
  }
  const arrowIndex = arrowMatch.index;
  const ownerRef = resolveOwnerRef(dsl, lineStart, lineText, arrowIndex);
  if (!ownerRef) {
    return [];
  }

  const afterArrow = lineText.slice(arrowIndex + 2);
  const currentToken = afterArrow.slice(afterArrow.lastIndexOf(',') + 1).trim();

  const refs = collectRefs(dsl).filter((ref) => ref !== ownerRef);
  if (!currentToken) {
    return refs;
  }

  return refs.filter((ref) => ref.startsWith(currentToken));
}

export function getUsesKeySuggestions(dsl: string, cursorPos: number): { from: number; suggestions: string[] } | null {
  const safeCursor = clamp(cursorPos, 0, dsl.length);
  const beforeCursor = dsl.slice(0, safeCursor);
  const lineStart = beforeCursor.lastIndexOf('\n') + 1;
  const lineText = beforeCursor.slice(lineStart);
  const tokenMatch = lineText.match(/([A-Za-z0-9_:@.-]*)\.\.$/);
  if (!tokenMatch || tokenMatch.index === undefined) {
    return null;
  }

  const ownerRef = resolveUsesOwnerRef(dsl, lineStart);
  if (!ownerRef) {
    return null;
  }

  const parsed = parseDsl(dsl);
  const ownerNode = [...parsed.nodes.values()].find((node) => `${node.type}:${node.name}` === ownerRef);
  if (!ownerNode) {
    return null;
  }

  const keys = new Set<string>();
  for (const edge of parsed.edges) {
    if (edge.to !== ownerNode.key) {
      continue;
    }
    const predecessor = parsed.nodes.get(edge.from);
    for (const key of flattenDataKeys(predecessor?.data)) {
      keys.add(key);
    }
  }

  for (const node of parsed.nodes.values()) {
    if (node.type === 'generic') {
      continue;
    }
    for (const key of flattenDataKeys(node.data)) {
      keys.add(key);
    }
  }

  const prefix = tokenMatch[1] ?? '';
  const suggestions = [...keys]
    .filter((key) => /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(key))
    .filter((key) => !prefix || key.includes(prefix))
    .sort((a, b) => compareSuggestions(a, b, prefix));
  if (suggestions.length === 0) {
    return null;
  }

  return {
    from: safeCursor - tokenMatch[0].length,
    suggestions
  };
}

function resolveOwnerRef(dsl: string, lineStart: number, lineText: string, arrowIndex: number): string | null {
  const inlineRef = parseRef(lineText.slice(0, arrowIndex));
  if (inlineRef) {
    return inlineRef;
  }

  return findPreviousNodeRef(dsl, lineStart);
}

function findPreviousNodeRef(dsl: string, lineStart: number): string | null {
  const before = dsl.slice(0, lineStart);
  const lines = before.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const ref = parseRef(lines[i]);
    if (ref) {
      return ref;
    }
  }
  return null;
}

function collectRefs(dsl: string): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();

  for (const line of dsl.split('\n')) {
    const ref = parseRef(line);
    if (!ref || seen.has(ref)) {
      continue;
    }
    seen.add(ref);
    refs.push(ref);
  }

  return refs;
}

function parseRef(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('slice ') || trimmed.startsWith('stream:') || line.startsWith(' ') || line.startsWith('\t')) {
    return null;
  }

  const match = trimmed.match(NODE_REF_LINE);
  if (!match) {
    return null;
  }

  const prefix = match[1];
  const name = match[2];
  return prefix ? `${prefix}:${name}` : name;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveUsesOwnerRef(dsl: string, lineStartOffset: number): string | null {
  const before = dsl.slice(0, lineStartOffset);
  const lines = before.split('\n');
  let usesLineIndex = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith('uses:') || trimmed.startsWith('maps:')) {
      usesLineIndex = i;
      break;
    }
    if (parseRef(line)) {
      return null;
    }
  }

  if (usesLineIndex === -1) {
    return null;
  }

  for (let i = usesLineIndex - 1; i >= 0; i -= 1) {
    const ref = parseRef(lines[i]);
    if (ref) {
      return ref;
    }
  }

  return null;
}

function flattenDataKeys(data: unknown, path = ''): string[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return [];
  }
  const result: string[] = [];
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const nextPath = path ? `${path}.${key}` : key;
    result.push(nextPath);
    result.push(...flattenDataKeys(value, nextPath));
  }
  return result;
}

function compareSuggestions(a: string, b: string, prefix: string): number {
  if (!prefix) {
    return a.localeCompare(b);
  }
  const aStarts = a.startsWith(prefix);
  const bStarts = b.startsWith(prefix);
  if (aStarts !== bStarts) {
    return aStarts ? -1 : 1;
  }
  return a.localeCompare(b);
}
