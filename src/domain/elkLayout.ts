import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode } from 'elkjs/lib/elk-api';
import { DiagramEdgeGeometry, routeElkEdges } from './diagramRouting';
import { applyBoundaryFloorPass, applyLaneGapPass, applySuccessorGapPass } from './elkPostLayout';
import { nodeHeight, PAD_X, rowFor } from './layoutGraph';
import type { Parsed, Position } from './types';

export type ElkComputedLayout = {
  pos: Record<string, Position>;
  w: number;
  h: number;
  edges: Record<string, DiagramEdgeGeometry>;
  laneByKey: Map<string, number>;
  rowStreamLabels: Record<number, string>;
};

const EDGE_NODE_AVOIDANCE_CLEARANCE_X = 26;
const EDGE_NODE_AVOIDANCE_GRID_X = 15;
const EDGE_NODE_AVOIDANCE_GRID_Y = 10;

function overlapsRange(minA: number, maxA: number, minB: number, maxB: number): boolean {
  return maxA >= minB && maxB >= minA;
}

function snapUpToGrid(value: number, grid: number): number {
  return Math.ceil(value / grid) * grid;
}

function applyVerticalEdgeNodeAvoidancePass(
  parsed: Parsed,
  nodesById: Record<string, Position>,
  movedNodeKeys?: Set<string>
): boolean {
  const routed = routeElkEdges(
    parsed.edges.map((edge, index) => ({
      key: `${edge.from}->${edge.to}#${index}`,
      from: edge.from,
      to: edge.to
    })),
    nodesById
  );
  let changed = false;

  parsed.edges.forEach((edge, index) => {
    const key = `${edge.from}->${edge.to}#${index}`;
    const geometry = routed[key];
    const points = geometry?.points;
    if (!points || points.length < 2) {
      return;
    }

    for (let i = 0; i < points.length - 1; i += 1) {
      const start = points[i];
      const end = points[i + 1];
      if (Math.abs(start.x - end.x) > 0.001) {
        continue;
      }
      const segmentX = start.x;
      const segMinY = Math.min(start.y, end.y);
      const segMaxY = Math.max(start.y, end.y);

      for (const [nodeKey, node] of Object.entries(nodesById)) {
        if (nodeKey === edge.from || nodeKey === edge.to) {
          continue;
        }
        if (!overlapsRange(segMinY, segMaxY, node.y, node.y + node.h)) {
          continue;
        }
        if (segmentX < node.x || segmentX > node.x + node.w) {
          continue;
        }
        const desiredX = snapUpToGrid(segmentX + EDGE_NODE_AVOIDANCE_CLEARANCE_X + 1, EDGE_NODE_AVOIDANCE_GRID_X);
        if (node.x < desiredX) {
          node.x = desiredX;
          node.y = Math.round(node.y / EDGE_NODE_AVOIDANCE_GRID_Y) * EDGE_NODE_AVOIDANCE_GRID_Y;
          movedNodeKeys?.add(nodeKey);
          changed = true;
        }
      }
    }
  });

  return changed;
}

function applyEdgeDensityGapPass(
  parsed: Parsed,
  topoOrder: Map<string, number>,
  nodesById: Record<string, Position>
): boolean {
  const outgoingCount = new Map<string, number>();
  const incomingCount = new Map<string, number>();
  for (const edge of parsed.edges) {
    outgoingCount.set(edge.from, (outgoingCount.get(edge.from) ?? 0) + 1);
    incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1);
  }

  let changed = false;
  for (const edge of parsed.edges) {
    const source = nodesById[edge.from];
    const target = nodesById[edge.to];
    if (!source || !target) {
      continue;
    }
    const sourceOrder = topoOrder.get(edge.from) ?? 0;
    const targetOrder = topoOrder.get(edge.to) ?? 0;
    if (sourceOrder >= targetOrder) {
      continue;
    }
    const density = Math.max(outgoingCount.get(edge.from) ?? 1, incomingCount.get(edge.to) ?? 1);
    const requiredGap = 40 + Math.max(0, density - 1) * 12;
    const minTargetX = source.x + requiredGap;
    if (target.x < minTargetX) {
      target.x = minTargetX;
      changed = true;
    }
  }
  return changed;
}

