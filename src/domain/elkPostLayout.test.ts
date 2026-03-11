import { describe, expect, it } from 'vitest';
import {
  applyBoundaryFloorPass,
  buildBoundarySpecs,
  applyLaneGapPass,
  applyOverviewPostLayoutPasses,
  applySliceOrderFloorPass,
  applySuccessorGapPass,
  normalizeLeftPadding
} from './elkPostLayout';
import { buildOverviewBoundaryAnchorByKey } from './overviewCrossSliceLinks';
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
      new Set(),
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
      new Set(),
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
      new Set(),
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
      new Set(),
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
      adjacentSharedNodePairs: [],
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
      adjacentSharedNodePairs: [],
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

  it('keeps one node-width of slice space when an adjacent shared-node target has no other visible nodes', () => {
    const nodesById: Record<string, Position> = {
      'slice-1::shared': pos(50, 0, 180),
      'slice-2::shared': pos(310, 0, 180),
      'slice-3::after': pos(570, 0, 180)
    };

    applyOverviewPostLayoutPasses({
      adjacentSharedNodePairs: [
        {
          sourceNodeKey: 'slice-1::shared',
          targetNodeKey: 'slice-2::shared',
          targetSliceId: 'slice-2'
        }
      ],
      sliceSpecs: [
        { sliceId: 'slice-1', nodeKeys: ['slice-1::shared'] },
        { sliceId: 'slice-2', nodeKeys: ['slice-2::shared'] },
        { sliceId: 'slice-3', nodeKeys: ['slice-3::after'] }
      ],
      laneKeys: new Map([[0, ['slice-1::shared', 'slice-2::shared', 'slice-3::after']]]),
      nodesById,
      minInterSliceGap: 80,
      minLaneGap: 40,
      leftLayoutPadding: 50
    });

    expect(nodesById['slice-2::shared'].x).toBe(310);
    expect(nodesById['slice-3::after'].x).toBe(570);
  });

  it('uses the shared representative as the effective boundary anchor for overview hidden targets', () => {
    const nodesById: Record<string, Position> = {
      'slice-1::shared': pos(50, 0, 180),
      'slice-2::shared': pos(310, 0, 180),
      'slice-2::form': pos(280, 120, 180)
    };

    applyOverviewPostLayoutPasses({
      adjacentSharedNodePairs: [
        {
          sourceNodeKey: 'slice-1::shared',
          targetNodeKey: 'slice-2::shared',
          targetSliceId: 'slice-2'
        }
      ],
      sliceSpecs: [
        { sliceId: 'slice-1', nodeKeys: ['slice-1::shared'] },
        { sliceId: 'slice-2', nodeKeys: ['slice-2::shared', 'slice-2::form'] }
      ],
      laneKeys: new Map([
        [1, ['slice-2::form']],
        [2, ['slice-1::shared', 'slice-2::shared']]
      ]),
      nodesById,
      edges: [],
      topoOrder: new Map([
        ['slice-1::shared', 0],
        ['slice-2::shared', 1],
        ['slice-2::form', 2]
      ]),
      dslOrder: new Map([
        ['slice-1::shared', 0],
        ['slice-2::shared', 1],
        ['slice-2::form', 2]
      ]),
      boundarySpecs: buildBoundarySpecs(
        [{ after: 'slice-2::shared' }],
        new Map([
          ['slice-1::shared', 0],
          ['slice-2::shared', 1],
          ['slice-2::form', 2]
        ]),
        buildOverviewBoundaryAnchorByKey([
          {
            key: 'slice-1::shared->slice-2::shared',
            logicalRef: 'evt:shared',
            fromOverviewNodeKey: 'slice-1::shared',
            toOverviewNodeKey: 'slice-2::shared',
            fromSliceId: 'slice-1',
            toSliceId: 'slice-2',
            fromSliceIndex: 0,
            toSliceIndex: 1,
            distance: 1,
            renderMode: 'shared-node'
          }
        ])
      ),
      minSuccessorGap: 40,
      minInterSliceGap: 80,
      minLaneGap: 40,
      leftLayoutPadding: 50
    });

    expect(nodesById['slice-2::form'].x).toBe(310);
  });

  it('reapplies successor-gap and boundary-floor rules after compacting an overview target slice', () => {
    const nodesById: Record<string, Position> = {
      'slice-1::shared': pos(50, 0, 180),
      'slice-2::shared': pos(310, 0, 180),
      'slice-2::lookup-book': pos(390, 0, 180),
      'slice-2::reserve-book': pos(410, 0, 180),
      'slice-2::book-reserved': pos(450, 120, 180),
      'slice-2::reservation-status': pos(630, 0, 180)
    };

    applyOverviewPostLayoutPasses({
      adjacentSharedNodePairs: [
        {
          sourceNodeKey: 'slice-1::shared',
          targetNodeKey: 'slice-2::shared',
          targetSliceId: 'slice-2'
        }
      ],
      sliceSpecs: [
        { sliceId: 'slice-1', nodeKeys: ['slice-1::shared'] },
        {
          sliceId: 'slice-2',
          nodeKeys: [
            'slice-2::shared',
            'slice-2::lookup-book',
            'slice-2::reserve-book',
            'slice-2::book-reserved',
            'slice-2::reservation-status'
          ]
        }
      ],
      laneKeys: new Map([
        [0, []],
        [1, ['slice-2::lookup-book', 'slice-2::reserve-book', 'slice-2::reservation-status']],
        [2, ['slice-1::shared', 'slice-2::shared', 'slice-2::book-reserved']]
      ]),
      nodesById,
      edges: [
        { from: 'slice-2::reserve-book', to: 'slice-2::book-reserved', label: null },
        { from: 'slice-2::book-reserved', to: 'slice-2::reservation-status', label: null }
      ],
      topoOrder: new Map([
        ['slice-1::shared', 0],
        ['slice-2::shared', 1],
        ['slice-2::lookup-book', 2],
        ['slice-2::reserve-book', 3],
        ['slice-2::book-reserved', 4],
        ['slice-2::reservation-status', 5]
      ]),
      dslOrder: new Map([
        ['slice-1::shared', 0],
        ['slice-2::shared', 1],
        ['slice-2::lookup-book', 2],
        ['slice-2::reserve-book', 3],
        ['slice-2::book-reserved', 4],
        ['slice-2::reservation-status', 5]
      ]),
      boundarySpecs: [{ afterKey: 'slice-2::reserve-book', afterIndex: 3 }],
      minSuccessorGap: 40,
      minInterSliceGap: 80,
      minLaneGap: 40,
      leftLayoutPadding: 50
    });

    expect(nodesById['slice-2::lookup-book'].x).toBe(310);
    expect(nodesById['slice-2::reserve-book'].x).toBe(530);
    expect(nodesById['slice-2::book-reserved'].x).toBeGreaterThanOrEqual(
      nodesById['slice-2::reserve-book'].x + 40
    );
    expect(nodesById['slice-2::reservation-status'].x).toBeGreaterThanOrEqual(
      nodesById['slice-2::reserve-book'].x + nodesById['slice-2::reserve-book'].w + 80
    );
  });
});
