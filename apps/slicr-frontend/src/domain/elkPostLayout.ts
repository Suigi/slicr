import { PAD_X } from './layoutGraph';
import type { Edge, Position } from './types';

export type BoundarySpec = { afterKey: string; afterIndex: number };
export type SliceOrderFloorSpec = {
  sliceId: string;
  nodeKeys: string[];
  scenarioGroupWidth?: number;
};
export type AdjacentSharedNodePairSpec = {
  sourceNodeKey: string;
  targetNodeKey: string;
  targetSliceId: string;
};
export type OverviewPostLayoutArgs = {
  adjacentSharedNodePairs: AdjacentSharedNodePairSpec[];
  sliceSpecs: SliceOrderFloorSpec[];
  laneKeys: Map<number, string[]>;
  nodesById: Record<string, Position>;
  edges?: Edge[];
  topoOrder?: Map<string, number>;
  dslOrder?: Map<string, number>;
  boundarySpecs?: BoundarySpec[];
  minSuccessorGap?: number;
  minInterSliceGap: number;
  minLaneGap: number;
  leftLayoutPadding: number;
  maxPasses?: number;
};

export function buildBoundarySpecs(
  boundaries: Array<{ after: string }>,
  dslOrder: Map<string, number>,
  effectiveAnchorByKey: Map<string, string> = new Map()
): BoundarySpec[] {
  return boundaries
    .map((boundary) => {
      const afterIndex = dslOrder.get(boundary.after);
      if (afterIndex === undefined) {
        return null;
      }
      return {
        afterKey: effectiveAnchorByKey.get(boundary.after) ?? boundary.after,
        afterIndex
      };
    })
    .filter((spec): spec is BoundarySpec => spec !== null)
    .sort((a, b) => a.afterIndex - b.afterIndex);
}

function measureSliceBounds(
  sliceSpec: SliceOrderFloorSpec,
  hiddenTargetNodeKeys: Set<string>,
  nodesById: Record<string, Position>
) {
  const allNodes = sliceSpec.nodeKeys
    .map((key) => ({ key, position: nodesById[key] }))
    .filter((entry): entry is { key: string; position: Position } => Boolean(entry.position));
  if (allNodes.length === 0) {
    return null;
  }

  const visibleNodes = allNodes.filter((entry) => !hiddenTargetNodeKeys.has(entry.key));
  const effectiveNodes = visibleNodes.length > 0 ? visibleNodes : allNodes;

  return {
    minX: Math.min(...effectiveNodes.map((entry) => entry.position.x)),
    rightEdge: Math.max(...effectiveNodes.map((entry) => entry.position.x + entry.position.w))
  };
}

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
  hiddenTargetNodeKeys: Set<string>,
  nodesById: Record<string, Position>,
  minInterSliceGap: number
): boolean {
  let changed = false;
  let previousSliceRightEdge = Number.NEGATIVE_INFINITY;

  for (const slice of sliceSpecs) {
    const sliceBounds = measureSliceBounds(slice, hiddenTargetNodeKeys, nodesById);
    if (!sliceBounds) {
      continue;
    }

    const sliceMinX = sliceBounds.minX;
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

    const scenarioGroupRightEdge = typeof slice.scenarioGroupWidth === 'number'
      ? (sliceMinX - 28) + slice.scenarioGroupWidth
      : Number.NEGATIVE_INFINITY;
    previousSliceRightEdge = Math.max(
      previousSliceRightEdge,
      sliceBounds.rightEdge,
      scenarioGroupRightEdge
    );
  }

  return changed;
}

export function applySliceInternalOrderPass(
  sliceSpecs: SliceOrderFloorSpec[],
  hiddenTargetNodeKeys: Set<string>,
  nodesById: Record<string, Position>,
  minNodeOrderGap: number,
  targetSliceIds?: Set<string>
): boolean {
  let changed = false;

  for (const slice of sliceSpecs) {
    if (targetSliceIds && !targetSliceIds.has(slice.sliceId)) {
      continue;
    }

    let nextMinX = Number.NEGATIVE_INFINITY;
    for (const key of slice.nodeKeys) {
      if (hiddenTargetNodeKeys.has(key)) {
        continue;
      }
      const node = nodesById[key];
      if (!node) {
        continue;
      }
      if (node.x < nextMinX) {
        node.x = nextMinX;
        changed = true;
      }
      nextMinX = node.x + minNodeOrderGap;
    }
  }

  return changed;
}