function buildTopoOrder(parsed: Parsed): Map<string, number> {
  const nodeKeys = [...parsed.nodes.keys()];
  const dslOrder = new Map<string, number>();
  nodeKeys.forEach((key, index) => dslOrder.set(key, index));
  const incomingCount = new Map<string, number>();
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  nodeKeys.forEach((key) => {
    incomingCount.set(key, 0);
    incoming.set(key, []);
    outgoing.set(key, []);
  });

  for (const edge of parsed.edges) {
    if (!parsed.nodes.has(edge.from) || !parsed.nodes.has(edge.to)) {
      continue;
    }
    outgoing.get(edge.from)?.push(edge.to);
    incoming.get(edge.to)?.push(edge.from);
    incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1);
  }

  const compareReadyNodes = (left: string, right: string) => {
    const leftTargets = outgoing.get(left) ?? [];
    const rightTargets = outgoing.get(right) ?? [];
    const leftMinTarget = leftTargets.reduce(
      (min, key) => Math.min(min, dslOrder.get(key) ?? Number.MAX_SAFE_INTEGER),
      Number.MAX_SAFE_INTEGER
    );
    const rightMinTarget = rightTargets.reduce(
      (min, key) => Math.min(min, dslOrder.get(key) ?? Number.MAX_SAFE_INTEGER),
      Number.MAX_SAFE_INTEGER
    );
    if (leftMinTarget !== rightMinTarget) {
      return leftMinTarget - rightMinTarget;
    }

    const leftSources = incoming.get(left) ?? [];
    const rightSources = incoming.get(right) ?? [];
    const leftMinSource = leftSources.reduce(
      (min, key) => Math.min(min, dslOrder.get(key) ?? Number.MAX_SAFE_INTEGER),
      Number.MAX_SAFE_INTEGER
    );
    const rightMinSource = rightSources.reduce(
      (min, key) => Math.min(min, dslOrder.get(key) ?? Number.MAX_SAFE_INTEGER),
      Number.MAX_SAFE_INTEGER
    );
    if (leftMinSource !== rightMinSource) {
      return leftMinSource - rightMinSource;
    }

    return (dslOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (dslOrder.get(right) ?? Number.MAX_SAFE_INTEGER);
  };

  const queue = nodeKeys.filter((key) => (incomingCount.get(key) ?? 0) === 0).sort(compareReadyNodes);
  const ordered: string[] = [];
  while (queue.length > 0) {
    queue.sort(compareReadyNodes);
    const current = queue.shift() as string;
    ordered.push(current);
    for (const next of outgoing.get(current) ?? []) {
      const nextIncoming = (incomingCount.get(next) ?? 1) - 1;
      incomingCount.set(next, nextIncoming);
      if (nextIncoming === 0) {
        queue.push(next);
      }
    }
  }
  for (const key of nodeKeys) {
    if (!ordered.includes(key)) {
      ordered.push(key);
    }
  }

  const order = new Map<string, number>();
  ordered.forEach((key, index) => order.set(key, index));
  return order;
}

