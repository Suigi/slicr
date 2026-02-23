import { Edge, LayoutResult, SliceBoundary, VisualNode } from './types';
import { EDGE_ANCHOR_OFFSET } from './edgePath';
import { countNodeDataLines } from './formatNodeData';

const NODE_W = 180;
const NODE_H_BASE = 42;
const NODE_FIELD_H = 16;
const NODE_FIELD_PAD = 10;
const NODE_PAD_X = 14;
const HEADER_GAP = 8;
const HEADER_TEXT_CHAR_W = 7;
const HEADER_PREFIX_CHAR_W = 6;
const HEADER_EXTRA_LINE_H = 14;
const SINGLE_LINE_HEADER_DATA_COMPENSATION = 4;
const WRAPPED_HEADER_EXTRA_COMPENSATION_PER_LINE = 2;
const HEADER_MIN_CHARS_PER_LINE = 4;
const NODE_VERSION_SUFFIX = /@\d+$/;
const COL_GAP = 80;
export const PAD_X = 40;
const PAD_TOP = 16;
const ROW_GAP = 120;
const MIN_SUCCESSOR_X_OFFSET = EDGE_ANCHOR_OFFSET * 4;

export function nodeHeight(node: VisualNode, measuredHeights?: Record<string, number>): number {
  const measured = measuredHeights?.[node.key];
  if (typeof measured === 'number' && Number.isFinite(measured) && measured > 0) {
    return Math.round(measured);
  }

  const headerLines = headerLineCount(node);
  const headerHeight = NODE_H_BASE + Math.max(0, headerLines - 1) * HEADER_EXTRA_LINE_H;

  if (!node.data) {
    return headerHeight;
  }

  const lines = countNodeDataLines(node.data);
  let height = headerHeight + NODE_FIELD_PAD + lines * NODE_FIELD_H;

  if (headerLines === 1) {
    height -= SINGLE_LINE_HEADER_DATA_COMPENSATION;
  } else if (headerLines >= 3) {
    height += (headerLines - 2) * WRAPPED_HEADER_EXTRA_COMPENSATION_PER_LINE;
  }

  return Math.max(headerHeight, height);
}

export function rowFor(type: string): number {
  if (type === 'ui' || type === 'aut' || type === 'ext' || type === 'generic') {
    return 0;
  }
  if (type === 'evt' || type === 'exc') {
    return 2;
  }
  return 1;
}

