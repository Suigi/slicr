import { describe, expect, it } from 'vitest';
import { getCrossSliceData } from './crossSliceData';

describe('getCrossSliceData', () => {
  it('returns keys alphabetically for the selected non-generic node ref', () => {
    const slices = [
      {
        id: 'a',
        dsl: `slice "A"

cmd:buy
data:
  beta: 2
  alpha: 1
`
      },
      {
        id: 'b',
        dsl: `slice "B"

cmd:buy
data:
  gamma: 3
`
      }
    ];

    const result = getCrossSliceData(slices, 'cmd:buy');
    expect(result.keys).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('returns per-key values for each slice where the node exists', () => {
    const slices = [
      {
        id: 'a',
        dsl: `slice "A"

cmd:buy
data:
  alpha: 1
`
      },
      {
        id: 'b',
        dsl: `slice "B"

cmd:buy
data:
  alpha: 1
`
      }
    ];

    const result = getCrossSliceData(slices, 'cmd:buy');
    expect(result.byKey.alpha).toEqual([
      { sliceId: 'a', sliceName: 'A', value: 1 },
      { sliceId: 'b', sliceName: 'B', value: 1 }
    ]);
  });

  it('orders per-slice values deterministically by slice name then id', () => {
    const slices = [
      {
        id: 'b',
        dsl: `slice "Beta"

cmd:buy
data:
  alpha: 2
`
      },
      {
        id: 'a',
        dsl: `slice "Alpha"

cmd:buy
data:
  alpha: 1
`
      }
    ];

    const result = getCrossSliceData(slices, 'cmd:buy');
    expect(result.byKey.alpha).toEqual([
      { sliceId: 'a', sliceName: 'Alpha', value: 1 },
      { sliceId: 'b', sliceName: 'Beta', value: 2 }
    ]);
  });

  it('merges node versions under one canonical analysis ref', () => {
    const slices = [
      {
        id: 'a',
        dsl: `slice "Alpha"

cmd:buy@1
data:
  alpha: 1
`
      },
      {
        id: 'b',
        dsl: `slice "Beta"

cmd:buy@2
data:
  alpha: 2
`
      }
    ];

    const result = getCrossSliceData(slices, 'cmd:buy');
    expect(result.byKey.alpha).toEqual([
      { sliceId: 'a', sliceName: 'Alpha', value: 1 },
      { sliceId: 'b', sliceName: 'Beta', value: 2 }
    ]);
  });
});
