import { describe, expect, it } from 'vitest';
import { buildOverviewDiagramGraph, computeDiagramLayout, computeOverviewDiagramLayout } from './diagramEngine';
import { parseDsl } from './parseDsl';
import type { ParsedSliceProjection } from './parsedSliceProjection';
import type { Parsed, Position, VisualNode } from './types';

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

function makeProjection(id: string, parsed: Parsed): ParsedSliceProjection<Parsed> {
  return {
    id,
    dsl: `slice "${parsed.sliceName}"`,
    parsed
  };
}

describe('diagramEngine dimensions plumbing', () => {
  it('computes an overview layout from the ordered parsed slice projection list', async () => {
    const firstNode = makeNode('first-command', 'First command');
    const secondNode = makeNode('second-command', 'Second command');
    const firstParsed: Parsed = {
      sliceName: 'first',
      nodes: new Map([[firstNode.key, firstNode]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const secondParsed: Parsed = {
      sliceName: 'second',
      nodes: new Map([[secondNode.key, secondNode]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };

    const layout = await computeOverviewDiagramLayout([
      makeProjection('slice-1', firstParsed),
      makeProjection('slice-2', secondParsed)
    ]);

    expect(layout.layout.pos['slice-1::first-command']).toBeDefined();
    expect(layout.layout.pos['slice-2::second-command']).toBeDefined();
  });

  it('keeps same-key nodes from different slices separate in overview layout', async () => {
    const sharedKey = 'cmd:shared';
    const firstParsed: Parsed = {
      sliceName: 'first',
      nodes: new Map([[sharedKey, makeNode(sharedKey, 'Shared command')]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const secondParsed: Parsed = {
      sliceName: 'second',
      nodes: new Map([[sharedKey, makeNode(sharedKey, 'Shared command')]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };

    const layout = await computeOverviewDiagramLayout([
      makeProjection('slice-1', firstParsed),
      makeProjection('slice-2', secondParsed)
    ]);

    expect(layout.layout.pos['slice-1::cmd:shared']).toBeDefined();
    expect(layout.layout.pos['slice-2::cmd:shared']).toBeDefined();
    expect(layout.layout.pos['cmd:shared']).toBeUndefined();
  });

  it('keeps version-suffixed variants from different slices separate in overview layout', async () => {
    const firstKey = 'cmd:shared@1';
    const secondKey = 'cmd:shared@2';
    const firstParsed: Parsed = {
      sliceName: 'first',
      nodes: new Map([[firstKey, makeNode(firstKey, 'Shared command@1')]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const secondParsed: Parsed = {
      sliceName: 'second',
      nodes: new Map([[secondKey, makeNode(secondKey, 'Shared command@2')]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };

    const layout = await computeOverviewDiagramLayout([
      makeProjection('slice-1', firstParsed),
      makeProjection('slice-2', secondParsed)
    ]);

    expect(layout.layout.pos['slice-1::cmd:shared@1']).toBeDefined();
    expect(layout.layout.pos['slice-2::cmd:shared@2']).toBeDefined();
  });

  it('ignores empty slices in the overview layout result', async () => {
    const onlyNode = makeNode('cmd:only', 'Only');
    const emptyParsed: Parsed = {
      sliceName: 'empty',
      nodes: new Map(),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const filledParsed: Parsed = {
      sliceName: 'filled',
      nodes: new Map([[onlyNode.key, onlyNode]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };

    const layout = await computeOverviewDiagramLayout([
      makeProjection('slice-empty', emptyParsed),
      makeProjection('slice-filled', filledParsed)
    ]);

    expect(Object.keys(layout.layout.pos)).toEqual(['slice-filled::cmd:only']);
  });

  it('positions later slices to the right of earlier slices in overview layout', async () => {
    const firstNode = makeNode('cmd:first', 'First');
    const secondNode = makeNode('cmd:second', 'Second');
    const firstParsed: Parsed = {
      sliceName: 'first',
      nodes: new Map([[firstNode.key, firstNode]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const secondParsed: Parsed = {
      sliceName: 'second',
      nodes: new Map([[secondNode.key, secondNode]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };

    const layout = await computeOverviewDiagramLayout([
      makeProjection('slice-b', firstParsed),
      makeProjection('slice-a', secondParsed)
    ]);

    const firstPosition = layout.layout.pos['slice-b::cmd:first'];
    const secondPosition = layout.layout.pos['slice-a::cmd:second'];

    expect(secondPosition.x).toBeGreaterThanOrEqual(firstPosition.x + firstPosition.w + 80);
  });

  it('preserves measured node widths inside overview layout', async () => {
    const anchor = makeNode('cmd:anchor', 'Anchor');
    const after = makeNode('cmd:after', 'After');
    const parsed: Parsed = {
      sliceName: 'slice',
      nodes: new Map([
        [anchor.key, anchor],
        [after.key, after]
      ]),
      edges: [{ from: anchor.key, to: after.key, label: null }],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const measuredAnchorWidth = 320;

    const layout = await computeOverviewDiagramLayout(
      [makeProjection('slice-1', parsed)],
      {
        nodeDimensions: {
          'slice-1::cmd:anchor': { width: measuredAnchorWidth, height: 42 }
        }
      }
    );

    expect(layout.layout.pos['slice-1::cmd:anchor']?.w).toBe(measuredAnchorWidth);
    expect(layout.layout.pos['slice-1::cmd:after']?.x).toBeGreaterThanOrEqual(
      (layout.layout.pos['slice-1::cmd:anchor']?.x ?? 0) + measuredAnchorWidth + 40
    );
  });

  it('records source slice metadata for overview nodes', () => {
    const first = makeNode('first', 'First');
    const second = makeNode('second', 'Second');
    const parsed: Parsed = {
      sliceName: 'slice',
      nodes: new Map([
        [first.key, first],
        [second.key, second]
      ]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };

    const overview = buildOverviewDiagramGraph([makeProjection('slice-1', parsed)]);

    expect(overview.nodeMetadataByKey.get('slice-1::first')).toEqual({
      sourceSliceId: 'slice-1',
      sourceNodeKey: 'first',
      sliceDslOrder: 0
    });
    expect(overview.nodeMetadataByKey.get('slice-1::second')).toEqual({
      sourceSliceId: 'slice-1',
      sourceNodeKey: 'second',
      sliceDslOrder: 1
    });
  });

  it('remaps scenario entry keys into the namespaced overview key space', () => {
    const parsed: Parsed = {
      sliceName: 'slice',
      nodes: new Map([['cmd:rename', makeNode('cmd:rename', 'Rename')]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [
        {
          name: 'Rename item',
          srcRange: { from: 0, to: 10 },
          given: [{ key: 'evt:item-created', type: 'evt', name: 'item-created', alias: null, srcRange: { from: 11, to: 12 } }],
          when: { key: 'cmd:rename', type: 'cmd', name: 'rename', alias: null, srcRange: { from: 13, to: 14 } },
          then: [{ key: 'evt:item-renamed', type: 'evt', name: 'item-renamed', alias: null, srcRange: { from: 15, to: 16 } }]
        }
      ],
      scenarioOnlyNodeKeys: ['evt:item-created', 'evt:item-renamed']
    };

    const overview = buildOverviewDiagramGraph([makeProjection('slice-1', parsed)]);

    expect(overview.parsed.scenarios).toEqual([
      {
        name: 'Rename item',
        srcRange: { from: 0, to: 10 },
        given: [{ key: 'slice-1::evt:item-created', type: 'evt', name: 'item-created', alias: null, srcRange: { from: 11, to: 12 } }],
        when: { key: 'slice-1::cmd:rename', type: 'cmd', name: 'rename', alias: null, srcRange: { from: 13, to: 14 } },
        then: [{ key: 'slice-1::evt:item-renamed', type: 'evt', name: 'item-renamed', alias: null, srcRange: { from: 15, to: 16 } }]
      }
    ]);
  });

  it('assigns event nodes with the same stream name to the same overview lane across slices', async () => {
    const firstEvent: VisualNode = {
      ...makeNode('evt:order-created', 'order-created'),
      type: 'evt',
      stream: 'orders'
    };
    const secondEvent: VisualNode = {
      ...makeNode('evt:order-updated', 'order-updated'),
      type: 'evt',
      stream: 'orders'
    };
    const firstParsed: Parsed = {
      sliceName: 'first',
      nodes: new Map([[firstEvent.key, firstEvent]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const secondParsed: Parsed = {
      sliceName: 'second',
      nodes: new Map([[secondEvent.key, secondEvent]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };

    const layout = await computeOverviewDiagramLayout([
      makeProjection('slice-1', firstParsed),
      makeProjection('slice-2', secondParsed)
    ]);

    expect(layout.laneByKey.get('slice-1::evt:order-created')).toBe(layout.laneByKey.get('slice-2::evt:order-updated'));
    expect(layout.rowStreamLabels[layout.laneByKey.get('slice-1::evt:order-created') ?? -1]).toBe('orders');
  });

  it('keeps event nodes with different stream names in different overview lanes across slices', async () => {
    const firstEvent: VisualNode = {
      ...makeNode('evt:order-created', 'order-created'),
      type: 'evt',
      stream: 'orders'
    };
    const secondEvent: VisualNode = {
      ...makeNode('evt:payment-captured', 'payment-captured'),
      type: 'evt',
      stream: 'payments'
    };
    const firstParsed: Parsed = {
      sliceName: 'first',
      nodes: new Map([[firstEvent.key, firstEvent]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const secondParsed: Parsed = {
      sliceName: 'second',
      nodes: new Map([[secondEvent.key, secondEvent]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };

    const layout = await computeOverviewDiagramLayout([
      makeProjection('slice-1', firstParsed),
      makeProjection('slice-2', secondParsed)
    ]);

    expect(layout.laneByKey.get('slice-1::evt:order-created')).not.toBe(layout.laneByKey.get('slice-2::evt:payment-captured'));
  });

  it('keeps non-event overview nodes in their existing semantic lanes after namespacing', async () => {
    const uiNode: VisualNode = { ...makeNode('ui:form', 'Form'), type: 'ui' };
    const commandNode: VisualNode = { ...makeNode('cmd:submit', 'Submit'), type: 'cmd' };
    const firstParsed: Parsed = {
      sliceName: 'first',
      nodes: new Map([[uiNode.key, uiNode]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const secondParsed: Parsed = {
      sliceName: 'second',
      nodes: new Map([[commandNode.key, commandNode]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };

    const layout = await computeOverviewDiagramLayout([
      makeProjection('slice-1', firstParsed),
      makeProjection('slice-2', secondParsed)
    ]);

    expect(layout.laneByKey.get('slice-1::ui:form')).toBe(0);
    expect(layout.laneByKey.get('slice-2::cmd:submit')).toBe(1);
  });

  it('computes ELK layout without requiring an engine parameter', async () => {
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
      boundaries: [{ after: anchor.key }],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const measuredAnchorWidth = 320;
    const layout = await computeDiagramLayout(parsed, {
      nodeDimensions: {
        [anchor.key]: { width: measuredAnchorWidth, height: 42 }
      }
    });

    expect(layout.layout.pos.anchor?.w).toBe(measuredAnchorWidth);
    expect(layout.layout.pos.after?.x).toBeGreaterThanOrEqual(
      (layout.layout.pos.anchor?.x ?? 0) + measuredAnchorWidth + 40 + 40
    );
  });

  it('does not let scenario-only nodes shift main diagram node columns', async () => {
    const scenarioOnly = makeNode('scenario-only', 'Scenario only');
    const main = makeNode('main', 'Main node');
    const parsed: Parsed = {
      sliceName: 'slice',
      nodes: new Map([
        [scenarioOnly.key, scenarioOnly],
        [main.key, main]
      ]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: [scenarioOnly.key]
    };

    const layout = await computeDiagramLayout(parsed);
    const xValues = Object.values(layout.layout.pos).map((position: Position) => position.x);

    expect(layout.layout.pos.main).toBeDefined();
    expect(layout.layout.pos['scenario-only']).toBeUndefined();
    expect(Math.min(...xValues)).toBe(50);
  });

  it('keeps main diagram left-aligned when scenarios are present in parsed DSL', async () => {
    const parsed = parseDsl(`slice "Untitled"

ui:rename-todo-form
rm:all-todos
cmd:rename-todo <- ui:rename-todo-form

scenario "Complete Single TODO Item"
given:
  evt:todo-added

when:
  cmd:complete-todo

then:
  evt:todo-completed

scenario "Complete TODO List"
given:
  evt:todo-added

when:
  cmd:complete-todo-list

then:
  evt:todo-completed`);

    const layout = await computeDiagramLayout(parsed);
    const xValues = Object.values(layout.layout.pos).map((position) => position.x);

    expect(parsed.scenarioOnlyNodeKeys.length).toBeGreaterThan(0);
    expect(Math.min(...xValues)).toBe(50);
  });
});
