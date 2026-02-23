import { describe, expect, it } from 'vitest';
import { buildCrossSliceUsageIndex, createCrossSliceUsageQuery, getCrossSliceUsage } from './crossSliceUsage';

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

  it('groups node versions under one canonical analysis ref', () => {
    const slices = [
      {
        id: 'slice-a',
        dsl: `slice "A"

cmd:buy@1 "Buy V1"
`
      },
      {
        id: 'slice-b',
        dsl: `slice "B"

cmd:buy@2 "Buy V2"
`
      }
    ];

    const index = buildCrossSliceUsageIndex(slices);
    expect(index['cmd:buy']).toEqual({
      nodeRef: 'cmd:buy',
      nodeType: 'cmd',
      sliceRefs: [
        { sliceId: 'slice-a', nodeKey: 'buy@1' },
        { sliceId: 'slice-b', nodeKey: 'buy@2' }
      ]
    });
  });
});

describe('createCrossSliceUsageQuery', () => {
  it('exposes getCrossSliceUsage(nodeId) backed by the usage index', () => {
    const slices = [
      {
        id: 'slice-a',
        dsl: `slice "A"

cmd:buy "Buy"
`
      }
    ];

    const query = createCrossSliceUsageQuery(slices);
    expect(query.getCrossSliceUsage('cmd:buy')).toEqual([{ sliceId: 'slice-a', nodeKey: 'buy' }]);
  });
});