export function layoutGraph(
  nodes: Map<string, VisualNode>,
  edges: Edge[],
  boundaries: SliceBoundary[] = [],
  measuredHeights?: Record<string, number>
): LayoutResult {
  const inDeg: Record<string, number> = {};
  const outgoing: Record<string, string[]> = {};
  const nodeOrder = [...nodes.keys()];
  nodes.forEach((_, key) => {
    inDeg[key] = 0;
    outgoing[key] = [];
  });

  for (const edge of edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
      continue;
    }
    inDeg[edge.to] += 1;
    outgoing[edge.from].push(edge.to);
  }

  const encounterOrder: string[] = [];
  const queue: string[] = nodeOrder.filter((key) => inDeg[key] === 0);

  while (queue.length > 0) {
    const current = queue.shift() as string;
    encounterOrder.push(current);

    for (const next of outgoing[current]) {
      inDeg[next] -= 1;
      if (inDeg[next] === 0) {
        queue.push(next);
      }
    }
  }

  if (encounterOrder.length < nodeOrder.length) {
    for (const key of nodeOrder) {
      if (!encounterOrder.includes(key)) {
        encounterOrder.push(key);
      }
    }
  }

  const minColSource: Record<string, string | string[]> = {};

  for (const edge of edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
      continue;
    }

    if (minColSource[edge.to] === undefined) {
      minColSource[edge.to] = edge.from;
    } else {
      const current = minColSource[edge.to];
      if (Array.isArray(current)) {
        current.push(edge.from);
      } else {
        minColSource[edge.to] = [current, edge.from];
      }
    }
  }

  const { rowByKey, usedRows, rowStreamLabels } = buildRowAssignments(nodes, nodeOrder);

  let col: Record<string, number> = {};
  const occupied: Record<string, boolean> = {};
  const nodeOrderIndex = new Map<string, number>();
  nodeOrder.forEach((key, index) => {
    nodeOrderIndex.set(key, index);
  });
  const boundarySpecs = boundaries
    .map((boundary) => {
      const afterIndex = nodeOrderIndex.get(boundary.after);
      if (afterIndex === undefined) {
        return null;
      }
      return { afterKey: boundary.after, afterIndex };
    })
    .filter((spec): spec is { afterKey: string; afterIndex: number } => spec !== null)
    .sort((a, b) => a.afterIndex - b.afterIndex);

  for (const key of encounterOrder) {
    const node = nodes.get(key);
    if (!node) {
      continue;
    }

    const row = rowByKey[key];
    let startCol = 0;
    const sources = minColSource[key];

    if (sources !== undefined) {
      const list = Array.isArray(sources) ? sources : [sources];
      for (const source of list) {
        if (col[source] !== undefined) {
          startCol = Math.max(startCol, col[source]);
        }
      }
    }
    const orderIndex = nodeOrderIndex.get(key);
    if (orderIndex !== undefined) {
      let boundaryFloor = 0;
      for (const boundary of boundarySpecs) {
        if (boundary.afterIndex >= orderIndex) {
          break;
        }
        const afterCol = col[boundary.afterKey];
        if (afterCol !== undefined) {
          boundaryFloor = Math.max(boundaryFloor, afterCol + 1);
        }
      }
      startCol = Math.max(startCol, boundaryFloor);
    }

    let currentCol = startCol;
    while (occupied[`${currentCol},${row}`]) {
      currentCol += 1;
    }

    col[key] = currentCol;
    occupied[`${currentCol},${row}`] = true;
  }

  col = applyBoundaryColumnFloors(col, nodeOrder, boundarySpecs, nodeOrderIndex, rowByKey);

  const rowY: Record<number, number> = {};
  const rowHeights: Record<number, number> = {};
  nodes.forEach((node, key) => {
    const row = rowByKey[key];
    if (row === undefined) {
      return;
    }
    const height = nodeHeight(node, measuredHeights);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, height);
  });
  let nextRowY = PAD_TOP + 32;
  usedRows.forEach((row) => {
    rowY[row] = nextRowY;
    nextRowY += (rowHeights[row] ?? NODE_H_BASE) + ROW_GAP;
  });

  const numCols = Math.max(...Object.values(col)) + 1;
  const colX: Record<number, number> = {};
  for (let c = 0; c < numCols; c += 1) {
    colX[c] = PAD_X + c * (NODE_W + COL_GAP);
  }

  const pos: LayoutResult['pos'] = {};
  for (const key of encounterOrder) {
    const node = nodes.get(key);
    if (!node) {
      continue;
    }

    let x = colX[col[key]];
    const sources = minColSource[key];
    const list = sources === undefined ? [] : Array.isArray(sources) ? sources : [sources];

    for (const source of list) {
      const sourcePos = pos[source];
      if (sourcePos) {
        x = Math.max(x, sourcePos.x + MIN_SUCCESSOR_X_OFFSET);
      }
    }

    pos[key] = {
      x,
      y: rowY[rowByKey[key]],
      w: NODE_W,
      h: nodeHeight(node, measuredHeights)
    };
  }

  applyBoundaryXFloors(pos, nodeOrder, boundarySpecs, nodeOrderIndex, rowByKey);

  const maxX = Math.max(...Object.values(pos).map((value) => value.x + value.w)) + PAD_X;
  const maxY = Math.max(...Object.values(pos).map((value) => value.y + value.h)) + 48;

  return { pos, rowY, usedRows, rowStreamLabels, w: maxX, h: maxY };
}

function applyBoundaryColumnFloors(
  col: Record<string, number>,
  nodeOrder: string[],
  boundarySpecs: Array<{ afterKey: string; afterIndex: number }>,
  nodeOrderIndex: Map<string, number>,
  rowByKey: Record<string, number>
) {
  const adjusted: Record<string, number> = {};
  const occupied: Record<string, boolean> = {};

  for (const key of nodeOrder) {
    const row = rowByKey[key];
    if (row === undefined) {
      continue;
    }
    const orderIndex = nodeOrderIndex.get(key);
    let nextCol = col[key] ?? 0;

    if (orderIndex !== undefined) {
      for (const boundary of boundarySpecs) {
        if (boundary.afterIndex >= orderIndex) {
          break;
        }
        const afterCol = adjusted[boundary.afterKey];
        if (afterCol !== undefined) {
          nextCol = Math.max(nextCol, afterCol + 1);
        }
      }
    }

    while (occupied[`${nextCol},${row}`]) {
      nextCol += 1;
    }
    adjusted[key] = nextCol;
    occupied[`${nextCol},${row}`] = true;
  }

  return adjusted;
}

