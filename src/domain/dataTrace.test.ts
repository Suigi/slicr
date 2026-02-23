import { describe, expect, it } from 'vitest';
import { createDataTraceQuery, traceData } from './dataTrace';
import { parseDsl } from './parseDsl';
import { VisualNode } from './types';

function makeNode(type: string): VisualNode {
  return {
    key: `${type}:node`,
    type,
    name: 'node',
    alias: null,
    stream: null,
    data: null,
    srcRange: { from: 0, to: 1 }
  };
}

describe('traceData', () => {
  it('returns null for generic nodes', () => {
    const nodes = new Map<string, VisualNode>([['generic-node', makeNode('generic')]]);

    expect(traceData({ dsl: '', nodes, edges: [] }, 'generic-node', 'alpha')).toBeNull();
  });

  it('traces uses keys backward through predecessor nodes', () => {
    const dsl = `slice "Trace"

evt:concert-scheduled "Concert Scheduled"
data:
  artist: "Headline"
  openingBand: "The Openers"

rm:concert-view "Concert View"
<- evt:concert-scheduled
uses:
  artist
  openingBand

cmd:buy "Buy Tickets"
<- rm:concert-view
uses:
  openingBand
`;

    const parsed = parseDsl(dsl);
    expect(traceData({ dsl, nodes: parsed.nodes, edges: parsed.edges }, 'buy', 'openingBand')).toEqual({
      usesKey: 'openingBand',
      hops: [
        { nodeKey: 'concert-view', key: 'openingBand' },
        { nodeKey: 'concert-scheduled', key: 'openingBand' }
      ],
      source: 'The Openers'
    });
  });

  it('stops when the first predecessor value is direct data and marks it as source', () => {
    const dsl = `slice "Trace Stop"

evt:seed "Seed"
data:
  alpha: "seed"

rm:direct "Direct"
data:
  alpha: "direct"

cmd:consume "Consume"
<- rm:direct
<- evt:seed
uses:
  alpha
`;

    const parsed = parseDsl(dsl);
    expect(traceData({ dsl, nodes: parsed.nodes, edges: parsed.edges }, 'consume', 'alpha')).toEqual({
      usesKey: 'alpha',
      hops: [{ nodeKey: 'direct', key: 'alpha' }],
      source: 'direct'
    });
  });

  it('exposes traceData(nodeId, usesKey) query API', () => {
    const dsl = `slice "Query"

evt:seed "Seed"
data:
  alpha: "a"

cmd:consume "Consume"
<- evt:seed
uses:
  alpha
`;

    const parsed = parseDsl(dsl);
    const query = createDataTraceQuery({ dsl, nodes: parsed.nodes, edges: parsed.edges });
    expect(query.traceData('consume', 'alpha')).toEqual({
      usesKey: 'alpha',
      hops: [{ nodeKey: 'seed', key: 'alpha' }],
      source: 'a'
    });
  });
});
