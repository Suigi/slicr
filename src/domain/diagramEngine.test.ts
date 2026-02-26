import { describe, expect, it } from 'vitest';
import { computeClassicDiagramLayout, computeDiagramLayout } from './diagramEngine';
import { PAD_X } from './layoutGraph';
import type { Parsed, VisualNode } from './types';

function makeNode(key: string, name: string): VisualNode {
  return {
    type: 'cmd',
    name,
    alias: null,
    stream: null,
    key,
    data: null,
    srcRange: { from: 0, to: 0 }
  };
}

function makeParsed(): Parsed {
  const first = makeNode('first', 'First node');
  const second = makeNode('second', 'Second node');
  return {
    sliceName: 'slice',
    nodes: new Map([
      [first.key, first],
      [second.key, second]
    ]),
    edges: [{ from: first.key, to: second.key, label: null }],
    warnings: [],
    boundaries: []
  };
}

describe('diagramEngine dimensions plumbing', () => {
  it('uses nodeDimensions height for classic layout entry points', async () => {
    const parsed = makeParsed();
    const nodeDimensions = {
      second: { width: 320, height: 111 }
    };

    const classic = computeClassicDiagramLayout(parsed, { nodeDimensions });
    expect(classic.layout.pos.second?.h).toBe(111);

    const viaEngine = await computeDiagramLayout(parsed, 'classic', { nodeDimensions });
    expect(viaEngine.layout.pos.second?.h).toBe(111);
  });

  it('uses measured node width in ELK and keeps boundary floor behavior', async () => {
    const before = makeNode('before', 'Before node');
    const anchor = makeNode('anchor', 'Anchor node');
    const after = makeNode('after', 'After node');
    const parsed: Parsed = {
      sliceName: 'slice',
      nodes: new Map([
        [before.key, before],
        [anchor.key, anchor],
        [after.key, after]
      ]),
      edges: [{ from: before.key, to: anchor.key, label: null }],
      warnings: [],
      boundaries: [{ after: anchor.key }]
    };
    const measuredAnchorWidth = 320;
    const layout = await computeDiagramLayout(parsed, 'elk', {
      nodeDimensions: {
        [anchor.key]: { width: measuredAnchorWidth, height: 42 }
      }
    });

    expect(layout.layout.pos.anchor?.w).toBe(measuredAnchorWidth);
    expect(layout.layout.pos.after?.x).toBeGreaterThanOrEqual(
      (layout.layout.pos.anchor?.x ?? 0) + measuredAnchorWidth + 40 + PAD_X
    );
  });
});
