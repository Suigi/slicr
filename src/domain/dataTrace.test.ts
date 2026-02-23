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

  it('stops tracing when a cycle is detected', () => {
    const dsl = `slice "Cycle"

rm:left "Left"
<- rm:right
uses:
  alpha

rm:right "Right"
<- rm:left
uses:
  alpha

cmd:consume "Consume"
<- rm:left
uses:
  alpha
`;

    const parsed = parseDsl(dsl);
    expect(traceData({ dsl, nodes: parsed.nodes, edges: parsed.edges }, 'consume', 'alpha')).toEqual({
      usesKey: 'alpha',
      hops: [
        { nodeKey: 'left', key: 'alpha' },
        { nodeKey: 'right', key: 'alpha' }
      ],
      source: null
    });
  });

  it('stops tracing when maxDepth is reached', () => {
    const dsl = `slice "Depth"

rm:left "Left"
<- rm:right
uses:
  alpha

rm:right "Right"
<- rm:left
uses:
  alpha

cmd:consume "Consume"
<- rm:left
uses:
  alpha
`;

    const parsed = parseDsl(dsl);
    expect(traceData({ dsl, nodes: parsed.nodes, edges: parsed.edges, maxDepth: 1 }, 'consume', 'alpha')).toEqual({
      usesKey: 'alpha',
      hops: [{ nodeKey: 'left', key: 'alpha' }],
      source: null
    });
  });

  it('traces through JSONPath uses mapping into collect-backed predecessor data', () => {
    const dsl = `slice "Read Model from Two Events"

evt:thing-added@1 "Thing Added"
data:
  id: 100
  name: alpha

evt:thing-added@2 "Thing Added"
data:
  id: 200
  name: bravo

rm:my-rm "All Things"
<- evt:thing-added@1
<- evt:thing-added@2
uses:
  things <- collect({id,name})

ui:my-ui "Rename Thing Form"
<- rm:my-rm
data:
  newName: ALPHA
uses:
  id <- $.things[0].id`;

    const parsed = parseDsl(dsl);
    expect(traceData({ dsl, nodes: parsed.nodes, edges: parsed.edges }, 'my-ui', 'id')).toEqual({
      usesKey: 'id',
      hops: [
        { nodeKey: 'my-rm', key: '$.things[0].id' },
        { nodeKey: 'thing-added@1', key: 'collect({id,name})' },
        { nodeKey: 'thing-added@2', key: 'collect({id,name})' }
      ],
      contributors: [
        {
          label: 'item[0]',
          hops: [{ nodeKey: 'thing-added@1', key: 'collect({id,name})' }]
        },
        {
          label: 'item[1]',
          hops: [{ nodeKey: 'thing-added@2', key: 'collect({id,name})' }]
        }
      ],
      source: [
        { id: 100, name: 'alpha' },
        { id: 200, name: 'bravo' }
      ]
    });
  });

  it('does not mark collect-backed root keys as missing source in trace', () => {
    const dsl = `slice "Read Model from Two Events"

evt:thing-added@1 "Thing Added"
data:
  id: 100
  name: alpha

evt:thing-added@2 "Thing Added"
data:
  id: 200
  name: bravo

rm:my-rm "All Things"
<- evt:thing-added@1
<- evt:thing-added@2
uses:
  things <- collect({id,name})`;

    const parsed = parseDsl(dsl);
    expect(traceData({ dsl, nodes: parsed.nodes, edges: parsed.edges }, 'my-rm', 'things')).toEqual({
      usesKey: 'things',
      hops: [
        { nodeKey: 'thing-added@1', key: 'collect({id,name})' },
        { nodeKey: 'thing-added@2', key: 'collect({id,name})' }
      ],
      contributors: [
        {
          label: 'item[0]',
          hops: [{ nodeKey: 'thing-added@1', key: 'collect({id,name})' }]
        },
        {
          label: 'item[1]',
          hops: [{ nodeKey: 'thing-added@2', key: 'collect({id,name})' }]
        }
      ],
      source: [
        { id: 100, name: 'alpha' },
        { id: 200, name: 'bravo' }
      ]
    });
  });

  it('includes upstream mapped contributors for collect branches', () => {
    const dsl = `slice "Data Integrity"

cmd:add "Add Thing"
data:
  id: 100
  name: alpha

evt:thing-added@1 "Thing Added"
<- cmd:add
uses:
  id
  name

evt:thing-added@2 "Thing Added"
data:
  id: 200
  name: bravo

rm:my-rm "All Things"
<- evt:thing-added@1
<- evt:thing-added@2
uses:
  things <- collect({id,name})`;

    const parsed = parseDsl(dsl);
    expect(traceData({ dsl, nodes: parsed.nodes, edges: parsed.edges }, 'my-rm', 'things')).toEqual({
      usesKey: 'things',
      hops: [
        { nodeKey: 'thing-added@1', key: 'collect({id,name})' },
        { nodeKey: 'add', key: 'id' },
        { nodeKey: 'add', key: 'name' },
        { nodeKey: 'thing-added@2', key: 'collect({id,name})' }
      ],
      contributors: [
        {
          label: 'item[0]',
          hops: [
            { nodeKey: 'thing-added@1', key: 'collect({id,name})' },
            { nodeKey: 'add', key: 'id' },
            { nodeKey: 'add', key: 'name' }
          ]
        },
        {
          label: 'item[1]',
          hops: [{ nodeKey: 'thing-added@2', key: 'collect({id,name})' }]
        }
      ],
      source: [
        { id: 100, name: 'alpha' },
        { id: 200, name: 'bravo' }
      ]
    });
  });
});
