import { describe, expect, it } from 'vitest';
import { edgePath } from './edgePath';

describe('edgePath', () => {
  it('builds a horizontal curve for nodes on the same row', () => {
    const from = { x: 10, y: 20, w: 100, h: 40 };
    const to = { x: 180, y: 22, w: 100, h: 40 };

    const geometry = edgePath(from, to);

    expect(geometry.d).toBe('M 110 40 C 145 40 145 42 180 42');
    expect(geometry.labelX).toBe(145);
    expect(geometry.labelY).toBe(33);
  });

  it('builds a vertical curve when target row is below source', () => {
    const from = { x: 20, y: 30, w: 80, h: 40 };
    const to = { x: 140, y: 150, w: 80, h: 40 };

    const geometry = edgePath(from, to);

    expect(geometry.d).toBe('M 72 70 C 91 106 149 114 168 150');
    expect(geometry.labelX).toBe(126);
    expect(geometry.labelY).toBe(110);
  });

  it('builds an upward curve when target row is above source', () => {
    const from = { x: 200, y: 180, w: 80, h: 40 };
    const to = { x: 80, y: 40, w: 80, h: 40 };

    const geometry = edgePath(from, to);

    expect(geometry.d).toBe('M 252 180 C 223 135 137 125 108 80');
    expect(geometry.labelX).toBe(186);
    expect(geometry.labelY).toBe(130);
  });
});
