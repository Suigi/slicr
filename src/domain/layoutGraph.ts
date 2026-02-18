import { Edge, LayoutResult, SliceBoundary, VisualNode } from './types';
import { EDGE_ANCHOR_OFFSET } from './edgePath';
import { countNodeDataLines } from './formatNodeData';

const NODE_W = 180;
const NODE_H_BASE = 42;
const NODE_FIELD_H = 16;
const NODE_FIELD_PAD = 10;
const COL_GAP = 80;
export const PAD_X = 40;
const PAD_TOP = 16;
const ROW_GAP = 120;
const MIN_SUCCESSOR_X_OFFSET = EDGE_ANCHOR_OFFSET * 4;

export function nodeHeight(node: VisualNode): number {
  if (!node.data) {
    return NODE_H_BASE;
  }

  const lines = countNodeDataLines(node.data);
  return NODE_H_BASE + NODE_FIELD_PAD + lines * NODE_FIELD_H;
}

export function rowFor(type: string): number {
  if (type === 'ui') {
    return 0;
  }
  if (type === 'evt') {
    return 2;
  }
  return 1;
}

export function layoutGraph(nodes: Map<string, VisualNode>, edges: Edge[], boundaries: SliceBoundary[] = []): LayoutResult {
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
  usedRows.forEach((row, i) => {
    rowY[row] = PAD_TOP + 32 + i * (NODE_H_BASE + ROW_GAP);
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
      h: nodeHeight(node)
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

    if (node.type === 'ui') {
      rowByKey[key] = 0;
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
