import { describe, expect, it } from 'vitest';
import { buildOverviewDiagramGraph, computeDiagramLayout, computeOverviewDiagramLayout } from './diagramEngine';
import { deriveOverviewCrossSliceLinks } from './overviewCrossSliceLinks';
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
  it('returns an empty overview layout for zero slices', async () => {
    const layout = await computeOverviewDiagramLayout([]);

    expect(layout.layout.pos).toEqual({});
    expect(layout.layout.w).toBe(0);
    expect(layout.layout.h).toBe(0);
    expect(layout.rowStreamLabels).toEqual({});
  });

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
      sourceSliceName: 'slice',
      sourceNodeKey: 'first',
      sliceDslOrder: 0
    });
    expect(overview.nodeMetadataByKey.get('slice-1::second')).toEqual({
      sourceSliceId: 'slice-1',
      sourceSliceName: 'slice',
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

  it('preserves scenario-only nodes in the overview graph so scenario cards keep their data', () => {
    const scenarioGivenNode = makeNode('evt:item-created', 'Item created');
    scenarioGivenNode.data = { title: 'Alpha' };
    const scenarioThenNode = makeNode('evt:item-renamed', 'Item renamed');
    scenarioThenNode.data = { title: 'Beta' };
    const parsed: Parsed = {
      sliceName: 'slice',
      nodes: new Map([
        ['cmd:rename', makeNode('cmd:rename', 'Rename')],
        [scenarioGivenNode.key, scenarioGivenNode],
        [scenarioThenNode.key, scenarioThenNode]
      ]),
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
      scenarioOnlyNodeKeys: [scenarioGivenNode.key, scenarioThenNode.key]
    };

    const overview = buildOverviewDiagramGraph([makeProjection('slice-1', parsed)]);

    expect(overview.parsed.nodes.get('slice-1::evt:item-created')?.data).toEqual({ title: 'Alpha' });
    expect(overview.parsed.nodes.get('slice-1::evt:item-renamed')?.data).toEqual({ title: 'Beta' });
    expect(overview.parsed.scenarioOnlyNodeKeys).toEqual(['slice-1::evt:item-created', 'slice-1::evt:item-renamed']);
  });

  it('records source slice metadata for each merged overview scenario', () => {
    const firstParsed: Parsed = {
      sliceName: 'first',
      nodes: new Map([['cmd:first', makeNode('cmd:first', 'First')]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [
        {
          name: 'First scenario',
          srcRange: { from: 0, to: 10 },
          given: [],
          when: { key: 'cmd:first', type: 'cmd', name: 'first', alias: null, srcRange: { from: 1, to: 2 } },
          then: []
        }
      ],
      scenarioOnlyNodeKeys: []
    };
    const secondParsed: Parsed = {
      sliceName: 'second',
      nodes: new Map([['cmd:second', makeNode('cmd:second', 'Second')]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [
        {
          name: 'Second scenario',
          srcRange: { from: 20, to: 30 },
          given: [],
          when: { key: 'cmd:second', type: 'cmd', name: 'second', alias: null, srcRange: { from: 21, to: 22 } },
          then: []
        }
      ],
      scenarioOnlyNodeKeys: []
    };

    const overview = buildOverviewDiagramGraph([
      makeProjection('slice-1', firstParsed),
      makeProjection('slice-2', secondParsed)
    ]);

    expect(overview.scenarioMetadataByScenario.get(overview.parsed.scenarios[0]!)).toEqual({
      sourceSliceId: 'slice-1',
      sourceSliceName: 'first',
      sourceScenarioIndex: 0
    });
    expect(overview.scenarioMetadataByScenario.get(overview.parsed.scenarios[1]!)).toEqual({
      sourceSliceId: 'slice-2',
      sourceSliceName: 'second',
      sourceScenarioIndex: 0
    });
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

  it('pushes later overview slices right when a measured scenario group is wider than the slice nodes', async () => {
    const firstParsed: Parsed = {
      sliceName: 'first',
      nodes: new Map([['cmd:first', makeNode('cmd:first', 'First')]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [
        {
          name: 'Wide scenario',
          srcRange: { from: 0, to: 10 },
          given: [],
          when: { key: 'cmd:first', type: 'cmd', name: 'first', alias: null, srcRange: { from: 1, to: 2 } },
          then: []
        }
      ],
      scenarioOnlyNodeKeys: []
    };
    const secondParsed: Parsed = {
      sliceName: 'second',
      nodes: new Map([['cmd:second', makeNode('cmd:second', 'Second')]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };

    const withoutMeasuredWidth = await computeOverviewDiagramLayout([
      makeProjection('slice-1', firstParsed),
      makeProjection('slice-2', secondParsed)
    ]);
    const withMeasuredWidth = await computeOverviewDiagramLayout(
      [
        makeProjection('slice-1', firstParsed),
        makeProjection('slice-2', secondParsed)
      ],
      {
        scenarioGroupWidths: {
          'overview-scenario-group-slice-1': 420
        }
      }
    );

    expect(withMeasuredWidth.layout.pos['slice-2::cmd:second'].x).toBeGreaterThan(
      withoutMeasuredWidth.layout.pos['slice-2::cmd:second'].x
    );
  });

  it('ignores measured scenario-group width for slices that have no scenarios', async () => {
    const firstParsed: Parsed = {
      sliceName: 'first',
      nodes: new Map([['cmd:first', makeNode('cmd:first', 'First')]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const secondParsed: Parsed = {
      sliceName: 'second',
      nodes: new Map([['cmd:second', makeNode('cmd:second', 'Second')]]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };

    const baseline = await computeOverviewDiagramLayout([
      makeProjection('slice-1', firstParsed),
      makeProjection('slice-2', secondParsed)
    ]);
    const withIgnoredWidth = await computeOverviewDiagramLayout(
      [
        makeProjection('slice-1', firstParsed),
        makeProjection('slice-2', secondParsed)
      ],
      {
        scenarioGroupWidths: {
          'overview-scenario-group-slice-1': 420
        }
      }
    );

    expect(withIgnoredWidth.layout.pos['slice-2::cmd:second'].x).toBe(
      baseline.layout.pos['slice-2::cmd:second'].x
    );
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

  it('compacts the first visible target-slice node leftward for adjacent shared-node overview links', async () => {
    const firstParsed = parseDsl(`slice "Alpha"

evt:order-created`);
    const secondParsed = parseDsl(`slice "Beta"

evt:order-created
cmd:ship-order <- evt:order-created`);
    const projections = [
      makeProjection('slice-1', firstParsed),
      makeProjection('slice-2', secondParsed)
    ];
    const overview = buildOverviewDiagramGraph(projections);
    const crossSliceLinks = deriveOverviewCrossSliceLinks(projections, overview.nodeMetadataByKey);

    expect(crossSliceLinks).toEqual([
      expect.objectContaining({
        fromOverviewNodeKey: 'slice-1::order-created',
        toOverviewNodeKey: 'slice-2::order-created',
        renderMode: 'shared-node'
      })
    ]);

    const layout = await computeOverviewDiagramLayout(projections);
    const source = layout.layout.pos['slice-1::order-created'];
    const targetFollower = layout.layout.pos['slice-2::ship-order'];

    expect(source).toBeDefined();
    expect(targetFollower).toBeDefined();
    expect(targetFollower.x).toBe(source.x + source.w + 80);
  });

  it('positions the first visible target-slice node immediately after the shared representative for adjacent overview links', async () => {
    const firstParsed = parseDsl(`slice "Alpha"

evt:order-created`);
    const secondParsed = parseDsl(`slice "Beta"

evt:order-created
cmd:ship-order <- evt:order-created`);

    const layout = await computeOverviewDiagramLayout([
      makeProjection('slice-1', firstParsed),
      makeProjection('slice-2', secondParsed)
    ]);
    const source = layout.layout.pos['slice-1::order-created'];
    const targetFollower = layout.layout.pos['slice-2::ship-order'];

    expect(source).toBeDefined();
    expect(targetFollower).toBeDefined();
    expect(targetFollower.x).toBe(source.x + source.w + 80);
  });

  it('keeps later overview slices ordered to the right of a compacted adjacent shared-node target slice', async () => {
    const alphaParsed = parseDsl(`slice "Alpha"

evt:order-created`);
    const betaParsed = parseDsl(`slice "Beta"

evt:order-created
cmd:ship-order <- evt:order-created`);
    const gammaParsed = parseDsl(`slice "Gamma"

cmd:invoice-order`);

    const layout = await computeOverviewDiagramLayout([
      makeProjection('slice-1', alphaParsed),
      makeProjection('slice-2', betaParsed),
      makeProjection('slice-3', gammaParsed)
    ]);
    const betaFollower = layout.layout.pos['slice-2::ship-order'];
    const gammaLeader = layout.layout.pos['slice-3::invoice-order'];

    expect(betaFollower).toBeDefined();
    expect(gammaLeader).toBeDefined();
    expect(gammaLeader.x).toBe(betaFollower.x + betaFollower.w + 80);
  });

  it('compacts multiple independent adjacent shared-node pairs across different slice boundaries', async () => {
    const alphaParsed = parseDsl(`slice "Alpha"

evt:order-created`);
    const betaParsed = parseDsl(`slice "Beta"

evt:order-created
cmd:ship-order <- evt:order-created`);
    const gammaParsed = parseDsl(`slice "Gamma"

evt:invoice-requested`);
    const deltaParsed = parseDsl(`slice "Delta"

evt:invoice-requested
cmd:send-invoice <- evt:invoice-requested`);

    const layout = await computeOverviewDiagramLayout([
      makeProjection('slice-1', alphaParsed),
      makeProjection('slice-2', betaParsed),
      makeProjection('slice-3', gammaParsed),
      makeProjection('slice-4', deltaParsed)
    ]);
    const alphaSource = layout.layout.pos['slice-1::order-created'];
    const betaFollower = layout.layout.pos['slice-2::ship-order'];
    const gammaSource = layout.layout.pos['slice-3::invoice-requested'];
    const deltaFollower = layout.layout.pos['slice-4::send-invoice'];

    expect(alphaSource).toBeDefined();
    expect(betaFollower).toBeDefined();
    expect(gammaSource).toBeDefined();
    expect(deltaFollower).toBeDefined();
    expect(betaFollower.x).toBe(alphaSource.x + alphaSource.w + 80);
    expect(deltaFollower.x).toBe(gammaSource.x + gammaSource.w + 80);
  });

  it('exposes the hidden shared-node boundary-anchor gap regression in reserve-book overview layout', async () => {
    const registrationParsed = parseDsl(`slice "Book Registration"

ui:book-registration-form "Book Registration"

cmd:register-book "Register Book"
<- ui:book-registration-form

evt:book-registered "Book Registered"
<- cmd:register-book

---

rm:available-books "Available Books"
<- evt:book-registered`);
    const reserveBookParsed = parseDsl(`slice "Reserve Book"

rm:available-books "Available Books"

---

ui:available-books "Reserve Book Form"
<- rm:available-books

cmd:reserve-book "ReserveBook"
<- ui:available-books

evt:book-reserved "BookReserved"
<- cmd:reserve-book

---

rm:available-books@2 "Available Books"
<- evt:book-reserved`);

    const layout = await computeOverviewDiagramLayout([
      makeProjection('slice-1', registrationParsed),
      makeProjection('slice-2', reserveBookParsed)
    ]);

    const reserveBookForm = layout.layout.pos['slice-2::ui:available-books'];
    const reserveBook = layout.layout.pos['slice-2::reserve-book'];
    const bookReserved = layout.layout.pos['slice-2::book-reserved'];
    const registeredBook = layout.layout.pos['slice-1::book-registered'];
    const availableBooks = layout.layout.pos['slice-1::available-books'];
    const rightSliceAvailableBooks = layout.layout.pos['slice-2::available-books@2'];
    const minimumGap = 40;
    const maximumInterSliceGap = 160;

    expect(reserveBookForm).toBeDefined();
    expect(reserveBook).toBeDefined();
    expect(bookReserved).toBeDefined();
    expect(registeredBook).toBeDefined();
    expect(availableBooks).toBeDefined();
    expect(rightSliceAvailableBooks).toBeDefined();
    expect(reserveBook.x).toBeGreaterThan(reserveBookForm.x + minimumGap);
    expect(bookReserved.x).toBeGreaterThan(reserveBook.x + minimumGap);

    const leftSliceRightMost = Math.max(
      registeredBook.x + registeredBook.w,
      availableBooks.x + availableBooks.w
    );
    const rightSliceLeftMost = Math.min(
      reserveBookForm.x,
      reserveBook.x,
      bookReserved.x,
      rightSliceAvailableBooks.x
    );

    expect(rightSliceLeftMost).toBeLessThan(leftSliceRightMost + maximumInterSliceGap);
  });

  it('preserves successor-gap and boundary-floor legality in a compacted overview target slice', async () => {
    const alphaParsed = parseDsl(`slice "Alpha"

evt:availability-published`);
    const reserveBookParsed = parseDsl(`slice "Reserve Book"

evt:availability-published
cmd:lookup-book <- evt:availability-published
cmd:reserve-book
evt:book-reserved <- cmd:reserve-book
---
rm:reservation-status <- evt:book-reserved`);

    const layout = await computeOverviewDiagramLayout([
      makeProjection('slice-1', alphaParsed),
      makeProjection('slice-2', reserveBookParsed)
    ]);

    const sharedSource = layout.layout.pos['slice-1::availability-published'];
    const lookupBook = layout.layout.pos['slice-2::lookup-book'];
    const reserveBook = layout.layout.pos['slice-2::reserve-book'];
    const bookReserved = layout.layout.pos['slice-2::book-reserved'];
    const reservationStatus = layout.layout.pos['slice-2::reservation-status'];

    expect(sharedSource).toBeDefined();
    expect(lookupBook).toBeDefined();
    expect(reserveBook).toBeDefined();
    expect(bookReserved).toBeDefined();
    expect(reservationStatus).toBeDefined();
    expect(lookupBook.x).toBe(sharedSource.x + sharedSource.w + 80);
    expect(bookReserved.x).toBeGreaterThanOrEqual(reserveBook.x + 40);
    expect(reservationStatus.x).toBeGreaterThanOrEqual(reserveBook.x + reserveBook.w + 80);
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
