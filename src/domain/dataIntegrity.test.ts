import { describe, expect, it } from 'vitest';
import { validateDataIntegrity } from './dataIntegrity';
import { Edge, VisualNode } from './types';

function makeNode(key: string, type: string, name: string, data: Record<string, unknown> | null): VisualNode {
  return {
    key,
    type,
    name,
    alias: null,
    stream: null,
    data,
    srcRange: { from: 0, to: 1 }
  };
}

describe('validateDataIntegrity', () => {
  it('warns at node level when no direct predecessor supplies a required key', () => {
    const nodes = new Map<string, VisualNode>([
      ['my-ui', makeNode('my-ui', 'ui', 'my-ui', { alpha: 'value' })],
      ['my-cmd', makeNode('my-cmd', 'cmd', 'my-cmd', { alpha: 'value', bravo: 'value' })],
      ['my-evt', makeNode('my-evt', 'evt', 'my-evt', { alpha: 'value', bravo: 'value', charlie: 'value' })]
    ]);

    const edges: Edge[] = [
      { from: 'my-ui', to: 'my-cmd', label: null },
      { from: 'my-cmd', to: 'my-evt', label: null }
    ];

    expect(validateDataIntegrity({ nodes, edges }).map((warning) => warning.message)).toEqual([
      'Missing data source for key "bravo" for node cmd:my-cmd',
      'Missing data source for key "charlie" for node evt:my-evt'
    ]);
  });

  it('does not warn when one of multiple direct predecessors supplies a required key', () => {
    const nodes = new Map<string, VisualNode>([
      ['evt-a', makeNode('evt-a', 'evt', 'a', { alpha: 'value' })],
      ['evt-b', makeNode('evt-b', 'evt', 'b', { bravo: 'value' })],
      ['rm-target', makeNode('rm-target', 'rm', 'target', { alpha: 'x', bravo: 'y' })]
    ]);

    const edges: Edge[] = [
      { from: 'evt-a', to: 'rm-target', label: null },
      { from: 'evt-b', to: 'rm-target', label: null }
    ];

    expect(validateDataIntegrity({ nodes, edges })).toEqual([]);
  });
});
