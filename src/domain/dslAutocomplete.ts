const NODE_REF_LINE = /^([a-zA-Z][\w-]*):([^\s<"]+)(?:\s+"(?:[^"\\]|\\.)*")?\s*(?:(?:<-|->).*)?$/;
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

  return `${match[1]}:${match[2]}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
