import { describe, expect, it } from 'vitest';
import { applyBoundaryFloorPass, applyLaneGapPass, applySuccessorGapPass, normalizeLeftPadding } from './elkPostLayout';
import type { Edge, Position } from './types';

function pos(x: number, y = 0, w = 180, h = 42): Position {
  return { x, y, w, h };
}

describe('elkPostLayout', () => {
  it('applies successor x-gap constraints', () => {
    const nodesById: Record<string, Position> = {
      a: pos(100),
      b: pos(110)
    };
    const edges: Edge[] = [{ from: 'a', to: 'b', label: null }];
    const changed = applySuccessorGapPass(edges, new Map([['a', 0], ['b', 1]]), nodesById, 40);

    expect(changed).toBe(true);
    expect(nodesById.b.x).toBe(140);
  });

  it('applies minimum same-lane spacing', () => {
    const nodesById: Record<string, Position> = {
      a: pos(100),
      b: pos(200)
    };
    const changed = applyLaneGapPass(new Map([[1, ['a', 'b']]]), nodesById, 40);

    expect(changed).toBe(true);
    expect(nodesById.b.x).toBe(320);
  });

  it('applies boundary floor offsets based on earlier boundary anchors', () => {
    const nodesById: Record<string, Position> = {
      a: pos(100),
      b: pos(150)
    };
    const dslOrder = new Map<string, number>([['a', 0], ['b', 2]]);
    const changed = applyBoundaryFloorPass(dslOrder, [{ afterKey: 'a', afterIndex: 0 }], nodesById);

    expect(changed).toBe(true);
    expect(nodesById.b.x).toBe(360);
  });

  it('normalizes layout so left-most node starts at requested padding', () => {
    const nodesById: Record<string, Position> = {
      a: pos(451),
      b: pos(531)
    };
    normalizeLeftPadding(nodesById, 50);

    expect(nodesById.a.x).toBe(50);
    expect(nodesById.b.x).toBe(130);
  });
});
