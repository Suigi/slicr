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
    scenarios: []
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
  it('builds a classic scene model with viewport, lanes, boundaries, and node states', () => {
    const parsed = baseParsed();
    const activeLayout = baseLayout();
    const displayedPos: Record<string, Position> = activeLayout.pos;
    const renderedEdges = baseRenderedEdges();

    const scene = buildSceneModel({
      parsed,
      activeLayout,
      displayedPos,
      renderedEdges,
      routeMode: 'classic',
      engineLayout: null,
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
      routeMode: 'elk',
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
      routeMode: 'classic',
      engineLayout: null,
      activeNodeKeyFromEditor: null,
      selectedNodeKey: null,
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
  });

});
