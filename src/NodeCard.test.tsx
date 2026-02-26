import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NodeCard } from './NodeCard';
import { DEFAULT_NODE_WIDTH } from './domain/nodeSizing';
import type { VisualNode } from './domain/types';

function makeNode(): VisualNode {
  return {
    type: 'evt',
    name: 'book-registered',
    alias: null,
    stream: null,
    key: 'book-registered',
    data: { Title: 'Very long book title that does not fit into the node' },
    srcRange: { from: 0, to: 0 }
  };
}

describe('NodeCard', () => {
  it('preserves explicit width from layout styles', () => {
    const html = renderToStaticMarkup(
      <NodeCard
        node={makeNode()}
        nodePrefix="evt"
        style={{ left: '130px', top: '348px', width: `${DEFAULT_NODE_WIDTH}px`, height: '64px' }}
      />
    );

    expect(html).toContain(`width:${DEFAULT_NODE_WIDTH}px`);
  });
});
