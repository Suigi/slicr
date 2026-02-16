import { Edge, LayoutResult, VisualNode } from './types';

const NODE_W = 180;
const NODE_H_BASE = 42;
const NODE_FIELD_H = 16;
const NODE_FIELD_PAD = 10;
const COL_GAP = 80;
export const PAD_X = 56;
const PAD_TOP = 16;
const ROW_GAP = 120;

export function nodeHeight(node: VisualNode): number {
  if (!node.data) {
    return NODE_H_BASE;
  }

  const fields = Object.keys(node.data).length;
  return NODE_H_BASE + NODE_FIELD_PAD + fields * NODE_FIELD_H;
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

export function layoutGraph(nodes: Map<string, VisualNode>, edges: Edge[]): LayoutResult {
  const inDeg: Record<string, number> = {};
  nodes.forEach((_, key) => {
    inDeg[key] = 0;
  });

  for (const edge of edges) {
    if (nodes.has(edge.to)) {
      inDeg[edge.to] += 1;
    }
  }

  const encounterOrder: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [...nodes.keys()].filter((key) => !inDeg[key]);

  if (queue.length === 0) {
    const firstKey = nodes.keys().next().value as string | undefined;
    if (firstKey) {
      queue.push(firstKey);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (visited.has(current)) {
      continue;
    }

    visited.add(current);
    encounterOrder.push(current);

    for (const edge of edges) {
      if (edge.from === current && !visited.has(edge.to)) {
        queue.push(edge.to);
      }
    }
  }

  nodes.forEach((_, key) => {
    if (!visited.has(key)) {
      encounterOrder.push(key);
    }
  });

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

  const col: Record<string, number> = {};
  const occupied: Record<string, boolean> = {};

  for (const key of encounterOrder) {
    const node = nodes.get(key);
    if (!node) {
      continue;
    }

    const row = rowFor(node.type);
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

    let currentCol = startCol;
    while (occupied[`${currentCol},${row}`]) {
      currentCol += 1;
    }

    col[key] = currentCol;
    occupied[`${currentCol},${row}`] = true;
  }

  const usedRows = [...new Set([...nodes.values()].map((node) => rowFor(node.type)))].sort((a, b) => a - b);

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
  nodes.forEach((node, key) => {
    pos[key] = {
      x: colX[col[key]],
      y: rowY[rowFor(node.type)],
      w: NODE_W,
      h: nodeHeight(node)
    };
  });

  const maxX = Math.max(...Object.values(pos).map((value) => value.x + value.w)) + PAD_X;
  const maxY = Math.max(...Object.values(pos).map((value) => value.y + value.h)) + 48;

  return { pos, rowY, usedRows, w: maxX, h: maxY };
}
