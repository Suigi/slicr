import { PAD_X } from './layoutGraph';
import type { Edge, Position } from './types';

export type BoundarySpec = { afterKey: string; afterIndex: number };
export type SliceOrderFloorSpec = { sliceId: string; nodeKeys: string[] };
export type OverviewPostLayoutArgs = {
  sliceSpecs: SliceOrderFloorSpec[];
  laneKeys: Map<number, string[]>;
  nodesById: Record<string, Position>;
  minInterSliceGap: number;
  minLaneGap: number;
  leftLayoutPadding: number;
  maxPasses?: number;
};

export function applySuccessorGapPass(
  edges: Edge[],
  topoOrder: Map<string, number>,
  nodesById: Record<string, Position>,
  minSuccessorGap: number
): boolean {
  let changed = false;
  for (const edge of edges) {
    const sourceOrder = topoOrder.get(edge.from) ?? 0;
    const targetOrder = topoOrder.get(edge.to) ?? 0;
    if (sourceOrder >= targetOrder) {
      continue;
    }
    const source = nodesById[edge.from];
    const target = nodesById[edge.to];
    if (!source || !target) {
      continue;
    }
    const requiredTargetX = source.x + minSuccessorGap;
    if (target.x < requiredTargetX) {
      target.x = requiredTargetX;
      changed = true;
    }
  }
  return changed;
}

export function applyLaneGapPass(
  laneKeys: Map<number, string[]>,
  nodesById: Record<string, Position>,
  minLaneGap: number
): boolean {
  let changed = false;
  for (const keys of laneKeys.values()) {
    keys.sort((a, b) => (nodesById[a]?.x ?? 0) - (nodesById[b]?.x ?? 0));
    let nextMinX = Number.NEGATIVE_INFINITY;
    for (const key of keys) {
      const position = nodesById[key];
      if (!position) {
        continue;
      }
      if (position.x < nextMinX) {
        position.x = nextMinX;
        changed = true;
      }
      nextMinX = position.x + position.w + minLaneGap;
    }
  }
  return changed;
}

export function applyBoundaryFloorPass(
  dslOrder: Map<string, number>,
  boundarySpecs: BoundarySpec[],
  nodesById: Record<string, Position>
): boolean {
  let changed = false;
  for (const [key, orderIndex] of dslOrder.entries()) {
    const position = nodesById[key];
    if (!position) {
      continue;
    }
    let minX = Number.NEGATIVE_INFINITY;
    for (const boundary of boundarySpecs) {
      if (boundary.afterIndex >= orderIndex) {
        break;
      }
      const anchor = nodesById[boundary.afterKey];
      if (!anchor) {
        continue;
      }
      minX = Math.max(minX, anchor.x + anchor.w + 40 + PAD_X);
    }
    if (position.x < minX) {
      position.x = minX;
      changed = true;
    }
  }
  return changed;
}

export function applySliceOrderFloorPass(
  sliceSpecs: SliceOrderFloorSpec[],
  nodesById: Record<string, Position>,
  minInterSliceGap: number
): boolean {
  let changed = false;
  let previousSliceRightEdge = Number.NEGATIVE_INFINITY;

  for (const slice of sliceSpecs) {
    const sliceNodes = slice.nodeKeys
      .map((key) => nodesById[key])
      .filter((node): node is Position => Boolean(node));
    if (sliceNodes.length === 0) {
      continue;
    }

    const sliceMinX = Math.min(...sliceNodes.map((node) => node.x));
    const requiredMinX = previousSliceRightEdge + minInterSliceGap;
    if (Number.isFinite(requiredMinX) && sliceMinX < requiredMinX) {
      const delta = requiredMinX - sliceMinX;
      for (const key of slice.nodeKeys) {
        const node = nodesById[key];
        if (!node) {
          continue;
        }
        node.x += delta;
      }
      changed = true;
    }

    previousSliceRightEdge = Math.max(
      previousSliceRightEdge,
      ...slice.nodeKeys
        .map((key) => nodesById[key])
        .filter((node): node is Position => Boolean(node))
        .map((node) => node.x + node.w)
    );
  }

  return changed;
}

export function applyOverviewPostLayoutPasses({
  sliceSpecs,
  laneKeys,
  nodesById,
  minInterSliceGap,
  minLaneGap,
  leftLayoutPadding,
  maxPasses = 6
}: OverviewPostLayoutArgs): void {
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const movedBySliceFloors = applySliceOrderFloorPass(sliceSpecs, nodesById, minInterSliceGap);
    const movedByLaneGap = applyLaneGapPass(laneKeys, nodesById, minLaneGap);
    if (!movedBySliceFloors && !movedByLaneGap) {
      break;
    }
  }

  normalizeLeftPadding(nodesById, leftLayoutPadding);
}

export function normalizeLeftPadding(nodesById: Record<string, Position>, leftLayoutPadding: number): void {
  let minX = Number.POSITIVE_INFINITY;
  for (const node of Object.values(nodesById)) {
    minX = Math.min(minX, node.x);
  }
  if (!Number.isFinite(minX) || minX <= leftLayoutPadding) {
    return;
  }
  const shiftX = minX - leftLayoutPadding;
  for (const node of Object.values(nodesById)) {
    node.x -= shiftX;
  }
}