export function buildElkLaneMeta(parsed: Parsed) {
  const laneByKey = new Map<string, number>();
  const rowStreamLabels: Record<number, string> = {};
  const eventsByStream = new Map<string, string[]>();

  for (const node of parsed.nodes.values()) {
    if (node.type === 'ui' || node.type === 'aut' || node.type === 'ext' || node.type === 'generic') {
      laneByKey.set(node.key, 0);
      continue;
    }
    if (node.type === 'exc') {
      const list = eventsByStream.get('default');
      if (list) {
        list.push(node.key);
      } else {
        eventsByStream.set('default', [node.key]);
      }
      continue;
    }

    if (node.type !== 'evt') {
      laneByKey.set(node.key, 1);
      continue;
    }

    const stream = node.stream?.trim() || 'default';
    const list = eventsByStream.get(stream);
    if (list) {
      list.push(node.key);
    } else {
      eventsByStream.set(stream, [node.key]);
    }
  }

  const streamOrder = [...eventsByStream.keys()].sort((a, b) => {
    if (a === 'default') return 1;
    if (b === 'default') return -1;
    return 0;
  });

  streamOrder.forEach((stream, index) => {
    const lane = 2 + index;
    for (const key of eventsByStream.get(stream) ?? []) {
      laneByKey.set(key, lane);
    }
    if (stream !== 'default') {
      rowStreamLabels[lane] = stream;
    }
  });

  return { laneByKey, rowStreamLabels };
}

