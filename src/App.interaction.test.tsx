// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import App from './App';
import { DEFAULT_DSL } from './defaultDsl';
import { SLICES_STORAGE_KEY } from './sliceLibrary';

let root: ReactDOM.Root | null = null;
let host: HTMLDivElement | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = undefined;
});

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

function readStoredLibrary() {
  const raw = localStorage.getItem(SLICES_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as { selectedSliceId: string; slices: Array<{ id: string; dsl: string }> }) : null;
}

describe('App interactions', () => {
  it('loads default DSL when storage is empty and persists it', () => {
    renderApp();

    const sliceTitle = document.querySelector('.slice-title');
    const defaultName = DEFAULT_DSL.match(/^\s*slice\s+"([^"]+)"/m)?.[1];

    expect(sliceTitle?.textContent).toBe(defaultName);
    expect(document.title).toBe(`Slicer - ${defaultName}`);
    expect(localStorage.getItem(SLICES_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem('slicr.dsl')).toBeNull();
    const stored = readStoredLibrary();
    expect(stored?.slices[0]?.dsl).toBe(DEFAULT_DSL);
  });

  it('loads legacy DSL from localStorage on first render', () => {
    const persistedDsl = `slice "Persisted Slice"

rm:persisted-view`;
    localStorage.setItem('slicr.dsl', persistedDsl);

    renderApp();

    const sliceTitle = document.querySelector('.slice-title');
    expect(sliceTitle?.textContent).toBe('Persisted Slice');
  });

  it('switches between saved slices via header dropdown', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          { id: 'a', name: 'Alpha', dsl: 'slice "Alpha"\n\nrm:alpha' },
          { id: 'b', name: 'Beta', dsl: 'slice "Beta"\n\nrm:beta' }
        ]
      })
    );

    renderApp();

    const select = document.querySelector('select[aria-label="Select slice"]') as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    expect(select?.options.length).toBe(2);
    expect(document.querySelector('.slice-title')?.textContent).toBe('Alpha');

    act(() => {
      if (select) {
        select.value = 'b';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(document.querySelector('.slice-title')?.textContent).toBe('Beta');
    expect(document.title).toBe('Slicer - Beta');
  });

  it('derives dropdown labels from DSL, ignoring stale stored names', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', name: 'Stale Name', dsl: 'slice "Fresh Name"\n\nrm:fresh' }]
      })
    );

    renderApp();

    const select = document.querySelector('select[aria-label="Select slice"]') as HTMLSelectElement | null;
    expect(select?.selectedOptions[0]?.textContent).toBe('Fresh Name');
  });

  it('creates and selects a new slice from header button', () => {
    renderApp();

    const select = document.querySelector('select[aria-label="Select slice"]') as HTMLSelectElement | null;
    const newButton = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'New');
    expect(select).not.toBeNull();
    expect(newButton).not.toBeUndefined();
    expect(select?.options.length).toBe(1);

    act(() => {
      newButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(select?.options.length).toBe(2);
    expect(select?.selectedOptions[0]?.textContent).toBe('Untitled');
    const stored = readStoredLibrary();
    expect(stored).not.toBeNull();
    const selected = stored?.slices.find((slice) => slice.id === stored.selectedSliceId);
    expect(selected?.dsl).toContain('slice "Untitled"');
  });

  it('opens and closes the editor panel via toggle and outside click', () => {
    renderApp();

    const toggle = document.querySelector('button[aria-label="Toggle DSL editor"]');
    const panel = document.querySelector('.editor-panel');

    expect(toggle).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(panel?.classList.contains('open')).toBe(false);

    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(panel?.classList.contains('open')).toBe(true);

    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(panel?.classList.contains('open')).toBe(false);
  });

  it('keeps the panel open when pointerdown happens inside the editor', () => {
    renderApp();

    const toggle = document.querySelector('button[aria-label="Toggle DSL editor"]');
    const panel = document.querySelector('.editor-panel');
    const editor = document.querySelector('.dsl-editor');

    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(panel?.classList.contains('open')).toBe(true);

    act(() => {
      editor?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(panel?.classList.contains('open')).toBe(true);
  });

  it('does not show unresolved dependency warnings in the bottom error bar', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Warnings"\n\nrm:orders <- evt:missing' }]
      })
    );

    renderApp();

    const errorBar = document.querySelector('.error-bar');
    expect(errorBar).toBeNull();
  });

  it('shows a warning-highlighted gutter cell for unresolved dependencies', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Warnings"\n\nrm:orders <- evt:missing' }]
      })
    );

    renderApp();

    const warningCell = document.querySelector('.cm-foldGutter .cm-gutterElement.cm-warning-line');
    expect(warningCell).not.toBeNull();
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
});
