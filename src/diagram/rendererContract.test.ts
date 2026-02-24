import { describe, expect, it, vi, expectTypeOf } from 'vitest';
import {
  DIAGRAM_RENDERER_CONTRACT_INVARIANTS,
  createNoopDiagramRendererCallbacks,
  validateDiagramSceneModel,
  type DiagramRendererCallbacks,
  type DiagramRendererProps,
  type DiagramSceneModel
} from './rendererContract';

function createScene(overrides: Partial<DiagramSceneModel> = {}): DiagramSceneModel {
  const nodeA = {
    type: 'cmd',
    name: 'a',
    alias: null,
    stream: null,
    key: 'a',
    data: null,
    srcRange: { from: 1, to: 2 }
  };
  const nodeB = {
    type: 'evt',
    name: 'b',
    alias: null,
    stream: null,
    key: 'b',
    data: null,
    srcRange: { from: 3, to: 4 }
  };

  return {
    nodes: [
      {
        renderKey: 'node-a',
        key: 'a',
        node: nodeA,
        nodePrefix: 'cmd',
        className: '',
        type: 'cmd',
        title: 'A',
        prefix: 'cmd',
        x: 10,
        y: 20,
        w: 120,
        h: 80,
        srcRange: { from: 1, to: 2 },
        highlighted: false,
        selected: false,
        related: false
      },
      {
        renderKey: 'node-b',
        key: 'b',
        node: nodeB,
        nodePrefix: 'evt',
        className: '',
        type: 'evt',
        title: 'B',
        prefix: 'evt',
        x: 300,
        y: 20,
        w: 120,
        h: 80,
        srcRange: { from: 3, to: 4 },
        highlighted: false,
        selected: false,
        related: false
      }
    ],
    edges: [
      {
        renderKey: 'edge-a-b-0',
        key: 'a->b#0',
        edgeKey: 'a->b#0',
        from: 'a',
        to: 'b',
        path: 'M 0 0 L 1 1',
        d: 'M 0 0 L 1 1',
        label: null,
        points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        draggableSegmentIndices: [0],
        labelX: 0.5,
        labelY: 0.5,
        hovered: false,
        related: false
      }
    ],
    lanes: [
      {
        key: 'lane-0',
        row: 0,
        bandTop: 0,
        bandHeight: 10,
        y: 0,
        height: 10,
        streamLabel: '',
        labelTop: 8,
        labelLeft: 8
      }
    ],
    boundaries: [],
    worldWidth: 600,
    worldHeight: 400,
    title: { text: 'Slice', top: 6, left: 8 },
    viewport: {
      width: 600,
      height: 400,
      offsetX: 100,
      offsetY: 80
    },
    ...overrides
  };
}

describe('rendererContract', () => {
  it('creates a full callback object with no-op defaults and respects overrides', () => {
    const onNodeSelect = vi.fn();
    const callbacks = createNoopDiagramRendererCallbacks({ onNodeSelect });

    callbacks.onNodeHoverRange(null);
    callbacks.onNodeSelect('node-a');
    callbacks.onEdgeHover(null);
    callbacks.onNodeMoveCommit('node-a', { x: 10, y: 20 });
    callbacks.onEdgePointsCommit('edge-a', [{ x: 0, y: 0 }, { x: 1, y: 1 }]);

    expect(onNodeSelect).toHaveBeenCalledTimes(1);
    expect(onNodeSelect).toHaveBeenCalledWith('node-a');
  });

  it('exposes strict renderer prop types', () => {
    expectTypeOf<DiagramRendererProps>().toMatchTypeOf<{
      scene: DiagramSceneModel;
      callbacks: DiagramRendererCallbacks;
      className?: string;
    }>();
  });

  it('accepts a valid scene model', () => {
    const result = validateDiagramSceneModel(createScene());
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports duplicate node and edge keys', () => {
    const scene = createScene({
      nodes: [
        createScene().nodes[0],
        { ...createScene().nodes[1], key: 'a' }
      ],
      edges: [
        createScene().edges[0],
        { ...createScene().edges[0] }
      ]
    });

    const result = validateDiagramSceneModel(scene);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('duplicate node key');
    expect(result.errors.join('\n')).toContain('duplicate edge key');
  });

  it('reports edges that reference unknown nodes', () => {
    const scene = createScene({
      edges: [
        {
          ...createScene().edges[0],
          from: 'missing-source'
        }
      ]
    });

    const result = validateDiagramSceneModel(scene);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('unknown source node');
  });

  it('reports non-finite node geometry and invalid viewport sizes', () => {
    const scene = createScene({
      nodes: [
        {
          ...createScene().nodes[0],
          x: Number.NaN
        },
        createScene().nodes[1]
      ],
      viewport: {
        width: 0,
        height: Number.POSITIVE_INFINITY,
        offsetX: 0,
        offsetY: 0
      }
    });

    const result = validateDiagramSceneModel(scene);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('non-finite node geometry');
    expect(result.errors.join('\n')).toContain('viewport width must be > 0');
    expect(result.errors.join('\n')).toContain('viewport height must be > 0');
  });

  it('documents strict renderer invariants for adapter implementers', () => {
    const invariantText = DIAGRAM_RENDERER_CONTRACT_INVARIANTS.join('\n');
    expect(invariantText).toContain('Stable IDs');
    expect(invariantText).toContain('Coordinate Space');
    expect(invariantText).toContain('Commit-on-end');
  });
});
