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
});
