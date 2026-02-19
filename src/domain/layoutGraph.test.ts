import { describe, expect, it } from 'vitest';
import { PAD_X, layoutGraph, rowFor } from './layoutGraph';
import { Edge, VisualNode } from './types';

function makeNode(key: string, type: string, stream: string | null = null): VisualNode {
  return {
    key,
    name: key,
    alias: null,
    stream,
    type,
    data: null,
    srcRange: {from: 0, to: 0},
  };
}

describe('layoutGraph', () => {
  it('assigns rows based on node type', () => {
    expect(rowFor('ui')).toBe(0);
    expect(rowFor('generic')).toBe(0);
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

    expect(result.pos['evt-a'].x - result.pos['cmd-a'].x).toBeGreaterThanOrEqual(48);
    expect(result.pos['rm-a'].x - result.pos['evt-a'].x).toBeGreaterThanOrEqual(48);
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

  it('keeps merge targets to the right of all predecessors even when discovered early', () => {
    const nodes = new Map<string, VisualNode>([
      ['cmd-schedule', makeNode('cmd-schedule', 'cmd')],
      ['evt-scheduled', makeNode('evt-scheduled', 'evt')],
      ['rm-available', makeNode('rm-available', 'rm')],
      ['ui-available', makeNode('ui-available', 'ui')],
      ['cmd-buy', makeNode('cmd-buy', 'cmd')],
      ['evt-sold', makeNode('evt-sold', 'evt')],
      ['rm-available-2', makeNode('rm-available-2', 'rm')]
    ]);
    const edges: Edge[] = [
      { from: 'cmd-schedule', to: 'evt-scheduled', label: null },
      { from: 'evt-scheduled', to: 'rm-available', label: null },
      { from: 'rm-available', to: 'ui-available', label: null },
      { from: 'ui-available', to: 'cmd-buy', label: null },
      { from: 'cmd-buy', to: 'evt-sold', label: null },
      { from: 'evt-scheduled', to: 'rm-available-2', label: null },
      { from: 'evt-sold', to: 'rm-available-2', label: null }
    ];

    const result = layoutGraph(nodes, edges);

    expect(result.pos['rm-available-2'].x).toBeGreaterThanOrEqual(result.pos['evt-sold'].x + 48);
    expect(result.pos['rm-available-2'].x).toBeGreaterThan(result.pos['cmd-buy'].x);
  });

  it('pushes nodes defined after a boundary to the right', () => {
    const nodes = new Map<string, VisualNode>([
      ['first', makeNode('first', 'ui')],
      ['second', makeNode('second', 'evt')],
      ['third', makeNode('third', 'cmd')]
    ]);
    const edges: Edge[] = [];
    const baseline = layoutGraph(nodes, edges);

    const result = layoutGraph(nodes, edges, [{ after: 'first' }]);

    expect(baseline.pos.second.x).toBe(baseline.pos.first.x);
    expect(result.pos.second.x).toBeGreaterThan(result.pos.first.x);
    expect(result.pos.third.x).toBeGreaterThan(result.pos.first.x);
  });

  it('places nodes after a boundary to the right of the boundary anchor, even when anchor is already far right', () => {
    const nodes = new Map<string, VisualNode>([
      ['a', makeNode('a', 'cmd')],
      ['b', makeNode('b', 'evt')],
      ['anchor', makeNode('anchor', 'rm')],
      ['after', makeNode('after', 'ui')]
    ]);
    const edges: Edge[] = [
      { from: 'a', to: 'b', label: null },
      { from: 'b', to: 'anchor', label: null }
    ];

    const result = layoutGraph(nodes, edges, [{ after: 'anchor' }]);

    expect(result.pos.anchor.x).toBeGreaterThan(result.pos.a.x);
    expect(result.pos.after.x).toBeGreaterThanOrEqual(result.pos.anchor.x + result.pos.anchor.w + 40 + PAD_X);
  });

  it('places events from different streams on separate rows and tracks row labels', () => {
    const nodes = new Map<string, VisualNode>([
      ['first-event', makeNode('first-event', 'evt', 'first')],
      ['second-event', makeNode('second-event', 'evt', 'second')],
      ['read-model', makeNode('read-model', 'rm')]
    ]);
    const edges: Edge[] = [
      { from: 'first-event', to: 'read-model', label: null },
      { from: 'second-event', to: 'read-model', label: null }
    ];

    const result = layoutGraph(nodes, edges);

    expect(result.pos['first-event'].y).not.toBe(result.pos['second-event'].y);
    expect(Object.values(result.rowStreamLabels).sort()).toEqual(['first', 'second']);
  });

  it('places default stream below named streams and omits its header label', () => {
    const nodes = new Map<string, VisualNode>([
      ['named-event', makeNode('named-event', 'evt', 'orders')],
      ['default-event', makeNode('default-event', 'evt')],
      ['read-model', makeNode('read-model', 'rm')]
    ]);
    const edges: Edge[] = [
      { from: 'named-event', to: 'read-model', label: null },
      { from: 'default-event', to: 'read-model', label: null }
    ];

    const result = layoutGraph(nodes, edges);

    expect(result.pos['default-event'].y).toBeGreaterThan(result.pos['named-event'].y);
    expect(Object.values(result.rowStreamLabels)).toEqual(['orders']);
  });
});
