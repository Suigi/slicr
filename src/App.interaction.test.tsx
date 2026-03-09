// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import {
  DIAGRAM_RENDERER_FLAG_STORAGE_KEY,
  DRAG_AND_DROP_FLAG_STORAGE_KEY,
  RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY
} from './domain/runtimeFlags';
import { SLICES_STORAGE_KEY } from './sliceLibrary';

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
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);
  act(() => {
    root?.render(<App />);
  });
  return flushAppState();
}

async function flushAppState() {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  });
}

async function dispatchAndFlush(interaction: () => void) {
  await act(async () => {
    interaction();
    await Promise.resolve();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  });
}

async function waitForElement(selector: string, attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    const match = document.querySelector(selector);
    if (match) {
      return match;
    }
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    });
  }
  return document.querySelector(selector);
}

async function waitForElementWithoutAnimationFrame(selector: string, attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    const match = document.querySelector(selector);
    if (match) {
      return match;
    }
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    });
  }
  return document.querySelector(selector);
}

describe('App interactions', () => {
  it('toggles the documentation panel from the header', async () => {
    await renderApp();

    const docsToggle = document.querySelector('button[aria-label="Toggle documentation panel"]');
    expect(docsToggle).not.toBeNull();
    expect(document.querySelector('.docs-panel-shell')).toBeNull();

    await dispatchAndFlush(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const docsShell = document.querySelector('.docs-panel-shell');
    expect(document.querySelector('.docs-panel')).not.toBeNull();
    expect(docsShell?.classList.contains('hidden')).toBe(false);
    expect(document.querySelectorAll('.doc-feature-card').length).toBeGreaterThan(0);
    expect(document.querySelector('.docs-panel')).not.toBeNull();
    expect(document.querySelector('.canvas-panel')).not.toBeNull();
    expect(document.querySelector('.canvas-panel')?.classList.contains('hidden')).toBe(true);
  });

  it('presents settled slice layout without waiting for a requestAnimationFrame measurement pass', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [
          {
            id: 'slice-a',
            dsl: [
              'slice "Measured Slice"',
              '',
              'cmd:create-list "Create List"',
              'data:',
              '  name: "Jake\'s Birthday"'
            ].join('\n')
          }
        ]
      })
    );

    const requestAnimationFrameQueue: FrameRequestCallback[] = [];
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      requestAnimationFrameQueue.push(callback);
      return requestAnimationFrameQueue.length;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((handle: number) => {
      requestAnimationFrameQueue[handle - 1] = () => undefined;
    }) as typeof window.cancelAnimationFrame;

    try {
      await renderApp();
      expect(await waitForElementWithoutAnimationFrame('.main .canvas-camera-world')).not.toBeNull();
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });

  it('hides the editor and analysis panels in overview mode while keeping the main canvas mounted', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [{ id: 'slice-a', dsl: 'slice "Overview"\n\nevt:selected-node' }]
      })
    );

    await renderApp();
    await waitForElement('.main .canvas-camera-world');

    const editorToggle = document.querySelector('button[aria-label="Toggle DSL editor"]');
    const node = document.querySelector('.node.evt');
    const editorPanel = document.querySelector('.editor-panel');

    expect(editorToggle).not.toBeNull();
    expect(node).not.toBeNull();
    expect(editorPanel?.classList.contains('open')).toBe(false);
    expect(editorPanel?.classList.contains('hidden')).toBe(false);
    expect(document.querySelector('.cross-slice-usage-panel')).toBeNull();

    await dispatchAndFlush(() => {
      editorToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(editorPanel?.classList.contains('open')).toBe(true);
    expect(document.querySelector('.cross-slice-usage-panel')).not.toBeNull();
    expect(document.querySelector('.main .canvas-panel')).not.toBeNull();

    await dispatchAndFlush(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const showOverviewItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Show Project Overview')
    ) as HTMLButtonElement | undefined;
    expect(showOverviewItem).toBeDefined();

    await dispatchAndFlush(() => {
      showOverviewItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForElement('.overview-slice-frame');

    expect(editorPanel?.classList.contains('open')).toBe(false);
    expect(editorPanel?.classList.contains('hidden')).toBe(true);
    expect(document.querySelector('.cross-slice-usage-panel')).toBeNull();
    expect(document.querySelector('.main .canvas-panel')).not.toBeNull();
  });

  it('restores the editor and analysis panels after exiting overview mode', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [{ id: 'slice-a', dsl: 'slice "Overview"\n\nevt:selected-node' }]
      })
    );

    await renderApp();
    await waitForElement('.main .canvas-camera-world');

    const editorToggle = document.querySelector('button[aria-label="Toggle DSL editor"]');
    const node = document.querySelector('.node.evt');
    const editorPanel = document.querySelector('.editor-panel');

    await dispatchAndFlush(() => {
      editorToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(editorPanel?.classList.contains('open')).toBe(true);
    expect(editorPanel?.classList.contains('hidden')).toBe(false);
    expect(document.querySelector('.cross-slice-usage-panel')).not.toBeNull();

    await dispatchAndFlush(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const showOverviewItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Show Project Overview')
    ) as HTMLButtonElement | undefined;
    expect(showOverviewItem).toBeDefined();

    await dispatchAndFlush(() => {
      showOverviewItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForElement('.overview-slice-frame');

    expect(editorPanel?.classList.contains('open')).toBe(false);
    expect(editorPanel?.classList.contains('hidden')).toBe(true);
    expect(document.querySelector('.cross-slice-usage-panel')).toBeNull();

    await dispatchAndFlush(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const hideOverviewItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Hide Project Overview')
    ) as HTMLButtonElement | undefined;
    expect(hideOverviewItem).toBeDefined();

    await dispatchAndFlush(() => {
      hideOverviewItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForElement('.main .canvas-camera-world');

    expect(editorPanel?.classList.contains('open')).toBe(true);
    expect(editorPanel?.classList.contains('hidden')).toBe(false);
    expect(document.querySelector('.cross-slice-usage-panel')).not.toBeNull();
    expect(document.querySelector('.main .canvas-panel')).not.toBeNull();
  });

  it('keeps overview node clicks in-canvas without reopening hidden panels', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [
          { id: 'slice-a', dsl: 'slice "Alpha"\n\nevt:first-node' },
          { id: 'slice-b', dsl: 'slice "Beta"\n\nevt:second-node' }
        ]
      })
    );

    await renderApp();

    await dispatchAndFlush(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const showOverviewItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Show Project Overview')
    ) as HTMLButtonElement | undefined;
    expect(showOverviewItem).toBeDefined();

    await dispatchAndFlush(() => {
      showOverviewItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForElement('.overview-slice-frame');

    const overviewNode = [...document.querySelectorAll('.node')]
      .find((element) => element.textContent?.includes('second-node')) as HTMLElement | undefined;
    const editorPanel = document.querySelector('.editor-panel');
    expect(overviewNode).toBeDefined();
    expect(editorPanel?.classList.contains('open')).toBe(false);
    expect(document.querySelector('.cross-slice-usage-panel')).toBeNull();

    await dispatchAndFlush(() => {
      overviewNode?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(overviewNode?.classList.contains('selected')).toBe(true);
    expect(editorPanel?.classList.contains('open')).toBe(false);
    expect(document.querySelector('.cross-slice-usage-panel')).toBeNull();

    await dispatchAndFlush(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    expect(
      [...document.querySelectorAll('.command-palette-item')]
        .some((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Hide Project Overview')
    ).toBe(true);
  });

  it('renders one slice frame per visible slice in overview mode instead of a single global title', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [
          { id: 'slice-a', dsl: 'slice "Alpha"\n\ncmd:first-alpha' },
          { id: 'slice-b', dsl: 'slice "Beta"\n\nevt:first-beta' }
        ]
      })
    );

    await renderApp();

    await dispatchAndFlush(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const showOverviewItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Show Project Overview')
    ) as HTMLButtonElement | undefined;
    expect(showOverviewItem).toBeDefined();

    await dispatchAndFlush(() => {
      showOverviewItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForElement('.overview-slice-frame');

    const frameLabels = [...document.querySelectorAll('.overview-slice-frame-label')]
      .map((element) => element.textContent?.trim())
      .filter(Boolean);

    expect(document.querySelector('.slice-title')?.textContent?.trim()).not.toBe('Overview');
    expect(document.querySelectorAll('.overview-slice-frame')).toHaveLength(2);
    expect(frameLabels).toEqual(['Alpha', 'Beta']);
  });

  it('presents overview layout without waiting for a requestAnimationFrame measurement pass', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [
          {
            id: 'slice-a',
            dsl: [
              'slice "Add List"',
              '',
              'ui:create-list "Create List"',
              'data:',
              '  name: "Jake\'s Birthday"',
              '',
              'cmd:create-list "Create List"',
              '<- ui:create-list',
              '',
              'evt:list-created "List Created"',
              '<- cmd:create-list',
              '',
              'scenario "Add List"',
              'when:',
              '  cmd:create-list "Create List"',
              'then:',
              '  evt:list-created "List Created"'
            ].join('\n')
          },
          {
            id: 'slice-b',
            dsl: [
              'slice "Add Wish"',
              '',
              'rm:open-lists "Open Lists"',
              '',
              'cmd:add-wish "Add Wish"',
              '<- rm:open-lists',
              '',
              'evt:wish-added "Wish Added"',
              '<- cmd:add-wish',
              '',
              'scenario "Add Wish"',
              'when:',
              '  cmd:add-wish "Add Wish"',
              'then:',
              '  evt:wish-added "Wish Added"'
            ].join('\n')
          }
        ]
      })
    );

    const requestAnimationFrameQueue: FrameRequestCallback[] = [];
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      requestAnimationFrameQueue.push(callback);
      return requestAnimationFrameQueue.length;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((handle: number) => {
      requestAnimationFrameQueue[handle - 1] = () => undefined;
    }) as typeof window.cancelAnimationFrame;

    try {
      await renderApp();

      await dispatchAndFlush(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      });

      const showOverviewItem = (
        [...document.querySelectorAll('.command-palette-item')]
          .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Show Project Overview')
      ) as HTMLButtonElement | undefined;
      expect(showOverviewItem).toBeDefined();

      await dispatchAndFlush(() => {
        showOverviewItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(document.querySelector('.overview-slice-frame')).not.toBeNull();
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });

  it('renders overview slice labels with the same shared title styling class', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [
          { id: 'slice-a', dsl: 'slice "Alpha"\n\ncmd:first-alpha' },
          { id: 'slice-b', dsl: 'slice "Beta"\n\nevt:first-beta' }
        ]
      })
    );

    await renderApp();

    await dispatchAndFlush(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const showOverviewItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Show Project Overview')
    ) as HTMLButtonElement | undefined;
    expect(showOverviewItem).toBeDefined();

    await dispatchAndFlush(() => {
      showOverviewItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForElement('.overview-slice-frame-label');

    const firstLabel = document.querySelector('.overview-slice-frame-label');

    expect(firstLabel).not.toBeNull();
    expect(firstLabel?.classList.contains('slice-title')).toBe(true);
  });

  it('renders a one-slice overview with a single slice frame and without the global overview title', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [{ id: 'slice-a', dsl: 'slice "Solo"\n\ncmd:only-node' }]
      })
    );

    await renderApp();

    await dispatchAndFlush(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const showOverviewItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Show Project Overview')
    ) as HTMLButtonElement | undefined;
    expect(showOverviewItem).toBeDefined();

    await dispatchAndFlush(() => {
      showOverviewItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForElement('.overview-slice-frame');

    const frameLabels = [...document.querySelectorAll('.overview-slice-frame-label')]
      .map((element) => element.textContent?.trim())
      .filter(Boolean);

    expect(document.querySelector('.slice-title')?.textContent?.trim()).not.toBe('Overview');
    expect(document.querySelectorAll('.overview-slice-frame')).toHaveLength(1);
    expect(frameLabels).toEqual(['Solo']);
  });

  it('renders node aliases as display names in the canvas', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Aliases"\n\nrm:my-rm "My Read Model"\nui:my-ui "My UI"\n  <- rm:my-rm' }]
      })
    );

    await renderApp();

    const labels = [...document.querySelectorAll('.node .node-header span:last-child')]
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    expect(labels).toContain('My Read Model');
    expect(labels).toContain('My UI');
  });

  it('renders generic nodes without a type prefix and with generic styling class', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Generic"\n\ncheckout-screen\ncmd:place-order <- checkout-screen' }]
      })
    );

    await renderApp();

    const genericNode = document.querySelector('.node.generic');
    expect(genericNode).not.toBeNull();
    expect(genericNode?.querySelector('.node-prefix')).toBeNull();
    expect(genericNode?.querySelector('.node-header span:last-child')?.textContent?.trim()).toBe('checkout-screen');
  });

  it('highlights both connected nodes when hovering an edge', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Edge Hover"\n\ncmd:start\n\nevt:finish <- cmd:start' }]
      })
    );

    await renderApp();
    await waitForElement('.main .canvas-camera-world');

    const fromNode = document.querySelector('.node.cmd');
    const toNode = document.querySelector('.node.evt');
    const edgePath = document.querySelector('.edge-hover-target');
    expect(fromNode).not.toBeNull();
    expect(toNode).not.toBeNull();
    expect(edgePath).not.toBeNull();
    expect(fromNode?.classList.contains('related')).toBe(false);
    expect(toNode?.classList.contains('related')).toBe(false);

    await dispatchAndFlush(() => {
      edgePath?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    expect(fromNode?.classList.contains('related')).toBe(true);
    expect(toNode?.classList.contains('related')).toBe(true);

    await dispatchAndFlush(() => {
      edgePath?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    });

    expect(fromNode?.classList.contains('related')).toBe(false);
    expect(toNode?.classList.contains('related')).toBe(false);
  });

  it('renders a slice divider for --- boundaries in the DSL', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Split"\n\ncmd:first\n---\nevt:second <- cmd:first' }]
      })
    );

    await renderApp();
    await waitForElement('.main .canvas-camera-world');

    const divider = document.querySelector('.slice-divider');
    expect(divider).not.toBeNull();
  });

  it('renders stream lane headers for event streams', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: 'slice "Streams"\n\nevt:first-event\nstream: first\n\nevt:second-event\nstream: second\n\nrm:read-model\n  <- evt:first-event\n  <- evt:second-event'
        }]
      })
    );

    await renderApp();
    await waitForElement('.main .canvas-camera-world');

    const laneLabels = [...document.querySelectorAll('.lane-stream-label')]
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    expect(laneLabels).toContain('first');
    expect(laneLabels).toContain('second');
  });

  it('does not render a header for the default event stream', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: 'slice "Streams"\n\nevt:first-event\nstream: first\n\nevt:default-event\n\nrm:read-model\n  <- evt:first-event\n  <- evt:default-event'
        }]
      })
    );

    await renderApp();
    await waitForElement('.main .canvas-camera-world');

    const laneLabels = [...document.querySelectorAll('.lane-stream-label')]
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    expect(laneLabels).toContain('first');
    expect(laneLabels).not.toContain('default');
  });

  it('toggles and persists light/dark theme from header button', async () => {
    await renderApp();

    const toggle = document.querySelector('button[aria-label="Switch to light theme"]');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(toggle).not.toBeNull();

    await dispatchAndFlush(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('slicr.theme')).toBe('light');
    expect(document.querySelector('button[aria-label="Switch to dark theme"]')).not.toBeNull();
  });

  it('shows an Expand all action in the DSL toolbar', async () => {
    await renderApp();

    const expandAll = document.querySelector('button[aria-label="Expand all regions"]');
    expect(expandAll).not.toBeNull();
  });

  it('defaults diagram dev controls on and persists the flag on localhost', async () => {
    await renderApp();

    const resetButton = document.querySelector('button[aria-label="Reset diagram positions"]');
    expect(resetButton).not.toBeNull();
    expect(localStorage.getItem(RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY)).toBe('true');
  });

  it('hides diagram dev controls when the persisted flag is disabled', async () => {
    localStorage.setItem(RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY, 'false');

    await renderApp();

    const resetButton = document.querySelector('button[aria-label="Reset diagram positions"]');
    expect(resetButton).toBeNull();
  });

  it('uses dom-svg-camera renderer by default and persists renderer id', async () => {
    await renderApp();

    const canvasPanel = document.querySelector('.canvas-panel');
    expect(canvasPanel?.getAttribute('data-diagram-renderer')).toBe('dom-svg-camera');
    expect(localStorage.getItem(DIAGRAM_RENDERER_FLAG_STORAGE_KEY)).toBe('dom-svg-camera');
  });

  it('uses dom-svg-camera renderer when persisted renderer flag is enabled', async () => {
    localStorage.setItem(DIAGRAM_RENDERER_FLAG_STORAGE_KEY, 'dom-svg-camera');

    await renderApp();

    const canvasPanel = document.querySelector('.canvas-panel');
    expect(canvasPanel?.getAttribute('data-diagram-renderer')).toBe('dom-svg-camera');
  });

  it('still highlights editor lines when hovering nodes with drag-and-drop disabled', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\nevt:simple-event' }]
      })
    );
    localStorage.setItem(DRAG_AND_DROP_FLAG_STORAGE_KEY, 'false');

    await renderApp();
    await waitForElement('.main .canvas-camera-world');

    const node = document.querySelector('.node.evt') as HTMLElement | null;
    expect(node).not.toBeNull();
    expect(document.querySelector('.cm-node-highlight')).toBeNull();

    await dispatchAndFlush(() => {
      node?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    expect(document.querySelector('.cm-node-highlight')).not.toBeNull();
  });
});
