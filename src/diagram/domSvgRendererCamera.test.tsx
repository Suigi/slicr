// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomSvgDiagramRendererCamera } from './domSvgRendererCamera';
import type { DiagramRendererAdapterProps } from './domSvgRenderer';
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

function baseScene(): DiagramSceneModel {
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
      }
    ],
    edges: [],
    lanes: [],
    boundaries: [],
    scenarios: [],
    worldWidth: 1000,
    worldHeight: 800,
    title: null,
    viewport: {
      width: 1200,
      height: 900,
      offsetX: 40,
      offsetY: 60
    }
  };
}

function renderRenderer(overrides: Partial<DiagramRendererAdapterProps> = {}) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);

  const canvasPanelRef = { current: null };
  const props: DiagramRendererAdapterProps = {
    sceneModel: baseScene(),
    canvasPanelRef,
    isPanning: false,
    docsOpen: false,
    dragTooltip: null,
    dragAndDropEnabled: true,
    routeMode: 'classic',
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
    root?.render(<DomSvgDiagramRendererCamera {...props} />);
  });

  // Mock getBoundingClientRect for the panel
  if (canvasPanelRef.current) {
    (canvasPanelRef.current as HTMLElement).getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      width: 1200,
      height: 900
    });
  }

  return props;
}

describe('DomSvgDiagramRendererCamera', () => {
  it('uses explicit camera defaults and applies world transform wrapper', () => {
    renderRenderer();

    const panel = document.querySelector('.canvas-panel') as HTMLElement | null;
    const world = document.querySelector('.canvas-camera-world') as HTMLElement | null;
    const toolbar = document.querySelector('.camera-zoom-toolbar') as HTMLElement | null;
    expect(panel).not.toBeNull();
    expect(panel?.style.overflow).toBe('hidden');
    expect(toolbar).not.toBeNull();
    expect(world).not.toBeNull();
    expect(world?.dataset.cameraX).toBe('0');
    expect(world?.dataset.cameraY).toBe('0');
    expect(world?.dataset.cameraZoom).toBe('1');
    expect(world?.style.transform).toContain('scale(1)');
  });

  it('supports zoom out/reset/zoom in actions from toolbar', () => {
    renderRenderer();

    const zoomOut = document.querySelector('button[aria-label="Zoom out"]') as HTMLButtonElement | null;
    const reset = document.querySelector('button[aria-label="Reset zoom"]') as HTMLButtonElement | null;
    const zoomIn = document.querySelector('button[aria-label="Zoom in"]') as HTMLButtonElement | null;
    expect(zoomOut).not.toBeNull();
    expect(reset).not.toBeNull();
    expect(zoomIn).not.toBeNull();

    const readZoom = () => Number((document.querySelector('.canvas-camera-world') as HTMLElement | null)?.dataset.cameraZoom ?? '0');

    expect(readZoom()).toBeCloseTo(1, 5);

    act(() => {
      zoomIn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(readZoom()).toBeGreaterThan(1);

    act(() => {
      zoomOut?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(readZoom()).toBeCloseTo(1, 5);

    act(() => {
      zoomIn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      zoomIn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(readZoom()).toBeGreaterThan(1);

    act(() => {
      reset?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(readZoom()).toBeCloseTo(1, 5);
  });

  it('does not render toolbar when camera controls are disabled', () => {
    renderRenderer({ cameraControlsEnabled: false });
    expect(document.querySelector('.camera-zoom-toolbar')).toBeNull();
  });

  it('does not render scenario area when no scenarios exist', () => {
    renderRenderer();

    expect(document.querySelector('.scenario-area')).toBeNull();
    expect(document.querySelector('.scenario-box')).toBeNull();
  });

  it('pans camera via background drag without mutating node world coordinates', () => {
    renderRenderer();

    const panel = document.querySelector('.canvas-panel') as HTMLElement | null;
    const node = document.querySelector('.node') as HTMLElement | null;
    const world = document.querySelector('.canvas-camera-world') as HTMLElement | null;
    expect(panel).not.toBeNull();
    expect(node).not.toBeNull();
    expect(world).not.toBeNull();
    expect(node?.style.left).toBe('100px');
    expect(node?.style.top).toBe('150px');

    const PointerCtor = window.PointerEvent ?? window.MouseEvent;
    act(() => {
      panel?.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, button: 0, clientX: 200, clientY: 220, pointerId: 1 }));
      window.dispatchEvent(new PointerCtor('pointermove', { bubbles: true, buttons: 1, clientX: 260, clientY: 310, pointerId: 1 }));
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, button: 0, clientX: 260, clientY: 310, pointerId: 1 }));
    });

    const worldAfter = document.querySelector('.canvas-camera-world') as HTMLElement | null;
    expect(worldAfter?.dataset.cameraX).toBe('60');
    expect(worldAfter?.dataset.cameraY).toBe('90');
    expect(node?.style.left).toBe('100px');
    expect(node?.style.top).toBe('150px');
  });

  it('pans camera on wheel/trackpad scroll', () => {
    renderRenderer();

    const panel = document.querySelector('.canvas-panel') as HTMLElement | null;
    expect(panel).not.toBeNull();

    act(() => {
      panel?.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        deltaX: 24,
        deltaY: 60,
        clientX: 240,
        clientY: 260
      }));
    });

    const worldAfterWheel = document.querySelector('.canvas-camera-world') as HTMLElement | null;
    expect(worldAfterWheel).not.toBeNull();
    expect(Number(worldAfterWheel?.dataset.cameraZoom ?? 0)).toBeCloseTo(1, 5);
    expect(Number(worldAfterWheel?.dataset.cameraX ?? 0)).toBeCloseTo(-24, 5);
    expect(Number(worldAfterWheel?.dataset.cameraY ?? 0)).toBeCloseTo(-60, 5);
  });

  it('zooms camera around cursor anchor with ctrl+wheel and min/max clamping', () => {
    renderRenderer();

    const panel = document.querySelector('.canvas-panel') as HTMLElement | null;
    expect(panel).not.toBeNull();

    act(() => {
      panel?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -100, ctrlKey: true, clientX: 240, clientY: 260 }));
    });

    const worldAfterZoomIn = document.querySelector('.canvas-camera-world') as HTMLElement | null;
    expect(worldAfterZoomIn).not.toBeNull();
    expect(Number(worldAfterZoomIn?.dataset.cameraZoom ?? 0)).toBeCloseTo(1.1, 5);
    expect(Number(worldAfterZoomIn?.dataset.cameraX ?? 0)).toBeCloseTo(-20, 5);
    expect(Number(worldAfterZoomIn?.dataset.cameraY ?? 0)).toBeCloseTo(-20, 5);

    act(() => {
      for (let i = 0; i < 30; i += 1) {
        panel?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100, ctrlKey: true, clientX: 240, clientY: 260 }));
      }
    });

    const worldAfterClamp = document.querySelector('.canvas-camera-world') as HTMLElement | null;
    expect(Number(worldAfterClamp?.dataset.cameraZoom ?? 0)).toBeCloseTo(0.4, 5);
  });

  it('converts node drag pointerdown into world-space coordinates under camera pan/zoom', () => {
    const beginNodeDrag = vi.fn();
    renderRenderer({ beginNodeDrag });

    const panel = document.querySelector('.canvas-panel') as HTMLElement | null;
    const node = document.querySelector('.node') as HTMLElement | null;
    expect(panel).not.toBeNull();
    expect(node).not.toBeNull();

    const PointerCtor = window.PointerEvent ?? window.MouseEvent;
    act(() => {
      panel?.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, button: 0, clientX: 200, clientY: 220, pointerId: 1 }));
      window.dispatchEvent(new PointerCtor('pointermove', { bubbles: true, buttons: 1, clientX: 260, clientY: 310, pointerId: 1 }));
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, button: 0, clientX: 260, clientY: 310, pointerId: 1 }));
    });

    act(() => {
      panel?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -100, ctrlKey: true, clientX: 240, clientY: 260 }));
    });

    act(() => {
      node?.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, button: 0, clientX: 320, clientY: 370, pointerId: 2 }));
      window.dispatchEvent(new PointerCtor('pointermove', { bubbles: true, buttons: 1, clientX: 360, clientY: 420, pointerId: 2 }));
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, button: 0, clientX: 360, clientY: 420, pointerId: 2 }));
    });

    expect(beginNodeDrag).toHaveBeenCalledTimes(1);
    const eventArg = beginNodeDrag.mock.calls[0]?.[0] as { clientX: number; clientY: number } | undefined;
    expect(eventArg).toBeDefined();
    expect(eventArg?.clientX).toBeCloseTo(212.7272727, 5);
    expect(eventArg?.clientY).toBeCloseTo(210, 5);
    expect(beginNodeDrag.mock.calls[0]?.[1]).toBe('node-1');
  });

  it('renders a scenario box below the main diagram world with Given/When/Then labels', () => {
    const scene = baseScene();
    scene.scenarios = [
      {
        name: 'Complete TODO',
        srcRange: { from: 20, to: 40 },
        given: [{ key: 'node-1', type: 'evt', title: 'todo-added', prefix: 'evt', srcRange: { from: 21, to: 22 } }],
        when: { key: 'node-1', type: 'cmd', title: 'complete-todo', prefix: 'cmd', srcRange: { from: 23, to: 24 } },
        then: [{ key: 'node-1', type: 'evt', title: 'todo-completed', prefix: 'evt', srcRange: { from: 25, to: 26 } }]
      }
    ];

    renderRenderer({ sceneModel: scene });

    const area = document.querySelector('.scenario-area') as HTMLElement | null;
    const box = document.querySelector('.scenario-box') as HTMLElement | null;
    expect(area).not.toBeNull();
    expect(area?.style.top).toBe('824px');
    expect(box).not.toBeNull();
    expect(box?.textContent).toContain('Complete TODO');
    expect(box?.textContent).toContain('Given');
    expect(box?.textContent).toContain('When');
    expect(box?.textContent).toContain('Then');
    const scenarioNodeCards = box?.querySelectorAll('.scenario-node-card.node') ?? [];
    expect(scenarioNodeCards).toHaveLength(3);
    expect(scenarioNodeCards[0]?.textContent).toContain('todo-added');
    expect((scenarioNodeCards[0] as HTMLElement | undefined)?.style.minWidth ?? '').toBe('');
    expect((scenarioNodeCards[0] as HTMLElement | undefined)?.style.maxWidth ?? '').toBe('');
  });

  it('lays out multiple scenario boxes horizontally in source order', () => {
    const scene = baseScene();
    scene.scenarios = [
      {
        name: 'First Scenario',
        srcRange: { from: 20, to: 40 },
        given: [{ key: 'node-1', type: 'evt', title: 'node-1', prefix: 'evt', srcRange: { from: 21, to: 22 } }],
        when: { key: 'node-1', type: 'evt', title: 'node-1', prefix: 'evt', srcRange: { from: 23, to: 24 } },
        then: [{ key: 'node-1', type: 'evt', title: 'node-1', prefix: 'evt', srcRange: { from: 25, to: 26 } }]
      },
      {
        name: 'Second Scenario',
        srcRange: { from: 41, to: 60 },
        given: [{ key: 'node-1', type: 'evt', title: 'node-1', prefix: 'evt', srcRange: { from: 42, to: 43 } }],
        when: { key: 'node-1', type: 'evt', title: 'node-1', prefix: 'evt', srcRange: { from: 44, to: 45 } },
        then: [{ key: 'node-1', type: 'evt', title: 'node-1', prefix: 'evt', srcRange: { from: 46, to: 47 } }]
      }
    ];

    renderRenderer({ sceneModel: scene });

    const boxes = [...document.querySelectorAll('.scenario-box')] as HTMLElement[];
    const area = document.querySelector('.scenario-area') as HTMLElement | null;
    expect(boxes).toHaveLength(2);
    expect(area).not.toBeNull();
    expect(area?.style.width ?? '').toBe('');
    expect(boxes[0]?.textContent).toContain('First Scenario');
    expect(boxes[1]?.textContent).toContain('Second Scenario');
    expect(boxes[0]?.style.left ?? '').toBe('');
    expect(boxes[1]?.style.left ?? '').toBe('');
  });
});
