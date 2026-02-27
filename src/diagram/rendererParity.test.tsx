// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomSvgDiagramRenderer, type DiagramRendererAdapterProps } from './domSvgRenderer';
import { DomSvgDiagramRendererCamera } from './domSvgRendererCamera';
import type { DiagramSceneModel } from './rendererContract';

let root: ReactDOM.Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root && host) {
    act(() => root?.unmount());
  }
  root = null;
  host = null;
  document.body.innerHTML = '';
});

type RendererComponent = (props: DiagramRendererAdapterProps) => JSX.Element | null;

function createScene(): DiagramSceneModel {
  return {
    nodes: [
      {
        renderKey: 'node-1',
        key: 'node-1',
        node: {
          type: 'evt',
          name: 'node-1',
          alias: null,
          stream: null,
          key: 'node-1',
          data: null,
          srcRange: { from: 1, to: 5 }
        },
        nodePrefix: 'evt',
        className: '',
        type: 'evt',
        title: 'node-1',
        prefix: 'evt',
        x: 100,
        y: 150,
        w: 180,
        h: 90,
        srcRange: { from: 1, to: 5 },
        highlighted: false,
        selected: false,
        related: false
      },
      {
        renderKey: 'node-2',
        key: 'node-2',
        node: {
          type: 'cmd',
          name: 'node-2',
          alias: null,
          stream: null,
          key: 'node-2',
          data: null,
          srcRange: { from: 6, to: 10 }
        },
        nodePrefix: 'cmd',
        className: '',
        type: 'cmd',
        title: 'node-2',
        prefix: 'cmd',
        x: 420,
        y: 150,
        w: 180,
        h: 90,
        srcRange: { from: 6, to: 10 },
        highlighted: false,
        selected: false,
        related: false
      }
    ],
    edges: [
      {
        renderKey: 'edge-1',
        key: 'node-1-node-2-0',
        edgeKey: 'node-1->node-2#0',
        from: 'node-1',
        to: 'node-2',
        path: 'M100,100 L200,100',
        d: 'M100,100 L200,100',
        label: null,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 }
        ],
        draggableSegmentIndices: [0],
        labelX: 150,
        labelY: 90,
        hovered: false,
        related: false
      }
    ],
    lanes: [],
    boundaries: [],
    scenarios: [],
    worldWidth: 900,
    worldHeight: 700,
    title: null,
    viewport: {
      width: 1000,
      height: 800,
      offsetX: 20,
      offsetY: 30
    }
  };
}

function renderRenderer(Renderer: RendererComponent, overrides: Partial<DiagramRendererAdapterProps> = {}) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);

  const props: DiagramRendererAdapterProps = {
    sceneModel: createScene(),
    canvasPanelRef: { current: null },
    isPanning: false,
    docsOpen: false,
    dragTooltip: null,
    dragAndDropEnabled: true,
    routeMode: 'elk',
    beginCanvasPan: vi.fn(),
    beginNodeDrag: vi.fn(),
    beginEdgeSegmentDrag: vi.fn(),
    onNodeHoverRange: vi.fn(),
    onNodeSelect: vi.fn(),
    onNodeOpenInEditor: vi.fn(),
    onEdgeHover: vi.fn(),
    ...overrides
  };

  act(() => {
    root?.render(<Renderer {...props} />);
  });

  return props;
}

const suites: Array<{ name: string; renderer: RendererComponent }> = [
  { name: 'dom-svg', renderer: DomSvgDiagramRenderer },
  { name: 'camera', renderer: DomSvgDiagramRendererCamera }
];

describe('renderer parity', () => {
  for (const suite of suites) {
    it(`${suite.name} maps shared selection/hover and edge-handle interactions`, () => {
      const props = renderRenderer(suite.renderer);

      const node = document.querySelector('.node.evt') as HTMLElement | null;
      const edgeHoverTarget = document.querySelector('.edge-hover-target') as SVGPathElement | null;
      const edgeHandle = document.querySelector('.edge-segment-handle') as SVGLineElement | null;

      expect(node).not.toBeNull();
      expect(edgeHoverTarget).not.toBeNull();
      expect(edgeHandle).not.toBeNull();

      act(() => {
        node?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        edgeHoverTarget?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      });

      expect(props.onNodeHoverRange).toHaveBeenCalledWith({ from: 1, to: 5 });
      expect(props.onNodeSelect).toHaveBeenCalledWith('node-1');
      expect(props.onEdgeHover).toHaveBeenCalledWith('node-1->node-2#0');

      const PointerCtor = window.PointerEvent ?? window.MouseEvent;
      act(() => {
        edgeHandle?.dispatchEvent(new PointerCtor('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: 120,
          clientY: 100,
          pointerId: 2
        }));
      });

      expect(props.beginEdgeSegmentDrag).toHaveBeenCalledTimes(1);
      expect(props.beginEdgeSegmentDrag).toHaveBeenCalledWith(expect.anything(), 'node-1->node-2#0', 0, [{ x: 100, y: 100 }, { x: 200, y: 100 }]);
    });
  }
});