function headerLineCount(node: VisualNode): number {
  const title = (node.alias ?? node.name.replace(NODE_VERSION_SUFFIX, '')).trim();
  if (!title) {
    return 1;
  }

  const contentWidth = NODE_W - NODE_PAD_X * 2;
  const prefix = node.type === 'generic' ? '' : node.type.trim();
  const prefixWidth = prefix ? (prefix.length + 1) * HEADER_PREFIX_CHAR_W + HEADER_GAP : 0;
  const firstLineWidth = Math.max(contentWidth - prefixWidth, HEADER_MIN_CHARS_PER_LINE * HEADER_TEXT_CHAR_W);
  const firstLineChars = Math.max(Math.floor(firstLineWidth / HEADER_TEXT_CHAR_W), HEADER_MIN_CHARS_PER_LINE);
  const baseLineChars = Math.max(Math.floor(contentWidth / HEADER_TEXT_CHAR_W), HEADER_MIN_CHARS_PER_LINE);

  let remainingChars = title.length - firstLineChars;
  if (remainingChars <= 0) {
    return 1;
  }

  let extraLines = 0;
  while (remainingChars > 0) {
    remainingChars -= baseLineChars;
    extraLines += 1;
  }
  return 1 + extraLines;
}

function applyBoundaryXFloors(
  pos: LayoutResult['pos'],
  nodeOrder: string[],
  boundarySpecs: Array<{ afterKey: string; afterIndex: number }>,
  nodeOrderIndex: Map<string, number>,
  rowByKey: Record<string, number>
) {
  const nextFreeXByRow: Record<number, number> = {};

  for (const key of nodeOrder) {
    const current = pos[key];
    const row = rowByKey[key];
    if (!current || row === undefined) {
      continue;
    }

    let minX = nextFreeXByRow[row] ?? Number.NEGATIVE_INFINITY;
    const orderIndex = nodeOrderIndex.get(key);
    if (orderIndex !== undefined) {
      for (const boundary of boundarySpecs) {
        if (boundary.afterIndex >= orderIndex) {
          break;
        }
        const anchor = pos[boundary.afterKey];
        if (anchor) {
          minX = Math.max(minX, anchor.x + anchor.w + 40 + PAD_X);
        }
      }
    }

    const x = Math.max(current.x, minX);
    current.x = x;
    nextFreeXByRow[row] = x + NODE_W + COL_GAP;
  }
}

function buildRowAssignments(nodes: Map<string, VisualNode>, nodeOrder: string[]) {
  const rowByKey: Record<string, number> = {};
  const eventsByStream = new Map<string, string[]>();

  for (const key of nodeOrder) {
    const node = nodes.get(key);
    if (!node) {
      continue;
    }

    if (node.type === 'ui' || node.type === 'aut' || node.type === 'ext' || node.type === 'generic') {
      rowByKey[key] = 0;
      continue;
    }
    if (node.type === 'exc') {
      const keys = eventsByStream.get('default');
      if (keys) {
        keys.push(key);
      } else {
        eventsByStream.set('default', [key]);
      }
      continue;
    }

    if (node.type !== 'evt') {
      rowByKey[key] = 1;
      continue;
    }

    const stream = node.stream?.trim() || 'default';
    const keys = eventsByStream.get(stream);
    if (keys) {
      keys.push(key);
    } else {
      eventsByStream.set(stream, [key]);
    }
  }

  const streamOrder = [...eventsByStream.keys()].sort((a, b) => {
    if (a === 'default') return 1;
    if (b === 'default') return -1;
    return 0;
  });
  const eventStreamRows = new Map<string, number>();
  streamOrder.forEach((stream, index) => {
    const row = 2 + index;
    eventStreamRows.set(stream, row);
    for (const key of eventsByStream.get(stream) ?? []) {
      rowByKey[key] = row;
    }
  });

  const usedRows = [...new Set(Object.values(rowByKey))].sort((a, b) => a - b);
  const rowStreamLabels: Record<number, string> = {};
  for (const [stream, row] of eventStreamRows.entries()) {
    if (stream !== 'default') {
      rowStreamLabels[row] = stream;
    }
  }

  return { rowByKey, usedRows, rowStreamLabels };
}
