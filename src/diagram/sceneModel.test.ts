import { describe, expect, it } from 'vitest';
import { RenderedDiagramEdge } from '../domain/diagramEngine';
import type { LayoutResult, Parsed, Position, VisualNode } from '../domain/types';
import { routeRoundedPolyline } from '../domain/diagramRouting';
import { buildSceneModel } from './sceneModel';

function node(key: string, type: string, from: number, to: number): VisualNode {
  return {
    type,
    name: `${key}@2`,
    alias: null,
    stream: null,
    key,
    data: null,
    srcRange: { from, to }
  };
}

function baseParsed(): Parsed {
  return {
    sliceName: 'Demo Slice',
    nodes: new Map<string, VisualNode>([
      ['a', node('a', 'cmd', 1, 2)],
      ['b', node('b', 'evt', 3, 4)]
    ]),
    edges: [{ from: 'a', to: 'b', label: 'ok' }],
    warnings: [],
    boundaries: [{ after: 'a' }],
    scenarios: [],
    scenarioOnlyNodeKeys: []
  };
}

function baseLayout(): LayoutResult {
  return {
    pos: {
      a: { x: 100, y: 120, w: 180, h: 90 },
      b: { x: 420, y: 120, w: 180, h: 90 }
    },
    rowY: { 2: 120 },
    usedRows: [2],
    rowStreamLabels: {},
    w: 800,
    h: 500
  };
}

function baseRenderedEdges(): RenderedDiagramEdge[] {
  return [
    {
      key: 'a-b-0',
      edgeKey: 'a->b#0',
      edge: { from: 'a', to: 'b', label: 'ok' },
      geometry: {
        d: 'M 280 165 L 420 165',
        labelX: 350,
        labelY: 158,
        points: [
          { x: 280, y: 165 },
          { x: 350, y: 165 },
          { x: 420, y: 165 }
        ]
      }
    }
  ];
}

