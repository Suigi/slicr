import { describe, expect, it } from 'vitest';
import { buildCrossSliceUsageIndex, getCrossSliceUsage } from './crossSliceUsage';

describe('getCrossSliceUsage', () => {
  it('returns no usage for generic nodes', () => {
    const slices = [
      {
        id: 'slice-a',
        dsl: `slice "A"

generic-a "Generic A"
<- cmd:buy
`
      }
    ];

    const result = getCrossSliceUsage(slices, 'generic-a');
    expect(result).toEqual([]);
  });
});

describe('buildCrossSliceUsageIndex', () => {
  it('indexes non-generic nodes by node ref and type across slices', () => {
    const slices = [
      {
        id: 'slice-a',
        dsl: `slice "A"

cmd:buy "Buy"
`
      },
      {
        id: 'slice-b',
        dsl: `slice "B"

cmd:buy "Buy Again"
`
      }
    ];

    const index = buildCrossSliceUsageIndex(slices);
    expect(index['cmd:buy']).toEqual({
      nodeRef: 'cmd:buy',
      nodeType: 'cmd',
      sliceRefs: [
        { sliceId: 'slice-a', nodeKey: 'buy' },
        { sliceId: 'slice-b', nodeKey: 'buy' }
      ]
    });
  });
});
