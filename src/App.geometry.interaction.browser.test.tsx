import { StrictMode, act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import {
  DIAGRAM_RENDERER_FLAG_STORAGE_KEY,
  DRAG_AND_DROP_FLAG_STORAGE_KEY
} from './domain/runtimeFlags';
import { SLICES_LAYOUT_STORAGE_KEY, SLICES_STORAGE_KEY } from './sliceLibrary';

let root: ReactDOM.Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root && host) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  host = null;
  document.body.innerHTML = '';
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

function renderApp() {
  host = document.createElement('div');
  host.id = 'root';
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);
  act(() => {
    root?.render(<App />);
  });
}

async function waitFor(condition: () => boolean, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    if (condition()) {
      return;
    }
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    });
  }
}

async function waitForSelector(selector: string) {
  await waitFor(() => document.querySelector(selector) !== null);
}

function renderAppStrict() {
  host = document.createElement('div');
  host.id = 'root';
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);
  act(() => {
    root?.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
}

function setSingleEventSlice(dsl = 'slice "A"\n\nevt:simple-event') {
  localStorage.setItem(
    SLICES_STORAGE_KEY,
    JSON.stringify({
      selectedSliceId: 'a',
      slices: [{ id: 'a', dsl }]
    })
  );
}

function openSliceMenu() {
  if (document.querySelector('.slice-menu-panel')) {
    return;
  }
  const menuToggle = document.querySelector('button[aria-label="Select slice"]') as HTMLButtonElement | null;
  expect(menuToggle).not.toBeNull();
  act(() => {
    menuToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function clickSliceMenuItem(label: string) {
  const item = [...document.querySelectorAll('.slice-menu-item')]
    .find((button) => button.textContent?.includes(label)) as HTMLButtonElement | undefined;
  expect(item).toBeDefined();
  act(() => {
    item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function clickResetPositionsButton() {
  const resetButton = document.querySelector('button[aria-label="Reset diagram positions"]') as HTMLButtonElement | null;
  expect(resetButton).not.toBeNull();
  act(() => {
    resetButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function supportsVerticalScroll(element: HTMLElement, target = 120) {
  const previous = element.scrollTop;
  element.scrollTop = target;
  const supported = element.scrollTop === target;
  element.scrollTop = previous;
  return supported;
}

describe('App geometry interactions', () => {
  it('uses selected renderer engine for documentation previews', async () => {
    localStorage.setItem(DIAGRAM_RENDERER_FLAG_STORAGE_KEY, 'dom-svg-camera');
    renderApp();
    await waitForSelector('.main .canvas-panel .canvas-camera-world');

    const mainCameraWorld = document.querySelector('.main .canvas-panel .canvas-camera-world') as HTMLElement | null;
    expect(mainCameraWorld).not.toBeNull();
    expect(mainCameraWorld?.dataset.cameraX).toBeDefined();
    expect(mainCameraWorld?.dataset.cameraY).toBeDefined();

    const docsToggle = document.querySelector('button[aria-label="Toggle documentation panel"]');
    expect(docsToggle).not.toBeNull();

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForSelector('.docs-panel .canvas-camera-world');
    const docsWorld = document.querySelector('.docs-panel .canvas-camera-world') as HTMLElement | null;
    const firstDocDiagram = document.querySelector('.docs-panel .doc-diagram') as HTMLElement | null;
    expect(docsWorld).not.toBeNull();
    expect(document.querySelector('.docs-panel .camera-zoom-toolbar')).toBeNull();
    expect(firstDocDiagram?.style.width).toBe('560px');
    expect(firstDocDiagram?.style.height).toBe('560px');
    expect(Number(docsWorld?.dataset.cameraZoom ?? 0)).toBeGreaterThan(0);
    expect(Number(docsWorld?.dataset.cameraZoom ?? 0)).toBeLessThanOrEqual(1.2);
  });

  it('disables camera pan and zoom interactions for documentation previews', () => {
    localStorage.setItem(DIAGRAM_RENDERER_FLAG_STORAGE_KEY, 'dom-svg-camera');
    renderApp();

    const docsToggle = document.querySelector('button[aria-label="Toggle documentation panel"]');
    expect(docsToggle).not.toBeNull();

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const docsWorld = document.querySelector('.docs-panel .canvas-camera-world') as HTMLElement | null;
    const docsPanel = document.querySelector('.docs-panel .canvas-panel') as HTMLElement | null;
    expect(docsWorld).not.toBeNull();
    expect(docsPanel).not.toBeNull();

    const initialX = docsWorld?.dataset.cameraX;
    const initialY = docsWorld?.dataset.cameraY;
    const initialZoom = docsWorld?.dataset.cameraZoom;

    act(() => {
      docsPanel?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaX: 40, deltaY: 80, clientX: 200, clientY: 180 }));
      docsPanel?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -120, ctrlKey: true, clientX: 200, clientY: 180 }));
    });

    const afterWorld = document.querySelector('.docs-panel .canvas-camera-world') as HTMLElement | null;
    expect(afterWorld?.dataset.cameraX).toBe(initialX);
    expect(afterWorld?.dataset.cameraY).toBe(initialY);
    expect(afterWorld?.dataset.cameraZoom).toBe(initialZoom);
  });

  it('preserves canvas scroll position when opening and closing documentation panel', () => {
    renderApp();

    const docsToggle = document.querySelector('button[aria-label="Toggle documentation panel"]');
    const canvasPanel = document.querySelector('.canvas-panel') as HTMLDivElement | null;
    expect(docsToggle).not.toBeNull();
    expect(canvasPanel).not.toBeNull();

    const canvasScrollSpacer = document.createElement('div');
    canvasScrollSpacer.style.width = '2200px';
    canvasScrollSpacer.style.height = '2200px';
    canvasPanel?.appendChild(canvasScrollSpacer);
    const expectedLeft = 260;
    const expectedTop = 140;
    const supportsVertical = canvasPanel ? supportsVerticalScroll(canvasPanel, expectedTop) : false;

    act(() => {
      if (canvasPanel) {
        canvasPanel.scrollLeft = expectedLeft;
        if (supportsVertical) {
          canvasPanel.scrollTop = expectedTop;
        }
      }
    });
    expect(canvasPanel?.scrollLeft).toBe(expectedLeft);
    expect(canvasPanel?.scrollTop).toBe(supportsVertical ? expectedTop : 0);

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(canvasPanel?.classList.contains('hidden')).toBe(true);

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(canvasPanel?.classList.contains('hidden')).toBe(false);
    expect(canvasPanel?.scrollLeft).toBe(expectedLeft);
    expect(canvasPanel?.scrollTop).toBe(supportsVertical ? expectedTop : 0);
  });

  it('preserves documentation scroll position when closing and reopening documentation panel', () => {
    renderApp();

    const docsToggle = document.querySelector('button[aria-label="Toggle documentation panel"]');
    expect(docsToggle).not.toBeNull();
    expect(document.querySelector('.docs-panel')).toBeNull();

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const docsPanel = document.querySelector('.docs-panel') as HTMLDivElement | null;
    const docsShell = document.querySelector('.docs-panel-shell');
    expect(docsPanel).not.toBeNull();
    expect(docsShell?.classList.contains('hidden')).toBe(false);
    const docsScrollSpacer = document.createElement('div');
    docsScrollSpacer.style.height = '2200px';
    docsPanel?.appendChild(docsScrollSpacer);
    const expectedTop = 220;
    const supportsVertical = docsPanel ? supportsVerticalScroll(docsPanel, expectedTop) : false;

    act(() => {
      if (docsPanel) {
        if (supportsVertical) {
          docsPanel.scrollTop = expectedTop;
        }
      }
    });
    expect(docsPanel?.scrollTop).toBe(supportsVertical ? expectedTop : 0);

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(docsShell?.classList.contains('hidden')).toBe(true);

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(docsShell?.classList.contains('hidden')).toBe(false);
    expect(docsPanel?.scrollTop).toBe(supportsVertical ? expectedTop : 0);
  });

  it('restores saved manual node positions for the selected slice on render', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\nevt:simple-event' }]
      })
    );
    localStorage.setItem(
      SLICES_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        a: {
          nodes: { 'simple-event': { x: 315, y: 265 } },
          edges: {}
        }
      })
    );

    renderApp();
    await waitForSelector('.main .node.evt');

    const eventNode = document.querySelector('.main .node.evt') as HTMLElement | null;
    expect(eventNode).not.toBeNull();
    expect(eventNode?.style.left).toBe('315px');
    expect(eventNode?.style.top).toBe('265px');
  });

  it('loads saved manual node positions when switching slices', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          { id: 'a', dsl: 'slice "A"\n\nevt:simple-event' },
          { id: 'b', dsl: 'slice "B"\n\nevt:simple-event' }
        ]
      })
    );
    localStorage.setItem(
      SLICES_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        a: {
          nodes: { 'simple-event': { x: 115, y: 95 } },
          edges: {}
        },
        b: {
          nodes: { 'simple-event': { x: 445, y: 355 } },
          edges: {}
        }
      })
    );

    renderApp();
    await waitForSelector('.main .node.evt');

    const eventNodeBefore = document.querySelector('.main .node.evt') as HTMLElement | null;
    expect(eventNodeBefore?.style.left).toBe('115px');
    expect(eventNodeBefore?.style.top).toBe('95px');

    openSliceMenu();
    clickSliceMenuItem('B');
    await waitFor(() => (document.querySelector('.main .node.evt') as HTMLElement | null)?.style.left === '445px');

    const eventNodeAfter = document.querySelector('.main .node.evt') as HTMLElement | null;
    expect(eventNodeAfter?.style.left).toBe('445px');
    expect(eventNodeAfter?.style.top).toBe('355px');
  });

  it('does not wipe saved geometry on StrictMode refresh', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\nevt:simple-event' }]
      })
    );
    localStorage.setItem(
      SLICES_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        a: {
          nodes: { 'simple-event': { x: 315, y: 265 } },
          edges: {}
        }
      })
    );

    renderAppStrict();
    await waitForSelector('.main .node.evt');

    const eventNode = document.querySelector('.main .node.evt') as HTMLElement | null;
    expect(eventNode?.style.left).toBe('315px');
    expect(eventNode?.style.top).toBe('265px');
    expect(localStorage.getItem(SLICES_LAYOUT_STORAGE_KEY)).toContain('"simple-event"');
  });

  it('appends node-moved events on drag end', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\nevt:simple-event' }]
      })
    );

    renderApp();
    await waitForSelector('.main .node.evt');

    const node = document.querySelector('.main .node.evt') as HTMLElement | null;
    expect(node).not.toBeNull();

    const beforeRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const beforeEvents = beforeRaw ? (JSON.parse(beforeRaw) as Array<{ type: string }>) : [];
    const beforeNodeMoveCount = beforeEvents.filter((event) => event.type === 'node-moved').length;

    const PointerCtor = window.PointerEvent ?? window.MouseEvent;
    act(() => {
      node?.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100, pointerId: 1 }));
      window.dispatchEvent(new PointerCtor('pointermove', { bubbles: true, buttons: 1, clientX: 180, clientY: 180, pointerId: 1 }));
    });

    const midRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const midEvents = midRaw ? (JSON.parse(midRaw) as Array<{ type: string }>) : [];
    const midNodeMoveCount = midEvents.filter((event) => event.type === 'node-moved').length;
    expect(midNodeMoveCount).toBe(beforeNodeMoveCount);

    act(() => {
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, button: 0, clientX: 180, clientY: 180, pointerId: 1 }));
    });

    const afterRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const afterEvents = afterRaw ? (JSON.parse(afterRaw) as Array<{ type: string }>) : [];
    const afterNodeMoveCount = afterEvents.filter((event) => event.type === 'node-moved').length;
    expect(afterNodeMoveCount).toBe(beforeNodeMoveCount + 1);
  });

  it('keeps the selected node selected while left-button panning the canvas', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\nevt:simple-event' }]
      })
    );

    renderApp();
    await waitForSelector('.main .node.evt');

    const node = document.querySelector('.main .node.evt') as HTMLElement | null;
    const canvas = document.getElementById('canvas') as HTMLElement | null;
    expect(node).not.toBeNull();
    expect(canvas).not.toBeNull();

    act(() => {
      node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(node?.classList.contains('selected')).toBe(true);

    const PointerCtor = window.PointerEvent ?? window.MouseEvent;
    act(() => {
      canvas?.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, button: 0, clientX: 120, clientY: 120, pointerId: 7 }));
      window.dispatchEvent(new PointerCtor('pointermove', { bubbles: true, buttons: 1, clientX: 170, clientY: 170, pointerId: 7 }));
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, button: 0, clientX: 170, clientY: 170, pointerId: 7 }));
    });

    expect(node?.classList.contains('selected')).toBe(true);
  });

  it('does not drag nodes when drag-and-drop flag is disabled', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\nevt:simple-event' }]
      })
    );
    localStorage.setItem(DRAG_AND_DROP_FLAG_STORAGE_KEY, 'false');

    renderApp();
    await waitForSelector('.main .node.evt');

    const node = document.querySelector('.main .node.evt') as HTMLElement | null;
    expect(node).not.toBeNull();

    const beforeRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const beforeEvents = beforeRaw ? (JSON.parse(beforeRaw) as Array<{ type: string }>) : [];
    const beforeNodeMoveCount = beforeEvents.filter((event) => event.type === 'node-moved').length;

    const PointerCtor = window.PointerEvent ?? window.MouseEvent;
    act(() => {
      node?.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100, pointerId: 1 }));
      window.dispatchEvent(new PointerCtor('pointermove', { bubbles: true, buttons: 1, clientX: 180, clientY: 180, pointerId: 1 }));
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, button: 0, clientX: 180, clientY: 180, pointerId: 1 }));
    });

    const afterRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const afterEvents = afterRaw ? (JSON.parse(afterRaw) as Array<{ type: string }>) : [];
    const afterNodeMoveCount = afterEvents.filter((event) => event.type === 'node-moved').length;
    expect(afterNodeMoveCount).toBe(beforeNodeMoveCount);
  });

  it('disables node dragging and edge handles in overview mode', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\ncmd:start\n\nevt:finish <- cmd:start' }]
      })
    );

    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const showOverviewItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Show Project Overview')
    ) as HTMLButtonElement | undefined;
    expect(showOverviewItem).toBeDefined();

    act(() => {
      showOverviewItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForSelector('.main .node.cmd');
    const node = document.querySelector('.main .node.cmd') as HTMLElement | null;
    expect(node).not.toBeNull();
    expect(document.querySelector('.edge-segment-handle')).toBeNull();

    const beforeRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const beforeEvents = beforeRaw ? (JSON.parse(beforeRaw) as Array<{ type: string }>) : [];
    const beforeNodeMoveCount = beforeEvents.filter((event) => event.type === 'node-moved').length;

    const PointerCtor = window.PointerEvent ?? window.MouseEvent;
    act(() => {
      node?.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100, pointerId: 11 }));
      window.dispatchEvent(new PointerCtor('pointermove', { bubbles: true, buttons: 1, clientX: 180, clientY: 180, pointerId: 11 }));
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, button: 0, clientX: 180, clientY: 180, pointerId: 11 }));
    });

    const afterRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const afterEvents = afterRaw ? (JSON.parse(afterRaw) as Array<{ type: string }>) : [];
    const afterNodeMoveCount = afterEvents.filter((event) => event.type === 'node-moved').length;
    expect(afterNodeMoveCount).toBe(beforeNodeMoveCount);
  });

  it('preserves the main diagram viewport when switching between slice and overview mode', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          { id: 'a', dsl: 'slice "A"\n\nevt:first-node' },
          { id: 'b', dsl: 'slice "B"\n\nevt:second-node' }
        ]
      })
    );

    renderApp();
    await waitForSelector('.main .canvas-camera-world');

    const panel = document.querySelector('.main .canvas-panel') as HTMLElement | null;
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

    const beforeOverview = document.querySelector('.main .canvas-camera-world') as HTMLElement | null;
    const cameraX = beforeOverview?.dataset.cameraX;
    const cameraY = beforeOverview?.dataset.cameraY;
    const cameraZoom = beforeOverview?.dataset.cameraZoom;
    expect(cameraX).not.toBeUndefined();
    expect(cameraY).not.toBeUndefined();
    expect(cameraZoom).not.toBeUndefined();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const showOverviewItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Show Project Overview')
    ) as HTMLButtonElement | undefined;
    expect(showOverviewItem).toBeDefined();

    act(() => {
      showOverviewItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForSelector('.overview-slice-frame');

    const inOverview = document.querySelector('.main .canvas-camera-world') as HTMLElement | null;
    expect(inOverview?.dataset.cameraX).toBe(cameraX);
    expect(inOverview?.dataset.cameraY).toBe(cameraY);
    expect(inOverview?.dataset.cameraZoom).toBe(cameraZoom);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const hideOverviewItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Hide Project Overview')
    ) as HTMLButtonElement | undefined;
    expect(hideOverviewItem).toBeDefined();

    act(() => {
      hideOverviewItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitFor(() => document.querySelector('.overview-slice-frame') === null);

    const afterOverview = document.querySelector('.main .canvas-camera-world') as HTMLElement | null;
    expect(afterOverview?.dataset.cameraX).toBe(cameraX);
    expect(afterOverview?.dataset.cameraY).toBe(cameraY);
    expect(afterOverview?.dataset.cameraZoom).toBe(cameraZoom);
  });

  it('appends layout-reset events when resetting positions from dev controls', () => {
    setSingleEventSlice();

    renderApp();

    const beforeRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const beforeEvents = beforeRaw ? (JSON.parse(beforeRaw) as Array<{ type: string }>) : [];
    const beforeResetCount = beforeEvents.filter((event) => event.type === 'layout-reset').length;

    clickResetPositionsButton();

    const afterRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const afterEvents = afterRaw ? (JSON.parse(afterRaw) as Array<{ type: string }>) : [];
    const afterResetCount = afterEvents.filter((event) => event.type === 'layout-reset').length;
    expect(afterResetCount).toBe(beforeResetCount + 1);
  });

  it('tints reset positions control when manual layout overrides exist', async () => {
    setSingleEventSlice();

    renderApp();
    await waitForSelector('.main .node.evt');

    const resetButton = document.querySelector('button[aria-label="Reset diagram positions"]') as HTMLButtonElement | null;
    expect(resetButton).not.toBeNull();
    expect(resetButton?.classList.contains('has-manual-layout-overrides')).toBe(false);

    const node = document.querySelector('.main .node.evt') as HTMLElement | null;
    expect(node).not.toBeNull();
    const PointerCtor = window.PointerEvent ?? window.MouseEvent;
    act(() => {
      node?.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100, pointerId: 1 }));
      window.dispatchEvent(new PointerCtor('pointermove', { bubbles: true, buttons: 1, clientX: 180, clientY: 180, pointerId: 1 }));
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, button: 0, clientX: 180, clientY: 180, pointerId: 1 }));
    });

    expect(resetButton?.classList.contains('has-manual-layout-overrides')).toBe(true);

    clickResetPositionsButton();

    expect(resetButton?.classList.contains('has-manual-layout-overrides')).toBe(false);
  });
});
