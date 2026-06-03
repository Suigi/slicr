import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';

import {EdgeLayer} from './EdgeLayer';

describe('EdgeLayer', () => {
  it('renders back-reference edges with dashed strokes', () => {
    const markup = renderToStaticMarkup(
      <EdgeLayer
        edges={[
          {
            id: 'edge-command-event',
            role: 'back-reference',
            isConnectedToFocusedNode: false,
            points: {
              linePoints: [
                {x: 0, y: 0},
                {x: 20, y: 0},
              ],
              arrowPoints: [
                {x: 20, y: 0},
                {x: 10, y: 5},
                {x: 10, y: -5},
              ],
            },
          },
        ]}
      />,
    );

    expect(markup.match(/stroke-dasharray="2,3"/g)).toHaveLength(1);
  });

  it('renders arrow heads as open v-shaped polylines', () => {
    const markup = renderToStaticMarkup(
      <EdgeLayer
        edges={[
          {
            id: 'edge-command-event',
            isConnectedToFocusedNode: false,
            points: {
              linePoints: [
                {x: 0, y: 0},
                {x: 20, y: 0},
              ],
              arrowPoints: [
                {x: 20, y: 0},
                {x: 10, y: 5},
                {x: 10, y: -5},
              ],
            },
          },
        ]}
      />,
    );

    expect(markup).toContain('<polyline');
    expect(markup).toContain('points="10,5 20,0 10,-5"');
    expect(markup).not.toContain('<polygon');
  });
});
