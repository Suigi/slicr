import { describe, expect, it, vi } from 'vitest';
import { updateParsedSliceProjection } from './parsedSliceProjection';

describe('updateParsedSliceProjection', () => {
  it('returns previous map when inputs are unchanged', () => {
    const parse = vi.fn((dsl: string) => ({ marker: dsl.length }));
    const first = updateParsedSliceProjection(
      new Map(),
      [
        { id: 'a', dsl: 'slice "A"' },
        { id: 'b', dsl: 'slice "B"' }
      ],
      parse
    );

    parse.mockClear();

    const second = updateParsedSliceProjection(
      first,
      [
        { id: 'a', dsl: 'slice "A"' },
        { id: 'b', dsl: 'slice "B"' }
      ],
      parse
    );

    expect(second).toBe(first);
    expect(parse).not.toHaveBeenCalled();
  });

  it('reuses unchanged slices and reparses only changed/new slices', () => {
    const parse = vi.fn((dsl: string) => ({ marker: dsl.length }));
    const first = updateParsedSliceProjection(
      new Map(),
      [
        { id: 'a', dsl: 'slice "A"' },
        { id: 'b', dsl: 'slice "B"' }
      ],
      parse
    );

    const aBefore = first.get('a');
    const bBefore = first.get('b');
    parse.mockClear();

    const second = updateParsedSliceProjection(
      first,
      [
        { id: 'a', dsl: 'slice "A" edited' },
        { id: 'b', dsl: 'slice "B"' },
        { id: 'c', dsl: 'slice "C"' }
      ],
      parse
    );

    expect(parse).toHaveBeenCalledTimes(2);
    expect(second.get('b')).toBe(bBefore);
    expect(second.get('a')).not.toBe(aBefore);
    expect(second.get('c')).toBeDefined();
  });
});
