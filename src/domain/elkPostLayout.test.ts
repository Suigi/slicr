import { describe, expect, it } from 'vitest';
import {
  applyBoundaryFloorPass,
  applyLaneGapPass,
  applyOverviewPostLayoutPasses,
  applySliceOrderFloorPass,
  applySuccessorGapPass,
  normalizeLeftPadding
} from './elkPostLayout';
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

  it('shifts later slices rightward based on the earlier slice rightmost extent', () => {
    const nodesById: Record<string, Position> = {
      'slice-1::a': pos(100, 0, 180),
      'slice-2::b': pos(150, 0, 180)
    };

    const changed = applySliceOrderFloorPass(
      [
        { sliceId: 'slice-1', nodeKeys: ['slice-1::a'] },
        { sliceId: 'slice-2', nodeKeys: ['slice-2::b'] }
      ],
      nodesById,
      80
    );

    expect(changed).toBe(true);
    expect(nodesById['slice-2::b'].x).toBe(360);
  });

  it('preserves larger existing inter-slice gaps', () => {
    const nodesById: Record<string, Position> = {
      'slice-1::a': pos(100, 0, 180),
      'slice-2::b': pos(420, 0, 180)
    };

    const changed = applySliceOrderFloorPass(
      [
        { sliceId: 'slice-1', nodeKeys: ['slice-1::a'] },
        { sliceId: 'slice-2', nodeKeys: ['slice-2::b'] }
      ],
      nodesById,
      80
    );

    expect(changed).toBe(false);
    expect(nodesById['slice-2::b'].x).toBe(420);
  });

  it('ignores empty slices when applying inter-slice floors', () => {
    const nodesById: Record<string, Position> = {
      'slice-1::a': pos(100, 0, 180),
      'slice-3::c': pos(150, 0, 180)
    };

    const changed = applySliceOrderFloorPass(
      [
        { sliceId: 'slice-1', nodeKeys: ['slice-1::a'] },
        { sliceId: 'slice-2', nodeKeys: [] },
        { sliceId: 'slice-3', nodeKeys: ['slice-3::c'] }
      ],
      nodesById,
      80
    );

    expect(changed).toBe(true);
    expect(nodesById['slice-3::c'].x).toBe(360);
  });

  it('follows the provided slice-selection order', () => {
    const nodesById: Record<string, Position> = {
      'slice-b::a': pos(100, 0, 180),
      'slice-a::b': pos(150, 0, 180)
    };

    const changed = applySliceOrderFloorPass(
      [
        { sliceId: 'slice-b', nodeKeys: ['slice-b::a'] },
        { sliceId: 'slice-a', nodeKeys: ['slice-a::b'] }
      ],
      nodesById,
      80
    );

    expect(changed).toBe(true);
    expect(nodesById['slice-a::b'].x).toBe(360);
  });

  it('reruns same-lane spacing after overview slice floors', () => {
    const nodesById: Record<string, Position> = {
      'slice-1::a': pos(100, 0, 180),
      'slice-2::b': pos(150, 0, 180),
      'slice-2::c': pos(170, 0, 180)
    };

    applyOverviewPostLayoutPasses({
      sliceSpecs: [
        { sliceId: 'slice-1', nodeKeys: ['slice-1::a'] },
        { sliceId: 'slice-2', nodeKeys: ['slice-2::b', 'slice-2::c'] }
      ],
      laneKeys: new Map([[0, ['slice-1::a', 'slice-2::b', 'slice-2::c']]]),
      nodesById,
      minInterSliceGap: 80,
      minLaneGap: 40,
      leftLayoutPadding: 100
    });

    expect(nodesById['slice-2::b'].x).toBe(360);
    expect(nodesById['slice-2::c'].x).toBe(580);
  });

  it('normalizes left padding after overview slice floors', () => {
    const nodesById: Record<string, Position> = {
      'slice-1::a': pos(140, 0, 180),
      'slice-2::b': pos(150, 0, 180)
    };

    applyOverviewPostLayoutPasses({
      sliceSpecs: [
        { sliceId: 'slice-1', nodeKeys: ['slice-1::a'] },
        { sliceId: 'slice-2', nodeKeys: ['slice-2::b'] }
      ],
      laneKeys: new Map([[0, ['slice-1::a', 'slice-2::b']]]),
      nodesById,
      minInterSliceGap: 80,
      minLaneGap: 40,
      leftLayoutPadding: 50
    });

    expect(nodesById['slice-1::a'].x).toBe(50);
    expect(nodesById['slice-2::b'].x).toBe(310);
  });
});
