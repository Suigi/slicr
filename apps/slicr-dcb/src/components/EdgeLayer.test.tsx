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

    expect(markup).toContain('stroke-dasharray="10,5"');
  });
});
