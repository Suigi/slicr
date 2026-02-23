import { describe, expect, it } from 'vitest';
import { getCrossSliceUsage } from './crossSliceUsage';

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
