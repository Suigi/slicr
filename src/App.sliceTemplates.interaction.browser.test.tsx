import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
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

describe('App slice template interactions', () => {
  it('applies template in create-new mode by creating and selecting a new slice', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const applyTemplateItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Apply Slice Template...')
    ) as HTMLButtonElement | undefined;
    expect(applyTemplateItem).toBeDefined();
    act(() => {
      applyTemplateItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const apply = [...document.querySelectorAll('.project-modal-button.primary')]
      .find((button) => button.textContent?.trim() === 'Apply Template') as HTMLButtonElement | undefined;
    expect(apply).toBeDefined();
    act(() => {
      apply?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const stored = readStoredLibrary();
    expect(stored).not.toBeNull();
    expect(stored?.slices.length).toBe(2);
    const selected = stored?.slices.find((slice) => slice.id === stored.selectedSliceId);
    expect(selected?.dsl.startsWith('slice "Payment Fulfillment"')).toBe(true);
    expect(selected?.dsl.includes('ui:checkout-form')).toBe(true);
  });

  it('applies template in add-current mode by inserting text into current slice', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const applyTemplateItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Apply Slice Template...')
    ) as HTMLButtonElement | undefined;
    expect(applyTemplateItem).toBeDefined();
    act(() => {
      applyTemplateItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const addCurrent = document.querySelector('#slice-template-target-add-current') as HTMLInputElement | null;
    expect(addCurrent).not.toBeNull();
    act(() => {
      addCurrent?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const apply = [...document.querySelectorAll('.project-modal-button.primary')]
      .find((button) => button.textContent?.trim() === 'Apply Template') as HTMLButtonElement | undefined;
    expect(apply).toBeDefined();
    act(() => {
      apply?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const stored = readStoredLibrary();
    expect(stored).not.toBeNull();
    expect(stored?.slices.length).toBe(1);
    const selected = stored?.slices.find((slice) => slice.id === stored?.selectedSliceId);
    expect(selected?.dsl.includes('ui:checkout-form')).toBe(true);
    expect((selected?.dsl.match(/^\s*slice\s+"/gm) ?? []).length).toBe(1);
  });
});