export function applyAdjacentSharedNodeCompactionPass(
  adjacentSharedNodePairs: AdjacentSharedNodePairSpec[],
  sliceSpecs: SliceOrderFloorSpec[],
  minInterSliceGap: number,
  nodesById: Record<string, Position>
): boolean {
  let changed = false;
  const hiddenTargetNodeKeys = new Set(adjacentSharedNodePairs.map((pair) => pair.targetNodeKey));
  const sliceIndexById = new Map(sliceSpecs.map((sliceSpec, index) => [sliceSpec.sliceId, index]));

  for (const pair of adjacentSharedNodePairs) {
    const targetSliceIndex = sliceIndexById.get(pair.targetSliceId);
    if (targetSliceIndex === undefined || targetSliceIndex === 0) {
      continue;
    }
    const previousSliceBounds = measureSliceBounds(
      sliceSpecs[targetSliceIndex - 1],
      hiddenTargetNodeKeys,
      nodesById
    );
    const targetSliceBounds = measureSliceBounds(
      sliceSpecs[targetSliceIndex],
      hiddenTargetNodeKeys,
      nodesById
    );
    if (!previousSliceBounds || !targetSliceBounds) {
      continue;
    }

    const requiredMinX = previousSliceBounds.rightEdge + minInterSliceGap;
    const delta = requiredMinX - targetSliceBounds.minX;
    if (delta >= 0) {
      continue;
    }

    for (let sliceIndex = targetSliceIndex; sliceIndex < sliceSpecs.length; sliceIndex += 1) {
      for (const key of sliceSpecs[sliceIndex].nodeKeys) {
        const node = nodesById[key];
        if (!node) {
          continue;
        }
        node.x += delta;
      }
    }
    changed = true;
  }

  return changed;
}

export function applyOverviewPostLayoutPasses({
  adjacentSharedNodePairs,
  sliceSpecs,
  laneKeys,
  nodesById,
  edges = [],
  topoOrder,
  dslOrder,
  boundarySpecs = [],
  minSuccessorGap = 40,
  minInterSliceGap,
  minLaneGap,
  leftLayoutPadding,
  maxPasses = 6
}: OverviewPostLayoutArgs): void {
  const hiddenTargetNodeKeys = new Set(adjacentSharedNodePairs.map((pair) => pair.targetNodeKey));
  const compactedTargetSliceIds = new Set(adjacentSharedNodePairs.map((pair) => pair.targetSliceId));
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const movedBySharedNodeCompaction = applyAdjacentSharedNodeCompactionPass(
      adjacentSharedNodePairs,
      sliceSpecs,
      minInterSliceGap,
      nodesById
    );
    const movedBySliceFloors = applySliceOrderFloorPass(
      sliceSpecs,
      hiddenTargetNodeKeys,
      nodesById,
      minInterSliceGap
    );
    const movedBySliceInternalOrder = applySliceInternalOrderPass(
      sliceSpecs,
      hiddenTargetNodeKeys,
      nodesById,
      minSuccessorGap + 1,
      compactedTargetSliceIds
    );
    const movedBySuccessorGap = topoOrder
      ? applySuccessorGapPass(edges, topoOrder, nodesById, minSuccessorGap)
      : false;
    const movedByBoundaryFloors = dslOrder
      ? applyBoundaryFloorPass(dslOrder, boundarySpecs, nodesById)
      : false;
    const movedByLaneGap = applyLaneGapPass(laneKeys, nodesById, minLaneGap);
    if (
      !movedBySharedNodeCompaction &&
      !movedBySliceFloors &&
      !movedBySliceInternalOrder &&
      !movedBySuccessorGap &&
      !movedByBoundaryFloors &&
      !movedByLaneGap
    ) {
      break;
    }
  }

  applySliceInternalOrderPass(
    sliceSpecs,
    hiddenTargetNodeKeys,
    nodesById,
    minSuccessorGap + 1,
    compactedTargetSliceIds
  );
  if (topoOrder) {
    applySuccessorGapPass(edges, topoOrder, nodesById, minSuccessorGap);
  }
  if (dslOrder) {
    applyBoundaryFloorPass(dslOrder, boundarySpecs, nodesById);
  }
  applyLaneGapPass(laneKeys, nodesById, minLaneGap);

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
