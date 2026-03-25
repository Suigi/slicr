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
  it('keeps node fields visible when hideData is omitted', () => {
    const html = renderToStaticMarkup(
      <NodeCard
        node={makeNode()}
        nodePrefix="evt"
      />
    );

    expect(html).toContain('node-fields');
    expect(html).toContain('Very long book title');
  });

  it('hides node fields while keeping the header when hideData is true', () => {
    const html = renderToStaticMarkup(
      <NodeCard
        node={makeNode()}
        nodePrefix="evt"
        hideData
      />
    );

    expect(html).toContain('node-header');
    expect(html).toContain('book-registered');
    expect(html).not.toContain('node-fields');
    expect(html).not.toContain('Very long book title');
  });

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