describe('buildSceneModel', () => {
  it('builds a scene model with viewport, lanes, boundaries, and node states', () => {
    const parsed = baseParsed();
    const activeLayout = baseLayout();
    const displayedPos: Record<string, Position> = activeLayout.pos;
    const renderedEdges = baseRenderedEdges();

    const scene = buildSceneModel({
      parsed,
      activeLayout,
      displayedPos,
      renderedEdges,
      engineLayout: {
        layout: activeLayout,
        laneByKey: new Map<string, number>([['a', 2], ['b', 2]]),
        rowStreamLabels: {}
      },
      activeNodeKeyFromEditor: 'a',
      selectedNodeKey: 'b',
      hoveredEdgeKey: 'a->b#0',
      hoveredTraceNodeKey: 'b',
      canvasMargin: 100,
      laneLabelLeft: 12
    });

    expect(scene).not.toBeNull();
    expect(scene?.viewport).toEqual({ width: 1000, height: 700, offsetX: 100, offsetY: 100 });
    expect(scene?.worldWidth).toBe(800);
    expect(scene?.worldHeight).toBe(500);
    expect(scene?.title?.text).toBe('Demo Slice');
    expect(scene?.lanes).toHaveLength(1);
    expect(scene?.lanes[0]).toMatchObject({ row: 2, bandTop: 92, labelLeft: 12 });
    expect(scene?.boundaries[0]?.left).toBe(320);

    const firstNode = scene?.nodes.find((entry) => entry.key === 'a');
    const secondNode = scene?.nodes.find((entry) => entry.key === 'b');
    expect(firstNode?.node.name).toBe('a');
    expect(firstNode?.highlighted).toBe(true);
    expect(firstNode?.related).toBe(true);
    expect(secondNode?.selected).toBe(true);
    expect(secondNode?.className).toContain('trace-hovered');

    const edge = scene?.edges[0];
    expect(edge?.path).toBe(routeRoundedPolyline(renderedEdges[0].geometry.points!, 5));
    expect(edge?.hovered).toBe(true);
    expect(edge?.draggableSegmentIndices).toEqual([0, 1]);
  });

  it('emits empty overview cross-slice primitive arrays when none are derived', () => {
    const parsed = baseParsed();
    const activeLayout = baseLayout();

    const scene = buildSceneModel({
      parsed,
      activeLayout,
      displayedPos: activeLayout.pos,
      renderedEdges: baseRenderedEdges(),
      engineLayout: null,
      activeNodeKeyFromEditor: null,
      selectedNodeKey: null,
      hoveredEdgeKey: null,
      hoveredTraceNodeKey: null
    });

    expect(scene?.crossSliceLinks).toEqual([]);
    expect(scene?.sharedNodeAnchors).toEqual([]);
    expect(scene?.edges).toHaveLength(1);
  });

  it('builds elk lanes from lane metadata and node positions', () => {
    const parsed = baseParsed();
    const activeLayout = {
      ...baseLayout(),
      usedRows: [],
      rowY: {},
      rowStreamLabels: {}
    };
    const displayedPos: Record<string, Position> = {
      a: { x: 100, y: 200, w: 180, h: 90 },
      b: { x: 420, y: 360, w: 180, h: 90 }
    };

    const scene = buildSceneModel({
      parsed,
      activeLayout,
      displayedPos,
      renderedEdges: baseRenderedEdges(),
      engineLayout: {
        layout: activeLayout,
        laneByKey: new Map<string, number>([['a', 2], ['b', 4]]),
        rowStreamLabels: { 2: 'orders', 4: 'payments' }
      },
      activeNodeKeyFromEditor: null,
      selectedNodeKey: null,
      hoveredEdgeKey: null,
      hoveredTraceNodeKey: null
    });

    expect(scene).not.toBeNull();
    expect(scene?.lanes.map((lane) => lane.row)).toEqual([2, 4]);
    expect(scene?.lanes.map((lane) => lane.streamLabel)).toEqual(['orders', 'payments']);
    expect(scene?.lanes[0].y).toBe(200);
    expect(scene?.lanes[1].y).toBe(360);
  });

  it('maps parsed scenarios into grouped given/when/then scene data in source order', () => {
    const parsed = baseParsed();
    parsed.scenarios = [
      {
        name: 'Complete TODO',
        srcRange: { from: 10, to: 30 },
        given: [{ key: 'b', type: 'evt', name: 'b', alias: null, srcRange: { from: 11, to: 12 } }],
        when: { key: 'a', type: 'cmd', name: 'a', alias: null, srcRange: { from: 13, to: 14 } },
        then: [{ key: 'b', type: 'evt', name: 'b', alias: null, srcRange: { from: 15, to: 16 } }]
      },
      {
        name: 'Retry TODO',
        srcRange: { from: 31, to: 50 },
        given: [{ key: 'a', type: 'cmd', name: 'a', alias: null, srcRange: { from: 32, to: 33 } }],
        when: { key: 'b', type: 'evt', name: 'b', alias: null, srcRange: { from: 34, to: 35 } },
        then: [{ key: 'a', type: 'cmd', name: 'a', alias: null, srcRange: { from: 36, to: 37 } }]
      }
    ];

    const activeLayout = baseLayout();
    const scene = buildSceneModel({
      parsed,
      activeLayout,
      displayedPos: activeLayout.pos,
      renderedEdges: baseRenderedEdges(),
      engineLayout: null,
      activeNodeKeyFromEditor: 'b',
      selectedNodeKey: 'a',
      hoveredEdgeKey: null,
      hoveredTraceNodeKey: null
    });

    expect(scene?.scenarios.map((scenario) => ({
      name: scenario.name,
      given: scenario.given.map((entry) => entry.key),
      when: scenario.when?.key ?? null,
      then: scenario.then.map((entry) => entry.key)
    }))).toEqual([
      { name: 'Complete TODO', given: ['b'], when: 'a', then: ['b'] },
      { name: 'Retry TODO', given: ['a'], when: 'b', then: ['a'] }
    ]);
    expect(scene?.scenarios[0]?.given[0]?.highlighted).toBe(true);
    expect(scene?.scenarios[0]?.when?.selected).toBe(true);
    expect(scene?.scenarios[0]?.given[0]?.className).toContain('highlighted');
  });

  it('expands viewport height when scenarios are present below the diagram', () => {
    const parsed = baseParsed();
    parsed.scenarios = [
      {
        name: 'Complete TODO',
        srcRange: { from: 10, to: 30 },
        given: [{ key: 'b', type: 'evt', name: 'b', alias: null, srcRange: { from: 11, to: 12 } }],
        when: { key: 'a', type: 'cmd', name: 'a', alias: null, srcRange: { from: 13, to: 14 } },
        then: [{ key: 'b', type: 'evt', name: 'b', alias: null, srcRange: { from: 15, to: 16 } }]
      }
    ];

    const activeLayout = baseLayout();
    const scene = buildSceneModel({
      parsed,
      activeLayout,
      displayedPos: activeLayout.pos,
      renderedEdges: baseRenderedEdges(),
      engineLayout: null,
      activeNodeKeyFromEditor: null,
      selectedNodeKey: null,
      hoveredEdgeKey: null,
      hoveredTraceNodeKey: null,
      canvasMargin: 100
    });

    expect(scene?.viewport?.height).toBeGreaterThan(700);
  });

  it('keeps slice mode on the flat scenario list without creating scenario groups', () => {
    const parsed = baseParsed();
    parsed.scenarios = [
      {
        name: 'Complete TODO',
        srcRange: { from: 10, to: 30 },
        given: [{ key: 'b', type: 'evt', name: 'b', alias: null, srcRange: { from: 11, to: 12 } }],
        when: { key: 'a', type: 'cmd', name: 'a', alias: null, srcRange: { from: 13, to: 14 } },
        then: [{ key: 'b', type: 'evt', name: 'b', alias: null, srcRange: { from: 15, to: 16 } }]
      }
    ];

    const scene = buildSceneModel({
      parsed,
      activeLayout: baseLayout(),
      displayedPos: baseLayout().pos,
      renderedEdges: baseRenderedEdges(),
      engineLayout: null,
      activeNodeKeyFromEditor: null,
      selectedNodeKey: null,
      hoveredEdgeKey: null,
      hoveredTraceNodeKey: null
    });

    expect(scene?.scenarios).toHaveLength(1);
    expect(scene?.scenarioGroups).toEqual([]);
  });

  it('groups overview scenarios by source slice and aligns them to the slice frame', () => {
    const parsed: Parsed = {
      sliceName: 'Overview',
      nodes: new Map<string, VisualNode>([
        ['slice-1::a', node('slice-1::a', 'cmd', 1, 2)],
        ['slice-2::b', node('slice-2::b', 'cmd', 3, 4)]
      ]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [
        {
          name: 'Scenario A',
          srcRange: { from: 10, to: 20 },
          given: [],
          when: { key: 'slice-1::a', type: 'cmd', name: 'a', alias: null, srcRange: { from: 11, to: 12 } },
          then: []
        }
      ],
      scenarioOnlyNodeKeys: []
    };
    const activeLayout: LayoutResult = {
      pos: {
        'slice-1::a': { x: 100, y: 120, w: 180, h: 90 },
        'slice-2::b': { x: 500, y: 120, w: 180, h: 90 }
      },
      rowY: { 1: 120 },
      usedRows: [1],
      rowStreamLabels: {},
      w: 900,
      h: 500
    };

    const scene = buildSceneModel({
      parsed,
      activeLayout,
      displayedPos: activeLayout.pos,
      renderedEdges: [],
      engineLayout: null,
      activeNodeKeyFromEditor: null,
      selectedNodeKey: null,
      hoveredEdgeKey: null,
      hoveredTraceNodeKey: null,
      overviewNodeMetadataByKey: new Map([
        ['slice-1::a', { sourceSliceId: 'slice-1', sourceSliceName: 'Slice 1', sourceNodeKey: 'a', sliceDslOrder: 0 }],
        ['slice-2::b', { sourceSliceId: 'slice-2', sourceSliceName: 'Slice 2', sourceNodeKey: 'b', sliceDslOrder: 0 }]
      ]),
      overviewScenarioMetadataByScenario: new Map([
        [parsed.scenarios[0]!, { sourceSliceId: 'slice-1', sourceSliceName: 'Slice 1', sourceScenarioIndex: 0 }]
      ])
    });

    expect(scene?.scenarioGroups).toEqual([
      {
        key: 'overview-scenario-group-slice-1',
        sliceId: 'slice-1',
        sliceName: 'Slice 1',
        left: 72,
        top: 258,
        width: 236,
        height: 200,
        scenarios: [
          {
            name: 'Scenario A',
            srcRange: { from: 10, to: 20 },
            given: [],
            when: expect.objectContaining({ key: 'slice-1::a' }),
            then: []
          }
        ]
      }
    ]);
  });

  it('derives overview shared-node anchors and dashed connector primitives from cross-slice links', () => {
    const parsed: Parsed = {
      sliceName: 'Overview',
      nodes: new Map<string, VisualNode>([
        ['slice-1::a', node('slice-1::a', 'evt', 1, 2)],
        ['slice-2::a', node('slice-2::a', 'evt', 3, 4)],
        ['slice-4::a', node('slice-4::a', 'evt', 5, 6)]
      ]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const activeLayout: LayoutResult = {
      pos: {
        'slice-1::a': { x: 100, y: 120, w: 180, h: 90 },
        'slice-2::a': { x: 420, y: 120, w: 180, h: 90 },
        'slice-4::a': { x: 860, y: 300, w: 180, h: 90 }
      },
      rowY: { 1: 120, 2: 300 },
      usedRows: [1, 2],
      rowStreamLabels: {},
      w: 1200,
      h: 600
    };

    const scene = buildSceneModel({
      parsed,
      activeLayout,
      displayedPos: activeLayout.pos,
      renderedEdges: [],
      engineLayout: null,
      activeNodeKeyFromEditor: null,
      selectedNodeKey: null,
      hoveredEdgeKey: null,
      hoveredTraceNodeKey: null,
      overviewCrossSliceLinks: [
        {
          key: 'slice-1::a->slice-2::a',
          logicalRef: 'evt:a',
          fromOverviewNodeKey: 'slice-1::a',
          toOverviewNodeKey: 'slice-2::a',
          fromSliceId: 'slice-1',
          toSliceId: 'slice-2',
          fromSliceIndex: 0,
          toSliceIndex: 1,
          distance: 1,
          renderMode: 'shared-node'
        },
        {
          key: 'slice-1::a->slice-4::a',
          logicalRef: 'evt:a',
          fromOverviewNodeKey: 'slice-1::a',
          toOverviewNodeKey: 'slice-4::a',
          fromSliceId: 'slice-1',
          toSliceId: 'slice-4',
          fromSliceIndex: 0,
          toSliceIndex: 3,
          distance: 3,
          renderMode: 'dashed-connector'
        }
      ]
    });

    expect(scene?.edges).toEqual([]);
    expect(scene?.sharedNodeAnchors).toEqual([
      {
        key: 'slice-1::a->slice-2::a',
        logicalRef: 'evt:a',
        leftSliceNodeKey: 'slice-1::a',
        rightSliceNodeKey: 'slice-2::a',
        x: 100,
        y: 120
      }
    ]);
    expect(scene?.crossSliceLinks).toEqual([
      {
        key: 'slice-1::a->slice-2::a',
        logicalRef: 'evt:a',
        renderMode: 'shared-node',
        fromNodeKey: 'slice-1::a',
        toNodeKey: 'slice-2::a'
      },
      {
        key: 'slice-1::a->slice-4::a',
        logicalRef: 'evt:a',
        renderMode: 'dashed-connector',
        fromNodeKey: 'slice-1::a',
        toNodeKey: 'slice-4::a',
        points: [
          { x: 280, y: 165 },
          { x: 860, y: 345 }
        ]
      }
    ]);
  });

  it('collapses an adjacent shared-node link into one visible representative at the source position', () => {
    const parsed: Parsed = {
      sliceName: 'Overview',
      nodes: new Map<string, VisualNode>([
        ['slice-1::a', node('slice-1::a', 'evt', 1, 2)],
        ['slice-2::a', node('slice-2::a', 'evt', 3, 4)]
      ]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const activeLayout: LayoutResult = {
      pos: {
        'slice-1::a': { x: 100, y: 120, w: 180, h: 90 },
        'slice-2::a': { x: 420, y: 120, w: 180, h: 90 }
      },
      rowY: { 1: 120 },
      usedRows: [1],
      rowStreamLabels: {},
      w: 700,
      h: 320
    };

    const scene = buildSceneModel({
      parsed,
      activeLayout,
      displayedPos: activeLayout.pos,
      renderedEdges: [],
      engineLayout: null,
      activeNodeKeyFromEditor: null,
      selectedNodeKey: null,
      hoveredEdgeKey: null,
      hoveredTraceNodeKey: null,
      overviewCrossSliceLinks: [
        {
          key: 'slice-1::a->slice-2::a',
          logicalRef: 'evt:a',
          fromOverviewNodeKey: 'slice-1::a',
          toOverviewNodeKey: 'slice-2::a',
          fromSliceId: 'slice-1',
          toSliceId: 'slice-2',
          fromSliceIndex: 0,
          toSliceIndex: 1,
          distance: 1,
          renderMode: 'shared-node'
        }
      ]
    });

    expect(scene?.nodes).toEqual([
      expect.objectContaining({
        key: 'slice-1::a',
        hidden: true
      }),
      expect.objectContaining({
        key: 'slice-2::a',
        hidden: true
      }),
      expect.objectContaining({
        renderKey: 'shared-node:slice-1::a->slice-2::a',
        key: 'shared-node:slice-1::a->slice-2::a',
        interactionNodeKey: 'slice-1::a',
        hidden: false,
        x: 100,
        y: 120,
        title: 'slice-1::a',
        backingNodeKeys: ['slice-1::a', 'slice-2::a']
      })
    ]);
  });

  it('mirrors hidden backing-node highlight and selection state onto the shared representative', () => {
    const parsed: Parsed = {
      sliceName: 'Overview',
      nodes: new Map<string, VisualNode>([
        ['slice-1::a', node('slice-1::a', 'evt', 1, 2)],
        ['slice-2::a', node('slice-2::a', 'evt', 3, 4)]
      ]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const activeLayout: LayoutResult = {
      pos: {
        'slice-1::a': { x: 100, y: 120, w: 180, h: 90 },
        'slice-2::a': { x: 420, y: 120, w: 180, h: 90 }
      },
      rowY: { 1: 120 },
      usedRows: [1],
      rowStreamLabels: {},
      w: 700,
      h: 320
    };

    const scene = buildSceneModel({
      parsed,
      activeLayout,
      displayedPos: activeLayout.pos,
      renderedEdges: [],
      engineLayout: null,
      activeNodeKeyFromEditor: 'slice-2::a',
      selectedNodeKey: 'slice-2::a',
      hoveredEdgeKey: null,
      hoveredTraceNodeKey: null,
      overviewCrossSliceLinks: [
        {
          key: 'slice-1::a->slice-2::a',
          logicalRef: 'evt:a',
          fromOverviewNodeKey: 'slice-1::a',
          toOverviewNodeKey: 'slice-2::a',
          fromSliceId: 'slice-1',
          toSliceId: 'slice-2',
          fromSliceIndex: 0,
          toSliceIndex: 1,
          distance: 1,
          renderMode: 'shared-node'
        }
      ]
    });

    expect(scene?.nodes.find((entry) => entry.key === 'shared-node:slice-1::a->slice-2::a')).toEqual(
      expect.objectContaining({
        highlighted: true,
        selected: true,
        className: 'highlighted selected'
      })
    );
  });

  it('expands overview viewport bounds to include measured scenario-group width', () => {
    const parsed: Parsed = {
      sliceName: 'Overview',
      nodes: new Map<string, VisualNode>([
        ['slice-1::a', node('slice-1::a', 'cmd', 1, 2)]
      ]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [
        {
          name: 'Scenario A',
          srcRange: { from: 10, to: 20 },
          given: [],
          when: { key: 'slice-1::a', type: 'cmd', name: 'a', alias: null, srcRange: { from: 11, to: 12 } },
          then: []
        }
      ],
      scenarioOnlyNodeKeys: []
    };
    const activeLayout: LayoutResult = {
      pos: {
        'slice-1::a': { x: 100, y: 120, w: 180, h: 90 }
      },
      rowY: { 1: 120 },
      usedRows: [1],
      rowStreamLabels: {},
      w: 300,
      h: 240
    };

    const scene = buildSceneModel({
      parsed,
      activeLayout,
      displayedPos: activeLayout.pos,
      renderedEdges: [],
      engineLayout: null,
      activeNodeKeyFromEditor: null,
      selectedNodeKey: null,
      hoveredEdgeKey: null,
      hoveredTraceNodeKey: null,
      overviewNodeMetadataByKey: new Map([
        ['slice-1::a', { sourceSliceId: 'slice-1', sourceSliceName: 'Slice 1', sourceNodeKey: 'a', sliceDslOrder: 0 }]
      ]),
      overviewScenarioMetadataByScenario: new Map([
        [parsed.scenarios[0]!, { sourceSliceId: 'slice-1', sourceSliceName: 'Slice 1', sourceScenarioIndex: 0 }]
      ]),
      measuredScenarioGroupWidths: {
        'overview-scenario-group-slice-1': 420
      },
      canvasMargin: 100
    });

    expect(scene?.scenarioGroups?.[0]?.width).toBe(420);
    expect(scene?.viewport?.width).toBe(692);
  });

  it('hides scenario-only nodes from main diagram nodes while keeping scenario content', () => {
    const parsed = baseParsed();
    parsed.nodes.set('scenario-node', node('scenario-node', 'evt', 40, 50));
    parsed.scenarios = [
      {
        name: 'Scenario',
        srcRange: { from: 30, to: 60 },
        given: [{ key: 'scenario-node', type: 'evt', name: 'scenario-node', alias: null, srcRange: { from: 41, to: 42 } }],
        when: null,
        then: []
      }
    ];
    parsed.scenarioOnlyNodeKeys = ['scenario-node'];

    const activeLayout = {
      ...baseLayout(),
      pos: {
        ...baseLayout().pos,
        'scenario-node': { x: 700, y: 120, w: 180, h: 90 }
      }
    };

    const scene = buildSceneModel({
      parsed,
      activeLayout,
      displayedPos: activeLayout.pos,
      renderedEdges: baseRenderedEdges(),
      engineLayout: null,
      activeNodeKeyFromEditor: null,
      selectedNodeKey: null,
      hoveredEdgeKey: null,
      hoveredTraceNodeKey: null
    });

    expect(scene?.nodes.some((entry) => entry.key === 'scenario-node')).toBe(false);
    expect(scene?.scenarios[0]?.given[0]?.key).toBe('scenario-node');
  });

  it('omits the default event lane when only scenario-only event nodes occupy it', () => {
    const parsed: Parsed = {
      sliceName: 'Demo Slice',
      nodes: new Map<string, VisualNode>([
        ['cmd-node', node('cmd-node', 'cmd', 1, 2)],
        ['scenario-event', node('scenario-event', 'evt', 3, 4)]
      ]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [
        {
          name: 'Scenario',
          srcRange: { from: 10, to: 20 },
          given: [{ key: 'scenario-event', type: 'evt', name: 'scenario-event', alias: null, srcRange: { from: 11, to: 12 } }],
          when: null,
          then: []
        }
      ],
      scenarioOnlyNodeKeys: ['scenario-event']
    };

    const activeLayout: LayoutResult = {
      pos: {
        'cmd-node': { x: 100, y: 120, w: 180, h: 90 },
        'scenario-event': { x: 420, y: 260, w: 180, h: 90 }
      },
      rowY: { 1: 120, 2: 260 },
      usedRows: [1, 2],
      rowStreamLabels: {},
      w: 800,
      h: 500
    };

    const scene = buildSceneModel({
      parsed,
      activeLayout,
      displayedPos: activeLayout.pos,
      renderedEdges: [],
      engineLayout: null,
      activeNodeKeyFromEditor: null,
      selectedNodeKey: null,
      hoveredEdgeKey: null,
      hoveredTraceNodeKey: null
    });

    expect(scene?.lanes.map((lane) => lane.row)).toEqual([1]);
  });

});
