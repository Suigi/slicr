import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { DEFAULT_DSL } from './defaultDsl';
import { SLICES_STORAGE_KEY } from './sliceLibrary';
import { hydrateSliceProjection } from './sliceEventStore';

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

function readStoredLibrary() {
  const appStreamRaw = localStorage.getItem('slicr.es.v1.stream.app');
  const appEvents = appStreamRaw
    ? (JSON.parse(appStreamRaw) as Array<{ version?: number; type?: string; payload?: { projectId?: string; sliceId?: string; selectedSliceId?: string } }>)
    : [];
  const added = appEvents
    .filter((event) => event.type === 'slice-added-to-project' && event.payload?.projectId === 'default' && typeof event.payload?.sliceId === 'string')
    .sort((a, b) => (a.version ?? 0) - (b.version ?? 0));
  const sliceIds = [...new Set(added.map((event) => event.payload?.sliceId as string))];
  if (sliceIds.length === 0) {
    return null;
  }
  const selectedEvents = appEvents
    .filter((event): event is { version: number; payload: { selectedSliceId: string } } => (
      event.type === 'slice-selected'
      && event.payload?.projectId === 'default'
      && typeof event.version === 'number'
      && typeof event.payload?.selectedSliceId === 'string'
      && event.payload.selectedSliceId.length > 0
    ))
    .sort((a, b) => a.version - b.version);
  const selectedSliceId = selectedEvents[selectedEvents.length - 1]?.payload.selectedSliceId ?? sliceIds[0];
  return {
    selectedSliceId,
    slices: sliceIds.map((id) => ({ id, dsl: hydrateSliceProjection(id).dsl }))
  };
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

describe('App bootstrap and slice navigation interactions', () => {
  it('loads default DSL when storage is empty and persists it', () => {
    renderApp();

    const sliceTitle = document.querySelector('.slice-title');
    const defaultName = DEFAULT_DSL.match(/^\s*slice\s+"([^"]+)"/m)?.[1];
    const localPrefix = window.location.hostname === 'localhost' ? '[local] ' : '';

    expect(sliceTitle?.textContent).toBe(defaultName);
    expect(document.title).toBe(`${localPrefix}Slicer - ${defaultName}`);
    expect(localStorage.getItem('slicr.es.v1.stream.app')).not.toBeNull();
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

    openSliceMenu();
    expect(document.querySelectorAll('.slice-menu-item').length).toBe(2);
    expect(document.querySelector('.slice-title')?.textContent).toBe('Alpha');

    clickSliceMenuItem('Beta');
    const localPrefix = window.location.hostname === 'localhost' ? '[local] ' : '';

    expect(document.querySelector('.slice-title')?.textContent).toBe('Beta');
    expect(document.title).toBe(`${localPrefix}Slicer - Beta`);
    const streamRaw = localStorage.getItem('slicr.es.v1.stream.app');
    expect(streamRaw).not.toBeNull();
    const events = JSON.parse(streamRaw ?? '[]') as Array<{ type: string; payload?: { projectId?: string; selectedSliceId?: string } }>;
    expect(events.some((event) => event.type === 'slice-selected' && event.payload?.projectId === 'default' && event.payload?.selectedSliceId === 'b')).toBe(true);
  });

  it('switches to the next slice on Cmd/Ctrl+Shift+J', () => {
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

    expect(document.querySelector('.slice-title')?.textContent).toBe('Alpha');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', metaKey: true, shiftKey: true, bubbles: true }));
    });

    expect(document.querySelector('.slice-title')?.textContent).toBe('Beta');

    const streamRaw = localStorage.getItem('slicr.es.v1.stream.app');
    expect(streamRaw).not.toBeNull();
    const events = JSON.parse(streamRaw ?? '[]') as Array<{ type: string; payload?: { projectId?: string; selectedSliceId?: string } }>;
    expect(events.some((event) => event.type === 'slice-selected' && event.payload?.projectId === 'default' && event.payload?.selectedSliceId === 'b')).toBe(true);
  });

  it('switches to the previous slice on Cmd/Ctrl+Shift+K', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'b',
        slices: [
          { id: 'a', name: 'Alpha', dsl: 'slice "Alpha"\n\nrm:alpha' },
          { id: 'b', name: 'Beta', dsl: 'slice "Beta"\n\nrm:beta' }
        ]
      })
    );

    renderApp();

    expect(document.querySelector('.slice-title')?.textContent).toBe('Beta');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true, bubbles: true }));
    });

    expect(document.querySelector('.slice-title')?.textContent).toBe('Alpha');

    const streamRaw = localStorage.getItem('slicr.es.v1.stream.app');
    expect(streamRaw).not.toBeNull();
    const events = JSON.parse(streamRaw ?? '[]') as Array<{ type: string; payload?: { projectId?: string; selectedSliceId?: string } }>;
    expect(events.some((event) => event.type === 'slice-selected' && event.payload?.projectId === 'default' && event.payload?.selectedSliceId === 'a')).toBe(true);
  });

  it('does not change slice on Cmd/Ctrl+Shift+J when already on the last slice', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'b',
        slices: [
          { id: 'a', name: 'Alpha', dsl: 'slice "Alpha"\n\nrm:alpha' },
          { id: 'b', name: 'Beta', dsl: 'slice "Beta"\n\nrm:beta' }
        ]
      })
    );

    renderApp();

    expect(document.querySelector('.slice-title')?.textContent).toBe('Beta');
    const beforeRaw = localStorage.getItem('slicr.es.v1.stream.app');
    const beforeEvents = JSON.parse(beforeRaw ?? '[]') as Array<{ type: string }>;
    const beforeSelectedCount = beforeEvents.filter((event) => event.type === 'slice-selected').length;

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, shiftKey: true, bubbles: true }));
    });

    expect(document.querySelector('.slice-title')?.textContent).toBe('Beta');
    const afterRaw = localStorage.getItem('slicr.es.v1.stream.app');
    const afterEvents = JSON.parse(afterRaw ?? '[]') as Array<{ type: string }>;
    const afterSelectedCount = afterEvents.filter((event) => event.type === 'slice-selected').length;
    expect(afterSelectedCount).toBe(beforeSelectedCount);
  });

  it('does not change slice on Cmd/Ctrl+Shift+K when already on the first slice', () => {
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

    expect(document.querySelector('.slice-title')?.textContent).toBe('Alpha');
    const beforeRaw = localStorage.getItem('slicr.es.v1.stream.app');
    const beforeEvents = JSON.parse(beforeRaw ?? '[]') as Array<{ type: string }>;
    const beforeSelectedCount = beforeEvents.filter((event) => event.type === 'slice-selected').length;

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, shiftKey: true, bubbles: true }));
    });

    expect(document.querySelector('.slice-title')?.textContent).toBe('Alpha');
    const afterRaw = localStorage.getItem('slicr.es.v1.stream.app');
    const afterEvents = JSON.parse(afterRaw ?? '[]') as Array<{ type: string }>;
    const afterSelectedCount = afterEvents.filter((event) => event.type === 'slice-selected').length;
    expect(afterSelectedCount).toBe(beforeSelectedCount);
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

    const menuToggle = document.querySelector('button[aria-label="Select slice"]') as HTMLButtonElement | null;
    expect(menuToggle?.textContent).toContain('Fresh Name');
  });

  it('creates and selects a new slice from header button', () => {
    renderApp();

    const newButton = document.querySelector('button[aria-label="Create new slice"]') as HTMLButtonElement | null;
    expect(newButton).not.toBeNull();
    openSliceMenu();
    expect(document.querySelectorAll('.slice-menu-item').length).toBe(1);

    act(() => {
      newButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const menuToggle = document.querySelector('button[aria-label="Select slice"]') as HTMLButtonElement | null;
    expect(menuToggle?.textContent).toContain('Untitled');
    openSliceMenu();
    expect(document.querySelectorAll('.slice-menu-item').length).toBe(2);
    const stored = readStoredLibrary();
    expect(stored).not.toBeNull();
    const selected = stored?.slices.find((slice) => slice.id === stored.selectedSliceId);
    expect(selected?.dsl).toContain('slice "Untitled"');
    const streamRaw = localStorage.getItem(`slicr.es.v1.stream.${stored?.selectedSliceId ?? ''}`);
    expect(streamRaw).not.toBeNull();
    const events = JSON.parse(streamRaw ?? '[]') as Array<{ type: string }>;
    expect(events.some((event) => event.type === 'slice-created')).toBe(true);
    expect(events.some((event) => event.type === 'text-edited')).toBe(false);
  });
});
