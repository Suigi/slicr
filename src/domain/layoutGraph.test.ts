import { describe, expect, it } from 'vitest';
import { layoutGraph, rowFor } from './layoutGraph';
import { Edge, VisualNode } from './types';

function makeNode(key: string, type: string): VisualNode {
  return {
    key,
    name: key,
    type,
    data: null
  };
}

describe('layoutGraph', () => {
  it('assigns rows based on node type', () => {
    expect(rowFor('ui')).toBe(0);
    expect(rowFor('evt')).toBe(2);
    expect(rowFor('cmd')).toBe(1);
  });

  it('positions downstream nodes to the right in a simple chain', () => {
    const nodes = new Map<string, VisualNode>([
      ['cmd-a', makeNode('cmd-a', 'cmd')],
      ['evt-a', makeNode('evt-a', 'evt')],
      ['rm-a', makeNode('rm-a', 'rm')]
    ]);
    const edges: Edge[] = [
      { from: 'cmd-a', to: 'evt-a', label: null },
      { from: 'evt-a', to: 'rm-a', label: null }
    ];

    const result = layoutGraph(nodes, edges);

    expect(result.pos['cmd-a'].x).toBeLessThanOrEqual(result.pos['evt-a'].x);
    expect(result.pos['evt-a'].x).toBeLessThanOrEqual(result.pos['rm-a'].x);
    expect(result.usedRows).toEqual([1, 2]);
  });

  it('avoids same-row column collisions in branch-merge graphs', () => {
    const nodes = new Map<string, VisualNode>([
      ['cmd-left', makeNode('cmd-left', 'cmd')],
      ['cmd-right', makeNode('cmd-right', 'cmd')],
      ['cmd-merge', makeNode('cmd-merge', 'cmd')]
    ]);
    const edges: Edge[] = [
      { from: 'cmd-left', to: 'cmd-merge', label: null },
      { from: 'cmd-right', to: 'cmd-merge', label: null }
    ];

    const result = layoutGraph(nodes, edges);

    expect(result.pos['cmd-left'].x).toBeLessThan(result.pos['cmd-right'].x);
    expect(result.pos['cmd-merge'].x).toBeGreaterThan(result.pos['cmd-right'].x);
  });

  it('handles cycles and still produces positions', () => {
    const nodes = new Map<string, VisualNode>([
      ['a', makeNode('a', 'cmd')],
      ['b', makeNode('b', 'evt')]
    ]);
    const edges: Edge[] = [
      { from: 'a', to: 'b', label: null },
      { from: 'b', to: 'a', label: null }
    ];

    const result = layoutGraph(nodes, edges);

    expect(result.pos.a).toBeDefined();
    expect(result.pos.b).toBeDefined();
    expect(result.w).toBeGreaterThan(0);
    expect(result.h).toBeGreaterThan(0);
  });
});
