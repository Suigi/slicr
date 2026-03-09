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
}

describe('App interactions', () => {
  it('toggles the documentation panel from the header', () => {
    renderApp();

    const docsToggle = document.querySelector('button[aria-label="Toggle documentation panel"]');
    expect(docsToggle).not.toBeNull();
    expect(document.querySelector('.docs-panel-shell')).toBeNull();

    act(() => {
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

  it('hides the editor and analysis panels in overview mode while keeping the main canvas mounted', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [{ id: 'slice-a', dsl: 'slice "Overview"\n\nevt:selected-node' }]
      })
    );

    renderApp();

    const editorToggle = document.querySelector('button[aria-label="Toggle DSL editor"]');
    const node = document.querySelector('.node.evt');
    const editorPanel = document.querySelector('.editor-panel');

    expect(editorToggle).not.toBeNull();
    expect(node).not.toBeNull();
    expect(editorPanel?.classList.contains('open')).toBe(false);
    expect(editorPanel?.classList.contains('hidden')).toBe(false);
    expect(document.querySelector('.cross-slice-usage-panel')).toBeNull();

    act(() => {
      editorToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(editorPanel?.classList.contains('open')).toBe(true);
    expect(document.querySelector('.cross-slice-usage-panel')).not.toBeNull();
    expect(document.querySelector('.main .canvas-panel')).not.toBeNull();

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

    expect(editorPanel?.classList.contains('open')).toBe(false);
    expect(editorPanel?.classList.contains('hidden')).toBe(true);
    expect(document.querySelector('.cross-slice-usage-panel')).toBeNull();
    expect(document.querySelector('.main .canvas-panel')).not.toBeNull();
  });

  it('restores the editor and analysis panels after exiting overview mode', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [{ id: 'slice-a', dsl: 'slice "Overview"\n\nevt:selected-node' }]
      })
    );

    renderApp();

    const editorToggle = document.querySelector('button[aria-label="Toggle DSL editor"]');
    const node = document.querySelector('.node.evt');
    const editorPanel = document.querySelector('.editor-panel');

    act(() => {
      editorToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(editorPanel?.classList.contains('open')).toBe(true);
    expect(editorPanel?.classList.contains('hidden')).toBe(false);
    expect(document.querySelector('.cross-slice-usage-panel')).not.toBeNull();

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

    expect(editorPanel?.classList.contains('open')).toBe(false);
    expect(editorPanel?.classList.contains('hidden')).toBe(true);
    expect(document.querySelector('.cross-slice-usage-panel')).toBeNull();

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

    expect(editorPanel?.classList.contains('open')).toBe(true);
    expect(editorPanel?.classList.contains('hidden')).toBe(false);
    expect(document.querySelector('.cross-slice-usage-panel')).not.toBeNull();
    expect(document.querySelector('.main .canvas-panel')).not.toBeNull();
  });

  it('keeps overview node clicks in-canvas without reopening hidden panels', () => {
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

    const overviewNode = [...document.querySelectorAll('.node')]
      .find((element) => element.textContent?.includes('second-node')) as HTMLElement | undefined;
    const editorPanel = document.querySelector('.editor-panel');
    expect(overviewNode).toBeDefined();
    expect(editorPanel?.classList.contains('open')).toBe(false);
    expect(document.querySelector('.cross-slice-usage-panel')).toBeNull();

    act(() => {
      overviewNode?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(overviewNode?.classList.contains('selected')).toBe(true);
    expect(editorPanel?.classList.contains('open')).toBe(false);
    expect(document.querySelector('.cross-slice-usage-panel')).toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    expect(
      [...document.querySelectorAll('.command-palette-item')]
        .some((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Hide Project Overview')
    ).toBe(true);
  });

  it('renders one slice frame per visible slice in overview mode instead of a single global title', () => {
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

    const frameLabels = [...document.querySelectorAll('.overview-slice-frame-label')]
      .map((element) => element.textContent?.trim())
      .filter(Boolean);

    expect(document.querySelector('.slice-title')?.textContent?.trim()).not.toBe('Overview');
    expect(document.querySelectorAll('.overview-slice-frame')).toHaveLength(2);
    expect(frameLabels).toEqual(['Alpha', 'Beta']);
  });

  it('renders overview slice labels with the same shared title styling class', () => {
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

    const firstLabel = document.querySelector('.overview-slice-frame-label');

    expect(firstLabel).not.toBeNull();
    expect(firstLabel?.classList.contains('slice-title')).toBe(true);
  });

  it('renders a one-slice overview with a single slice frame and without the global overview title', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [{ id: 'slice-a', dsl: 'slice "Solo"\n\ncmd:only-node' }]
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

    const frameLabels = [...document.querySelectorAll('.overview-slice-frame-label')]
      .map((element) => element.textContent?.trim())
      .filter(Boolean);

    expect(document.querySelector('.slice-title')?.textContent?.trim()).not.toBe('Overview');
    expect(document.querySelectorAll('.overview-slice-frame')).toHaveLength(1);
    expect(frameLabels).toEqual(['Solo']);
  });

  it('renders node aliases as display names in the canvas', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Aliases"\n\nrm:my-rm "My Read Model"\nui:my-ui "My UI"\n  <- rm:my-rm' }]
      })
    );

    renderApp();

    const labels = [...document.querySelectorAll('.node .node-header span:last-child')]
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    expect(labels).toContain('My Read Model');
    expect(labels).toContain('My UI');
  });

  it('renders generic nodes without a type prefix and with generic styling class', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Generic"\n\ncheckout-screen\ncmd:place-order <- checkout-screen' }]
      })
    );

    renderApp();

    const genericNode = document.querySelector('.node.generic');
    expect(genericNode).not.toBeNull();
    expect(genericNode?.querySelector('.node-prefix')).toBeNull();
    expect(genericNode?.querySelector('.node-header span:last-child')?.textContent?.trim()).toBe('checkout-screen');
  });

  it('highlights both connected nodes when hovering an edge', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Edge Hover"\n\ncmd:start\n\nevt:finish <- cmd:start' }]
      })
    );

    renderApp();

    const fromNode = document.querySelector('.node.cmd');
    const toNode = document.querySelector('.node.evt');
    const edgePath = document.querySelector('.edge-hover-target');
    expect(fromNode).not.toBeNull();
    expect(toNode).not.toBeNull();
    expect(edgePath).not.toBeNull();
    expect(fromNode?.classList.contains('related')).toBe(false);
    expect(toNode?.classList.contains('related')).toBe(false);

    act(() => {
      edgePath?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    expect(fromNode?.classList.contains('related')).toBe(true);
    expect(toNode?.classList.contains('related')).toBe(true);

    act(() => {
      edgePath?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    });

    expect(fromNode?.classList.contains('related')).toBe(false);
    expect(toNode?.classList.contains('related')).toBe(false);
  });

  it('renders a slice divider for --- boundaries in the DSL', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Split"\n\ncmd:first\n---\nevt:second <- cmd:first' }]
      })
    );

    renderApp();

    const divider = document.querySelector('.slice-divider');
    expect(divider).not.toBeNull();
  });

  it('renders stream lane headers for event streams', () => {
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

    renderApp();

    const laneLabels = [...document.querySelectorAll('.lane-stream-label')]
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    expect(laneLabels).toContain('first');
    expect(laneLabels).toContain('second');
  });

  it('does not render a header for the default event stream', () => {
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

    renderApp();

    const laneLabels = [...document.querySelectorAll('.lane-stream-label')]
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    expect(laneLabels).toContain('first');
    expect(laneLabels).not.toContain('default');
  });

  it('toggles and persists light/dark theme from header button', () => {
    renderApp();

    const toggle = document.querySelector('button[aria-label="Switch to light theme"]');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(toggle).not.toBeNull();

    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('slicr.theme')).toBe('light');
    expect(document.querySelector('button[aria-label="Switch to dark theme"]')).not.toBeNull();
  });

  it('shows an Expand all action in the DSL toolbar', () => {
    renderApp();

    const expandAll = document.querySelector('button[aria-label="Expand all regions"]');
    expect(expandAll).not.toBeNull();
  });

  it('defaults diagram dev controls on and persists the flag on localhost', () => {
    renderApp();

    const resetButton = document.querySelector('button[aria-label="Reset diagram positions"]');
    expect(resetButton).not.toBeNull();
    expect(localStorage.getItem(RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY)).toBe('true');
  });

  it('hides diagram dev controls when the persisted flag is disabled', () => {
    localStorage.setItem(RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY, 'false');

    renderApp();

    const resetButton = document.querySelector('button[aria-label="Reset diagram positions"]');
    expect(resetButton).toBeNull();
  });

  it('uses dom-svg-camera renderer by default and persists renderer id', () => {
    renderApp();

    const canvasPanel = document.querySelector('.canvas-panel');
    expect(canvasPanel?.getAttribute('data-diagram-renderer')).toBe('dom-svg-camera');
    expect(localStorage.getItem(DIAGRAM_RENDERER_FLAG_STORAGE_KEY)).toBe('dom-svg-camera');
  });

  it('uses dom-svg-camera renderer when persisted renderer flag is enabled', () => {
    localStorage.setItem(DIAGRAM_RENDERER_FLAG_STORAGE_KEY, 'dom-svg-camera');

    renderApp();

    const canvasPanel = document.querySelector('.canvas-panel');
    expect(canvasPanel?.getAttribute('data-diagram-renderer')).toBe('dom-svg-camera');
  });

  it('still highlights editor lines when hovering nodes with drag-and-drop disabled', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\nevt:simple-event' }]
      })
    );
    localStorage.setItem(DRAG_AND_DROP_FLAG_STORAGE_KEY, 'false');

    renderApp();

    const node = document.querySelector('.node.evt') as HTMLElement | null;
    expect(node).not.toBeNull();
    expect(document.querySelector('.cm-node-highlight')).toBeNull();

    act(() => {
      node?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    expect(document.querySelector('.cm-node-highlight')).not.toBeNull();
  });
});
