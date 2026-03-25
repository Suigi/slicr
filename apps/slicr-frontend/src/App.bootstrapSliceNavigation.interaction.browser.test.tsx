import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import App from './App';
import { DEFAULT_DSL } from './defaultDsl';
import { SLICES_STORAGE_KEY } from './sliceLibrary';
import { hydrateSliceProjection } from './sliceEventStore';

afterEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

function renderApp() {
  return render(<App />);
}

async function flushUi() {
  await Promise.resolve();
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

async function waitForSliceTitle(text?: string) {
  await expect.poll(() => {
    const title = document.querySelector('.slice-title')?.textContent?.trim();
    return text ? title === text : Boolean(title);
  }).toBe(true);
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

async function openSliceMenu() {
  if (document.querySelector('.slice-menu-panel')) {
    return;
  }
  await page.getByRole('button', { name: 'Select slice' }).click();
  await expect.element(page.getByRole('menu', { name: 'Slice list' })).toBeVisible();
}

async function clickSliceMenuItem(label: string) {
  await page.getByRole('menuitemradio', { name: label }).click();
}

describe('App bootstrap and slice navigation interactions', () => {
  it('loads default DSL when storage is empty and persists it', async () => {
    renderApp();
    await waitForSliceTitle();

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

  it('loads legacy DSL from localStorage on first render', async () => {
    const persistedDsl = `slice "Persisted Slice"

rm:persisted-view`;
    localStorage.setItem('slicr.dsl', persistedDsl);

    renderApp();
    await waitForSliceTitle('Persisted Slice');

    const sliceTitle = document.querySelector('.slice-title');
    expect(sliceTitle?.textContent).toBe('Persisted Slice');
  });

  it('switches between saved slices via header dropdown', async () => {
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
    await waitForSliceTitle('Alpha');

    await openSliceMenu();
    expect(document.querySelectorAll('.slice-menu-item').length).toBe(2);
    expect(document.querySelector('.slice-title')?.textContent).toBe('Alpha');

    await clickSliceMenuItem('Beta');
    await waitForSliceTitle('Beta');
    const localPrefix = window.location.hostname === 'localhost' ? '[local] ' : '';

    expect(document.querySelector('.slice-title')?.textContent).toBe('Beta');
    expect(document.title).toBe(`${localPrefix}Slicer - Beta`);
    const streamRaw = localStorage.getItem('slicr.es.v1.stream.app');
    expect(streamRaw).not.toBeNull();
    const events = JSON.parse(streamRaw ?? '[]') as Array<{ type: string; payload?: { projectId?: string; selectedSliceId?: string } }>;
    expect(events.some((event) => event.type === 'slice-selected' && event.payload?.projectId === 'default' && event.payload?.selectedSliceId === 'b')).toBe(true);
  });

  it('switches to the next slice on Cmd/Ctrl+Shift+J', async () => {
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
    await waitForSliceTitle('Alpha');

    expect(document.querySelector('.slice-title')?.textContent).toBe('Alpha');

    await userEvent.keyboard('{Control>}{Shift>}j{/Shift}{/Control}');
    await waitForSliceTitle('Beta');

    expect(document.querySelector('.slice-title')?.textContent).toBe('Beta');

    const streamRaw = localStorage.getItem('slicr.es.v1.stream.app');
    expect(streamRaw).not.toBeNull();
    const events = JSON.parse(streamRaw ?? '[]') as Array<{ type: string; payload?: { projectId?: string; selectedSliceId?: string } }>;
    expect(events.some((event) => event.type === 'slice-selected' && event.payload?.projectId === 'default' && event.payload?.selectedSliceId === 'b')).toBe(true);
  });

  it('switches to the previous slice on Cmd/Ctrl+Shift+K', async () => {
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
    await waitForSliceTitle('Beta');

    expect(document.querySelector('.slice-title')?.textContent).toBe('Beta');

    await userEvent.keyboard('{Control>}{Shift>}k{/Shift}{/Control}');
    await waitForSliceTitle('Alpha');

    expect(document.querySelector('.slice-title')?.textContent).toBe('Alpha');

    const streamRaw = localStorage.getItem('slicr.es.v1.stream.app');
    expect(streamRaw).not.toBeNull();
    const events = JSON.parse(streamRaw ?? '[]') as Array<{ type: string; payload?: { projectId?: string; selectedSliceId?: string } }>;
    expect(events.some((event) => event.type === 'slice-selected' && event.payload?.projectId === 'default' && event.payload?.selectedSliceId === 'a')).toBe(true);
  });

  it('does not change slice on Cmd/Ctrl+Shift+J when already on the last slice', async () => {
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
    await waitForSliceTitle('Beta');

    expect(document.querySelector('.slice-title')?.textContent).toBe('Beta');
    const beforeRaw = localStorage.getItem('slicr.es.v1.stream.app');
    const beforeEvents = JSON.parse(beforeRaw ?? '[]') as Array<{ type: string }>;
    const beforeSelectedCount = beforeEvents.filter((event) => event.type === 'slice-selected').length;

    await userEvent.keyboard('{Control>}{Shift>}j{/Shift}{/Control}');

    expect(document.querySelector('.slice-title')?.textContent).toBe('Beta');
    const afterRaw = localStorage.getItem('slicr.es.v1.stream.app');
    const afterEvents = JSON.parse(afterRaw ?? '[]') as Array<{ type: string }>;
    const afterSelectedCount = afterEvents.filter((event) => event.type === 'slice-selected').length;
    expect(afterSelectedCount).toBe(beforeSelectedCount);
  });

  it('does not change slice on Cmd/Ctrl+Shift+K when already on the first slice', async () => {
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
    await waitForSliceTitle('Alpha');

    expect(document.querySelector('.slice-title')?.textContent).toBe('Alpha');
    const beforeRaw = localStorage.getItem('slicr.es.v1.stream.app');
    const beforeEvents = JSON.parse(beforeRaw ?? '[]') as Array<{ type: string }>;
    const beforeSelectedCount = beforeEvents.filter((event) => event.type === 'slice-selected').length;

    await userEvent.keyboard('{Control>}{Shift>}k{/Shift}{/Control}');

    expect(document.querySelector('.slice-title')?.textContent).toBe('Alpha');
    const afterRaw = localStorage.getItem('slicr.es.v1.stream.app');
    const afterEvents = JSON.parse(afterRaw ?? '[]') as Array<{ type: string }>;
    const afterSelectedCount = afterEvents.filter((event) => event.type === 'slice-selected').length;
    expect(afterSelectedCount).toBe(beforeSelectedCount);
  });

  it('derives dropdown labels from DSL, ignoring stale stored names', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', name: 'Stale Name', dsl: 'slice "Fresh Name"\n\nrm:fresh' }]
      })
    );

    renderApp();
    await expect.poll(() => document.querySelector('button[aria-label="Select slice"]')?.textContent?.includes('Fresh Name') ?? false).toBe(true);
  });

  it('creates and selects a new slice from header button', async () => {
    renderApp();

    await openSliceMenu();
    expect(document.querySelectorAll('.slice-menu-item').length).toBe(1);

    const newButton = document.querySelector('button[aria-label="Create new slice"]') as HTMLButtonElement | null;
    expect(newButton).not.toBeNull();
    newButton?.click();
    await flushUi();
    await expect.poll(() => {
      const stored = readStoredLibrary();
      const selected = stored?.slices.find((slice) => slice.id === stored.selectedSliceId);
      return selected?.dsl.includes('slice "Untitled"') ?? false;
    }).toBe(true);
    await expect.poll(() => document.querySelector('button[aria-label="Select slice"]')?.textContent?.includes('Untitled') ?? false).toBe(true);

    await openSliceMenu();
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
