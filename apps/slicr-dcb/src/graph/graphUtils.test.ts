import {describe, expect, it} from 'vitest';

import {getArrowRenderPoints} from './graphUtils';

describe('getArrowRenderPoints', () => {
  it('extends the edge line to the arrow tip', () => {
    const renderPoints = getArrowRenderPoints([
      {x: 0, y: 0},
      {x: 20, y: 0},
    ]);

    expect(renderPoints?.linePoints).toEqual([
      {x: 0, y: 0},
      {x: 20, y: 0},
    ]);
  });
});