export async function computeElkLayout(
  parsed: Parsed,
  measuredHeights?: Record<string, number>
): Promise<ElkComputedLayout> {
  const elkTopOffset = 12;
  const elk = new ELK();
  const topoOrder = buildTopoOrder(parsed);
  const { laneByKey, rowStreamLabels } = buildElkLaneMeta(parsed);
  const dslOrder = new Map<string, number>();
  [...parsed.nodes.keys()].forEach((key, index) => dslOrder.set(key, index));
  const boundarySpecs = parsed.boundaries
    .map((boundary) => {
      const afterIndex = dslOrder.get(boundary.after);
      if (afterIndex === undefined) {
        return null;
      }
      return { afterKey: boundary.after, afterIndex };
    })
    .filter((spec): spec is { afterKey: string; afterIndex: number } => spec !== null)
    .sort((a, b) => a.afterIndex - b.afterIndex);
  const children = [...parsed.nodes.values()].sort((a, b) => {
    const topoA = topoOrder.get(a.key) ?? Number.MAX_SAFE_INTEGER;
    const topoB = topoOrder.get(b.key) ?? Number.MAX_SAFE_INTEGER;
    if (topoA !== topoB) {
      return topoA - topoB;
    }
    const laneA = laneByKey.get(a.key) ?? rowFor(a.type);
    const laneB = laneByKey.get(b.key) ?? rowFor(b.type);
    if (laneA !== laneB) {
      return laneA - laneB;
    }
    return (dslOrder.get(a.key) ?? 0) - (dslOrder.get(b.key) ?? 0);
  });

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'org.eclipse.elk.layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'org.eclipse.elk.partitioning.activate': 'true',
      'org.eclipse.elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
      'org.eclipse.elk.layered.considerModelOrder.noModelOrder': 'false',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.spacing.nodeNode': '120',
      'elk.spacing.edgeNode': '48',
      'elk.spacing.edgeEdge': '48',
      'org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'org.eclipse.elk.layered.spacing.edgeNodeBetweenLayers': '48',
      'org.eclipse.elk.layered.spacing.edgeEdgeBetweenLayers': '36'
    },
    children: children.map((node) => {
      const lane = laneByKey.get(node.key) ?? rowFor(node.type);
      return {
        id: node.key,
        width: 180,
        height: nodeHeight(node, measuredHeights),
        layoutOptions: {
          'org.eclipse.elk.partitioning.partition': String(lane),
          'org.eclipse.elk.layered.crossingMinimization.positionId': String(topoOrder.get(node.key) ?? 0)
        }
      };
    }),
    edges: parsed.edges.map((edge, index) => ({
      id: `${edge.from}->${edge.to}#${index}`,
      sources: [edge.from],
      targets: [edge.to]
    }))
  };

  const result = await elk.layout(graph);
  const nodesById: Record<string, Position> = {};
  for (const child of result.children ?? []) {
    nodesById[child.id] = {
      x: (child.y ?? 0) + PAD_X,
      y: (child.x ?? 0) + 40 + elkTopOffset,
      w: child.width ?? 180,
      h: child.height ?? 42
    };
  }

  const minSuccessorGap = 40;
  const minLaneGap = 40;
  const laneKeys = new Map<number, string[]>();
  for (const node of parsed.nodes.values()) {
    const lane = laneByKey.get(node.key) ?? rowFor(node.type);
    const list = laneKeys.get(lane) ?? [];
    list.push(node.key);
    laneKeys.set(lane, list);
  }

  const maxPasses = Math.max(6, parsed.edges.length * 3);
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const movedBySuccessorGap = applySuccessorGapPass(parsed.edges, topoOrder, nodesById, minSuccessorGap);
    const movedByBoundaryFloors = applyBoundaryFloorPass(dslOrder, boundarySpecs, nodesById);
    const movedByLaneGap = applyLaneGapPass(laneKeys, nodesById, minLaneGap);
    if (!movedBySuccessorGap && !movedByBoundaryFloors && !movedByLaneGap) {
      break;
    }
  }

  const laneGapY = 40;
  const laneBottomPadding = 40;
  const orderedLanes = [...laneKeys.keys()].sort((a, b) => a - b);
  let laneTop = 40 + elkTopOffset;
  for (const lane of orderedLanes) {
    const keys = laneKeys.get(lane) ?? [];
    let laneHeight = 0;
    for (const key of keys) {
      const node = nodesById[key];
      if (!node) {
        continue;
      }
      laneHeight = Math.max(laneHeight, node.h);
    }
    for (const key of keys) {
      const node = nodesById[key];
      if (!node) {
        continue;
      }
      node.y = laneTop;
    }
    laneTop += laneHeight + laneBottomPadding + laneGapY;
  }

  const avoidanceMovedNodeKeys = new Set<string>();
  for (let pass = 0; pass < 6; pass += 1) {
    const movedByNodeAvoidance = applyVerticalEdgeNodeAvoidancePass(parsed, nodesById, avoidanceMovedNodeKeys);
    const movedByDensityGap = applyEdgeDensityGapPass(parsed, topoOrder, nodesById);
    const movedBySuccessorGap = applySuccessorGapPass(parsed.edges, topoOrder, nodesById, minSuccessorGap);
    const movedByBoundaryFloors = applyBoundaryFloorPass(dslOrder, boundarySpecs, nodesById);
    const movedByLaneGap = applyLaneGapPass(laneKeys, nodesById, minLaneGap);
    if (!movedByNodeAvoidance && !movedByDensityGap && !movedBySuccessorGap && !movedByBoundaryFloors && !movedByLaneGap) {
      break;
    }
  }

  let minX = Number.POSITIVE_INFINITY;
  for (const node of Object.values(nodesById)) {
    minX = Math.min(minX, node.x);
  }
  let leftShift = 0;
  if (Number.isFinite(minX) && minX > 50) {
    leftShift = minX - 50;
    for (const node of Object.values(nodesById)) {
      node.x -= leftShift;
    }
  }
  if (leftShift > 0) {
    for (const key of avoidanceMovedNodeKeys) {
      const moved = nodesById[key];
      if (moved) {
        moved.x += leftShift;
      }
    }
  }

  let maxX = 0;
  let maxY = 0;
  for (const node of Object.values(nodesById)) {
    maxX = Math.max(maxX, node.x + node.w);
    maxY = Math.max(maxY, node.y + node.h);
  }

  const edges: Record<string, DiagramEdgeGeometry> = routeElkEdges(
    parsed.edges.map((edge, index) => ({
      key: `${edge.from}->${edge.to}#${index}`,
      from: edge.from,
      to: edge.to
    })),
    nodesById
  );
  Object.values(edges).forEach((geometry) => {
    const points = geometry.d
      .split(/[ML ]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    for (let i = 0; i + 1 < points.length; i += 2) {
      const x = Number(points[i]);
      const y = Number(points[i + 1]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  });

  return {
    pos: nodesById,
    w: maxX + PAD_X,
    h: maxY + 48,
    edges,
    laneByKey,
    rowStreamLabels
  };
}
