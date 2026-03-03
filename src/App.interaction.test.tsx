// @vitest-environment jsdom

import { StrictMode, act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { DEFAULT_DSL } from './defaultDsl';
import {
  DIAGRAM_RENDERER_FLAG_STORAGE_KEY,
  DRAG_AND_DROP_FLAG_STORAGE_KEY,
  RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY
} from './domain/runtimeFlags';
import { SLICES_LAYOUT_STORAGE_KEY, SLICES_STORAGE_KEY } from './sliceLibrary';
import { hydrateSliceProjection } from './sliceEventStore';
import * as parseDslModule from './domain/parseDsl';

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

function renderAppStrict() {
  host = document.createElement('div');
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

function setSingleEventSlice(dsl = 'slice "A"\n\nevt:simple-event') {
  localStorage.setItem(
    SLICES_STORAGE_KEY,
    JSON.stringify({
      selectedSliceId: 'a',
      slices: [{ id: 'a', dsl }]
    })
  );
}

function openRenderModeMenu() {
  const menuToggle = document.querySelector('button[aria-label="Select render mode"]') as HTMLButtonElement | null;
  expect(menuToggle).not.toBeNull();
  act(() => {
    menuToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return menuToggle;
}

function clickResetPositionsButton() {
  const resetButton = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Reset positions'));
  expect(resetButton).toBeDefined();
  act(() => {
    resetButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function ensureProjectRailOpen() {
  const existingRail = document.querySelector('.project-rail') as HTMLElement | null;
  if (existingRail && !existingRail.classList.contains('hidden')) {
    return existingRail;
  }
  const railToggle = document.querySelector('button[aria-label="Toggle project rail"]') as HTMLButtonElement | null;
  expect(railToggle).not.toBeNull();
  act(() => {
    railToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const rail = document.querySelector('.project-rail') as HTMLElement | null;
  expect(rail).not.toBeNull();
  expect(rail?.classList.contains('hidden')).toBe(false);
  return rail as HTMLElement;
}

describe('App interactions', () => {
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

  it('parses a selected slice only once on initial render', () => {
    setSingleEventSlice('slice "A"\n\nevt:a');
    const parseSpy = vi.spyOn(parseDslModule, 'parseDsl');

    renderApp();

    expect(parseSpy).toHaveBeenCalledTimes(1);
    parseSpy.mockRestore();
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

  it('renders a project rail with all slices from the current project', () => {
    localStorage.setItem(
      'slicr.es.v1.stream.app',
      JSON.stringify([
        {
          id: 'p-1',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'project-created',
          payload: { projectId: 'project-a', name: 'Project A' }
        },
        {
          id: 'p-2',
          version: 2,
          at: '2026-01-01T00:00:02.000Z',
          type: 'project-created',
          payload: { projectId: 'project-b', name: 'Project B' }
        },
        {
          id: 'p-3',
          version: 3,
          at: '2026-01-01T00:00:03.000Z',
          type: 'project-selected',
          payload: { projectId: 'project-a' }
        },
        {
          id: 'p-4',
          version: 4,
          at: '2026-01-01T00:00:04.000Z',
          type: 'slice-added-to-project',
          payload: { projectId: 'project-a', sliceId: 'slice-a1' }
        },
        {
          id: 'p-5',
          version: 5,
          at: '2026-01-01T00:00:05.000Z',
          type: 'slice-added-to-project',
          payload: { projectId: 'project-a', sliceId: 'slice-a2' }
        },
        {
          id: 'p-6',
          version: 6,
          at: '2026-01-01T00:00:06.000Z',
          type: 'slice-selected',
          payload: { projectId: 'project-a', selectedSliceId: 'slice-a1' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a1',
      JSON.stringify([
        {
          id: 'a1-1',
          sliceId: 'slice-a1',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Alpha One"\n\nrm:a1' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a2',
      JSON.stringify([
        {
          id: 'a2-1',
          sliceId: 'slice-a2',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Alpha Two"\n\nrm:a2' }
        }
      ])
    );

    renderApp();

    ensureProjectRailOpen();
    const items = [...document.querySelectorAll('.project-rail-slice-item')].map((el) => el.textContent?.trim());
    expect(items).toEqual(['Alpha One', 'Alpha Two']);
  });

  it('toggles project rail visibility from header hamburger button', () => {
    renderApp();

    expect(document.querySelector('.project-rail')?.classList.contains('hidden')).toBe(true);
    const railToggle = document.querySelector('button[aria-label="Toggle project rail"]') as HTMLButtonElement | null;
    expect(railToggle).not.toBeNull();

    act(() => {
      railToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.querySelector('.project-rail')?.classList.contains('hidden')).toBe(false);

    act(() => {
      railToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.querySelector('.project-rail')?.classList.contains('hidden')).toBe(true);
  });

  it('switches project from a dropdown at the top of the project rail', () => {
    localStorage.setItem(
      'slicr.es.v1.stream.app',
      JSON.stringify([
        {
          id: 'p-1',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'project-created',
          payload: { projectId: 'project-a', name: 'Project A' }
        },
        {
          id: 'p-2',
          version: 2,
          at: '2026-01-01T00:00:02.000Z',
          type: 'project-created',
          payload: { projectId: 'project-b', name: 'Project B' }
        },
        {
          id: 'p-3',
          version: 3,
          at: '2026-01-01T00:00:03.000Z',
          type: 'project-selected',
          payload: { projectId: 'project-a' }
        },
        {
          id: 'p-4',
          version: 4,
          at: '2026-01-01T00:00:04.000Z',
          type: 'slice-added-to-project',
          payload: { projectId: 'project-a', sliceId: 'slice-a1' }
        },
        {
          id: 'p-5',
          version: 5,
          at: '2026-01-01T00:00:05.000Z',
          type: 'slice-added-to-project',
          payload: { projectId: 'project-b', sliceId: 'slice-b1' }
        },
        {
          id: 'p-6',
          version: 6,
          at: '2026-01-01T00:00:06.000Z',
          type: 'slice-selected',
          payload: { projectId: 'project-a', selectedSliceId: 'slice-a1' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a1',
      JSON.stringify([
        {
          id: 'a1-1',
          sliceId: 'slice-a1',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Alpha One"\n\nrm:a1' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-b1',
      JSON.stringify([
        {
          id: 'b1-1',
          sliceId: 'slice-b1',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Beta One"\n\nrm:b1' }
        }
      ])
    );

    renderApp();

    const rail = ensureProjectRailOpen();

    const projectToggle = rail?.querySelector('button[aria-label="Select project"]') as HTMLButtonElement | null;
    expect(projectToggle).not.toBeNull();
    act(() => {
      projectToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const projectBItem = [...(rail?.querySelectorAll('.project-menu-item') ?? [])]
      .find((button) => button.textContent?.includes('Project B')) as HTMLButtonElement | undefined;
    expect(projectBItem).toBeDefined();
    act(() => {
      projectBItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const items = [...document.querySelectorAll('.project-rail-slice-item')].map((el) => el.textContent?.trim());
    expect(items).toEqual(['Beta One']);
    expect(document.querySelector('.slice-title')?.textContent).toBe('Beta One');
  });

  it('creates a project from the rail dropdown and appends a project-created event', () => {
    renderApp();
    const rail = ensureProjectRailOpen();

    const projectToggle = rail?.querySelector('button[aria-label="Select project"]') as HTMLButtonElement | null;
    expect(projectToggle).not.toBeNull();
    act(() => {
      projectToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createProjectItem = [...(rail?.querySelectorAll('.project-menu-item') ?? [])]
      .find((button) => button.textContent?.includes('Create Project')) as HTMLButtonElement | undefined;
    expect(createProjectItem).toBeDefined();
    act(() => {
      createProjectItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const modal = document.querySelector('.project-modal');
    expect(modal).not.toBeNull();
    const input = document.querySelector('#project-name-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    act(() => {
      if (input) {
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(input, 'Payments');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    const createButton = [...document.querySelectorAll('.project-modal-button')]
      .find((button) => button.textContent?.trim() === 'Create') as HTMLButtonElement | undefined;
    expect(createButton).toBeDefined();
    act(() => {
      createButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const appStreamRaw = localStorage.getItem('slicr.es.v1.stream.app');
    expect(appStreamRaw).not.toBeNull();
    const appEvents = JSON.parse(appStreamRaw ?? '[]') as Array<{ type?: string; payload?: { name?: string } }>;
    expect(appEvents.some((event) => event.type === 'project-created' && event.payload?.name === 'Payments')).toBe(true);
  });

  it('opens create project dialog from command palette', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const createProjectItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Create Project...')
    ) as HTMLButtonElement | undefined;
    expect(createProjectItem).toBeDefined();

    act(() => {
      createProjectItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.project-modal')).not.toBeNull();
  });

  it('opens add node dialog from command palette', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const addNodeItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Add Node...')
    ) as HTMLButtonElement | undefined;
    expect(addNodeItem).toBeDefined();

    act(() => {
      addNodeItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.add-node-dialog')).not.toBeNull();
  });

  it('opens import node dialog from command palette', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const importNodeItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Import Node...')
    ) as HTMLButtonElement | undefined;
    expect(importNodeItem).toBeDefined();

    act(() => {
      importNodeItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.import-node-dialog')).not.toBeNull();
  });

  it('opens apply slice template dialog from command palette', () => {
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

    expect(document.querySelector('.create-slice-template-dialog')).not.toBeNull();
  });

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

  it('opens compact event streams dialog from command palette', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const compactItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Compact Event Streams...')
    ) as HTMLButtonElement | undefined;
    expect(compactItem).toBeDefined();

    act(() => {
      compactItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.compact-events-dialog')).not.toBeNull();
  });

  it('previews and executes event compaction from the compact dialog', () => {
    localStorage.setItem(
      'slicr.es.v1.stream.app',
      JSON.stringify([
        {
          id: 'p-1',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'project-created',
          payload: { projectId: 'default', name: 'Default' }
        },
        {
          id: 'p-2',
          version: 2,
          at: '2026-01-01T00:00:02.000Z',
          type: 'project-selected',
          payload: { projectId: 'default' }
        },
        {
          id: 'p-3',
          version: 3,
          at: '2026-01-01T00:00:03.000Z',
          type: 'slice-added-to-project',
          payload: { projectId: 'default', sliceId: 'slice-a' }
        },
        {
          id: 'p-4',
          version: 4,
          at: '2026-01-01T00:00:04.000Z',
          type: 'slice-selected',
          payload: { projectId: 'default', selectedSliceId: 'slice-a' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a',
      JSON.stringify([
        {
          id: 'a-1',
          sliceId: 'slice-a',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "A"\n\nevt:a0' }
        },
        {
          id: 'a-2',
          sliceId: 'slice-a',
          version: 2,
          at: '2026-01-01T00:00:02.000Z',
          type: 'text-edited',
          payload: { dsl: 'slice "A"\n\nevt:a1' }
        }
      ])
    );
    localStorage.setItem('slicr.es.v1.snapshot.slice-a', JSON.stringify({ version: 2, projection: {} }));

    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const compactItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Compact Event Streams...')
    ) as HTMLButtonElement | undefined;
    expect(compactItem).toBeDefined();

    act(() => {
      compactItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const compactDialog = document.querySelector('.compact-events-dialog');
    expect(compactDialog).not.toBeNull();
    expect(compactDialog?.textContent).toContain('Before bytes');
    expect(compactDialog?.textContent).toContain('After bytes');

    const compactButton = [...document.querySelectorAll('.project-modal-button.primary')]
      .find((button) => button.textContent?.trim() === 'Compact') as HTMLButtonElement | undefined;
    expect(compactButton).toBeDefined();

    act(() => {
      compactButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.compact-events-dialog')).toBeNull();
    expect(localStorage.getItem('slicr.es.v1.snapshot.slice-a')).toBeNull();
    const summary = document.querySelector('.compact-events-summary');
    expect(summary?.textContent).toContain('Reclaimed');
  });

  it('preserves projected app state while reducing event history during compaction', () => {
    localStorage.setItem(
      'slicr.es.v1.stream.app',
      JSON.stringify([
        {
          id: 'p-1',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'project-created',
          payload: { projectId: 'default', name: 'Default' }
        },
        {
          id: 'p-2',
          version: 2,
          at: '2026-01-01T00:00:02.000Z',
          type: 'project-selected',
          payload: { projectId: 'default' }
        },
        {
          id: 'p-3',
          version: 3,
          at: '2026-01-01T00:00:03.000Z',
          type: 'slice-added-to-project',
          payload: { projectId: 'default', sliceId: 'slice-a' }
        },
        {
          id: 'p-4',
          version: 4,
          at: '2026-01-01T00:00:04.000Z',
          type: 'slice-added-to-project',
          payload: { projectId: 'default', sliceId: 'slice-b' }
        },
        {
          id: 'p-5',
          version: 5,
          at: '2026-01-01T00:00:05.000Z',
          type: 'slice-selected',
          payload: { projectId: 'default', selectedSliceId: 'slice-a' }
        },
        {
          id: 'p-6',
          version: 6,
          at: '2026-01-01T00:00:06.000Z',
          type: 'slice-selected',
          payload: { projectId: 'default', selectedSliceId: 'slice-b' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a',
      JSON.stringify([
        {
          id: 'a-1',
          sliceId: 'slice-a',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Alpha"\n\nevt:a0' }
        },
        {
          id: 'a-2',
          sliceId: 'slice-a',
          version: 2,
          at: '2026-01-01T00:00:02.000Z',
          type: 'text-edited',
          payload: { dsl: 'slice "Alpha"\n\nevt:a1' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-b',
      JSON.stringify([
        {
          id: 'b-1',
          sliceId: 'slice-b',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Beta"\n\nevt:b0' }
        },
        {
          id: 'b-2',
          sliceId: 'slice-b',
          version: 2,
          at: '2026-01-01T00:00:02.000Z',
          type: 'text-edited',
          payload: { dsl: 'slice "Beta"\n\nevt:b1' }
        },
        {
          id: 'b-3',
          sliceId: 'slice-b',
          version: 3,
          at: '2026-01-01T00:00:03.000Z',
          type: 'node-moved',
          payload: { nodeKey: 'b1', x: 160, y: 140 }
        },
        {
          id: 'b-4',
          sliceId: 'slice-b',
          version: 4,
          at: '2026-01-01T00:00:04.000Z',
          type: 'layout-reset',
          payload: {}
        },
        {
          id: 'b-5',
          sliceId: 'slice-b',
          version: 5,
          at: '2026-01-01T00:00:05.000Z',
          type: 'node-moved',
          payload: { nodeKey: 'b1', x: 190, y: 170 }
        }
      ])
    );
    localStorage.setItem('slicr.es.v1.stream.slice-z', JSON.stringify([]));
    localStorage.setItem('slicr.es.v1.snapshot.slice-b', JSON.stringify({ version: 5, projection: {} }));
    localStorage.setItem('slicr.es.v1.index', JSON.stringify({ selectedSliceId: 'slice-b', sliceIds: ['slice-a', 'slice-b'] }));

    const beforeAppEvents = JSON.parse(localStorage.getItem('slicr.es.v1.stream.app') ?? '[]') as Array<unknown>;
    const beforeSliceBEvents = JSON.parse(localStorage.getItem('slicr.es.v1.stream.slice-b') ?? '[]') as Array<unknown>;

    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const compactItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Compact Event Streams...')
    ) as HTMLButtonElement | undefined;
    expect(compactItem).toBeDefined();

    act(() => {
      compactItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const compactButton = [...document.querySelectorAll('.project-modal-button.primary')]
      .find((button) => button.textContent?.trim() === 'Compact') as HTMLButtonElement | undefined;
    expect(compactButton).toBeDefined();

    act(() => {
      compactButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.slice-select-label')?.textContent).toContain('Beta');
    expect(hydrateSliceProjection('slice-b').dsl).toBe('slice "Beta"\n\nevt:b1');
    expect(hydrateSliceProjection('slice-b').manualNodePositions).toEqual({ b1: { x: 190, y: 170 } });
    expect(localStorage.getItem('slicr.es.v1.index')).toBeNull();
    expect(localStorage.getItem('slicr.es.v1.snapshot.slice-b')).toBeNull();
    expect(localStorage.getItem('slicr.es.v1.stream.slice-z')).toBeNull();

    const afterAppEvents = JSON.parse(localStorage.getItem('slicr.es.v1.stream.app') ?? '[]') as Array<unknown>;
    const afterSliceBEvents = JSON.parse(localStorage.getItem('slicr.es.v1.stream.slice-b') ?? '[]') as Array<unknown>;
    expect(afterAppEvents.length).toBeLessThan(beforeAppEvents.length);
    expect(afterSliceBEvents.length).toBeLessThan(beforeSliceBEvents.length);
  });

  it('closes create project dialog on Escape', () => {
    renderApp();
    const rail = ensureProjectRailOpen();

    const projectToggle = rail?.querySelector('button[aria-label="Select project"]') as HTMLButtonElement | null;
    expect(projectToggle).not.toBeNull();
    act(() => {
      projectToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createProjectItem = [...(rail?.querySelectorAll('.project-menu-item') ?? [])]
      .find((button) => button.textContent?.includes('Create Project')) as HTMLButtonElement | undefined;
    expect(createProjectItem).toBeDefined();
    act(() => {
      createProjectItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const input = document.querySelector('#project-name-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    act(() => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(document.querySelector('.project-modal')).toBeNull();
  });

  it('closes create project dialog on Escape keyup after input blur', () => {
    renderApp();
    const rail = ensureProjectRailOpen();

    const projectToggle = rail?.querySelector('button[aria-label="Select project"]') as HTMLButtonElement | null;
    expect(projectToggle).not.toBeNull();
    act(() => {
      projectToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createProjectItem = [...(rail?.querySelectorAll('.project-menu-item') ?? [])]
      .find((button) => button.textContent?.includes('Create Project')) as HTMLButtonElement | undefined;
    expect(createProjectItem).toBeDefined();
    act(() => {
      createProjectItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const input = document.querySelector('#project-name-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    act(() => {
      input?.blur();
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    });

    expect(document.querySelector('.project-modal')).toBeNull();
  });

  it('creates project on Enter in the create project dialog', () => {
    renderApp();
    const rail = ensureProjectRailOpen();

    const projectToggle = rail?.querySelector('button[aria-label="Select project"]') as HTMLButtonElement | null;
    expect(projectToggle).not.toBeNull();
    act(() => {
      projectToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createProjectItem = [...(rail?.querySelectorAll('.project-menu-item') ?? [])]
      .find((button) => button.textContent?.includes('Create Project')) as HTMLButtonElement | undefined;
    expect(createProjectItem).toBeDefined();
    act(() => {
      createProjectItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const input = document.querySelector('#project-name-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    act(() => {
      if (input) {
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(input, 'Ledger');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    act(() => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(document.querySelector('.project-modal')).toBeNull();
    const appStreamRaw = localStorage.getItem('slicr.es.v1.stream.app');
    expect(appStreamRaw).not.toBeNull();
    const appEvents = JSON.parse(appStreamRaw ?? '[]') as Array<{ type?: string; payload?: { name?: string } }>;
    expect(appEvents.some((event) => event.type === 'project-created' && event.payload?.name === 'Ledger')).toBe(true);
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

  it('opens the editor and moves cursor to declaration line when double-clicking a node', () => {
    renderApp();

    const panel = document.querySelector('.editor-panel');
    expect(panel?.classList.contains('open')).toBe(false);

    const node = [...document.querySelectorAll('.node')]
      .find((element) => element.textContent?.includes('room-opened')) as HTMLElement | undefined;
    expect(node).toBeDefined();

    act(() => {
      node?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    expect(panel?.classList.contains('open')).toBe(true);
    const focusedElement = document.activeElement as HTMLElement | null;
    expect(focusedElement?.closest('.dsl-editor')).not.toBeNull();
  });

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

  it('uses selected renderer engine for documentation previews', () => {
    localStorage.setItem(DIAGRAM_RENDERER_FLAG_STORAGE_KEY, 'dom-svg-camera');
    renderApp();

    const mainCameraWorld = document.querySelector('.main .canvas-panel .canvas-camera-world') as HTMLElement | null;
    expect(mainCameraWorld).not.toBeNull();
    expect(Number(mainCameraWorld?.dataset.cameraX ?? 0)).toBeLessThan(0);
    expect(Number(mainCameraWorld?.dataset.cameraY ?? 0)).toBeLessThan(0);

    const docsToggle = document.querySelector('button[aria-label="Toggle documentation panel"]');
    expect(docsToggle).not.toBeNull();

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

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

    act(() => {
      if (canvasPanel) {
        canvasPanel.scrollLeft = 260;
        canvasPanel.scrollTop = 140;
      }
    });

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(canvasPanel?.classList.contains('hidden')).toBe(true);

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(canvasPanel?.classList.contains('hidden')).toBe(false);
    expect(canvasPanel?.scrollLeft).toBe(260);
    expect(canvasPanel?.scrollTop).toBe(140);
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

    act(() => {
      if (docsPanel) {
        docsPanel.scrollTop = 220;
      }
    });

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(docsShell?.classList.contains('hidden')).toBe(true);

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(docsShell?.classList.contains('hidden')).toBe(false);
    expect(docsPanel?.scrollTop).toBe(220);
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

  it('shows a red gutter cell for unresolved dependencies', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Warnings"\n\nrm:orders <- evt:missing' }]
      })
    );

    renderApp();

    const warningCell = document.querySelector('.cm-foldGutter .cm-gutterElement.cm-warning-line-error');
    expect(warningCell).not.toBeNull();
  });

  it('shows an orange gutter cell for data integrity warnings', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "Data Integrity"

ui:my-ui
data:
  alpha: value

cmd:my-cmd
<- ui:my-ui
data:
  alpha: value
  bravo: other-value`
        }]
      })
    );

    renderApp();

    const warningCell = document.querySelector('.cm-foldGutter .cm-gutterElement.cm-warning-line-warning');
    expect(warningCell).not.toBeNull();
  });

  it('renders missing mapped data values in red with <missing> marker', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "Mapped Missing"

ui:my-ui
data:
  alpha: value

cmd:my-cmd
<- ui:my-ui
uses:
  alpha
  bravo <- bravo`
        }]
      })
    );

    renderApp();

    const missingLine = document.querySelector('.node-field-line.missing');
    expect(missingLine).not.toBeNull();
    expect(missingLine?.querySelector('.node-field-key')?.textContent).toBe('bravo');
    expect(missingLine?.querySelector('.node-field-val')?.textContent?.trim()).toBe('<missing>');

    const mappedField = missingLine?.closest('.node-field');
    expect(mappedField?.classList.contains('mapped')).toBe(true);
  });

  it('applies mapped styling only to fields coming from uses', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "Mapped Styling"

ui:source
data:
  alpha: from-source

cmd:target
<- ui:source
data:
  local: from-data
uses:
  alpha`
        }]
      })
    );

    renderApp();

    const allFields = [...document.querySelectorAll('.canvas-panel .node-field')];
    const mapped = allFields.filter((field) => field.classList.contains('mapped'));
    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.textContent).toContain('alpha:');
    expect(mapped[0]?.textContent).not.toContain('local:');
  });

  it('tints ui data keys by mapping direction across predecessor and successor uses', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "UI Data Key Tints"

rm:todos "All Todos"
data:
  todos:
  - id: 101
    name: Old Todo Name

ui:rename-todo "Rename Todo Form"
<- rm:todos
data:
  newName: ALPHA
uses:
  id <- $.todos[0].id

cmd:rename-todo "Rename Todo"
<- ui:rename-todo
uses:
  newName`
        }]
      })
    );

    renderApp();

    const uiNode = [...document.querySelectorAll('.node.ui')]
      .find((node) => node.querySelector('.node-title')?.textContent?.includes('Rename Todo Form'));
    expect(uiNode).toBeDefined();

    const fields = [...(uiNode?.querySelectorAll('.node-field') ?? [])];
    const idField = fields.find((field) => field.textContent?.includes('id:'));
    const newNameField = fields.find((field) => field.textContent?.includes('newName:'));

    expect(idField?.classList.contains('ui-mapped-inbound')).toBe(true);
    expect(newNameField?.classList.contains('ui-mapped-outbound')).toBe(true);
  });

  it('marks ui keys as both when they are mapped in and mapped out', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "UI Data Gradient Tint"

rm:todos "All Todos"
data:
  todos:
  - id: 101
    name: Old Todo Name

ui:rename-todo "Rename Todo Form"
<- rm:todos
data:
  newName: ALPHA
uses:
  id <- $.todos[0].id

cmd:rename-todo "Rename Todo"
<- ui:rename-todo
uses:
  id
  newName`
        }]
      })
    );

    renderApp();

    const uiNode = [...document.querySelectorAll('.node.ui')]
      .find((node) => node.querySelector('.node-title')?.textContent?.includes('Rename Todo Form'));
    expect(uiNode).toBeDefined();

    const fields = [...(uiNode?.querySelectorAll('.node-field') ?? [])];
    const idField = fields.find((field) => field.textContent?.includes('id:'));

    expect(idField?.classList.contains('ui-mapped-both')).toBe(true);
  });

  it('renders node field values without a leading space after the colon', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "Trim Node Value"

ui:rename-todo "Rename Todo Form"
data:
  newName: ALPHA`
        }]
      })
    );

    renderApp();

    const value = document.querySelector('.node.ui .node-field-val');
    expect(value?.textContent).toBe('ALPHA');
  });

  it('renders node measure field values without a leading space after the colon', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "Trim Measure Value"

ui:rename-todo "Rename Todo Form"
data:
  newName: ALPHA`
        }]
      })
    );

    renderApp();

    const value = document.querySelector('.node-measure-layer .node-field-val');
    expect(value?.textContent).toBe('ALPHA');
  });

  it('does not render a node-field-val span for container header lines', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "Container Header Value Span"

ui:rename-todo "Rename Todo Form"
data:
  alpha: bravo
  todos:
    - id: 1
      name: todo 1`
        }]
      })
    );

    renderApp();

    const uiNode = document.querySelector('.node.ui');
    expect(uiNode).not.toBeNull();

    const lines = [...(uiNode?.querySelectorAll('.node-field-line') ?? [])];
    const todosLine = lines.find((line) => line.querySelector('.node-field-key')?.textContent === 'todos');
    expect(todosLine).toBeDefined();
    expect(todosLine?.querySelector('.node-field-val')).toBeNull();

    const alphaLine = lines.find((line) => line.querySelector('.node-field-key')?.textContent === 'alpha');
    expect(alphaLine).toBeDefined();
    expect(alphaLine?.querySelector('.node-field-val')?.textContent).toBe('bravo');
  });

  it('does not crash when warnings arrive out of order while typing malformed uses/data blocks', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "Read Model from Two Events"

evt:alpha-updated "Alpha Updated"
data:
  alpha: alpha-value

evt:bravo-updated "Bravo Updated"
data:
  bravo: bravo-value

rm:combined-view "Combined View"
<- evt:alpha-updated
<- evt:bravo-updated
d
uses:
  alpha
  bravo <- bravo
  charlie`
        }]
      })
    );

    renderApp();

    expect(document.querySelector('.slice-title')?.textContent).toBe('Read Model from Two Events');
    expect(document.querySelector('#canvas')).not.toBeNull();
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

  it('defaults render engine dropdown flag on and persists it on localhost', () => {
    renderApp();

    const menuToggle = document.querySelector('button[aria-label="Select render mode"]');
    expect(menuToggle).not.toBeNull();
    expect(localStorage.getItem(RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY)).toBe('true');
  });

  it('hides render engine dropdown when persisted flag is disabled', () => {
    localStorage.setItem(RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY, 'false');

    renderApp();

    const menuToggle = document.querySelector('button[aria-label="Select render mode"]');
    expect(menuToggle).toBeNull();
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

  it('restores saved manual node positions for the selected slice on render', () => {
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

    const eventNode = document.querySelector('.node.evt') as HTMLElement | null;
    expect(eventNode).not.toBeNull();
    expect(eventNode?.style.left).toBe('315px');
    expect(eventNode?.style.top).toBe('265px');
  });

  it('loads saved manual node positions when switching slices', () => {
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

    const eventNodeBefore = document.querySelector('.node.evt') as HTMLElement | null;
    expect(eventNodeBefore?.style.left).toBe('115px');
    expect(eventNodeBefore?.style.top).toBe('95px');

    openSliceMenu();
    clickSliceMenuItem('B');

    const eventNodeAfter = document.querySelector('.node.evt') as HTMLElement | null;
    expect(eventNodeAfter?.style.left).toBe('445px');
    expect(eventNodeAfter?.style.top).toBe('355px');
  });

  it('does not wipe saved geometry on StrictMode refresh', () => {
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

    const eventNode = document.querySelector('.node.evt') as HTMLElement | null;
    expect(eventNode?.style.left).toBe('315px');
    expect(eventNode?.style.top).toBe('265px');
    expect(localStorage.getItem(SLICES_LAYOUT_STORAGE_KEY)).toContain('"simple-event"');
  });

  it('appends node-moved events on drag end', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\nevt:simple-event' }]
      })
    );

    renderApp();

    const node = document.querySelector('.node.evt') as HTMLElement | null;
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

  it('keeps the selected node selected while left-button panning the canvas', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\nevt:simple-event' }]
      })
    );

    renderApp();

    const node = document.querySelector('.node.evt') as HTMLElement | null;
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

  it('does not drag nodes when drag-and-drop flag is disabled', () => {
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

  it('appends layout-reset events when resetting positions from route menu', () => {
    setSingleEventSlice();

    renderApp();

    const beforeRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const beforeEvents = beforeRaw ? (JSON.parse(beforeRaw) as Array<{ type: string }>) : [];
    const beforeResetCount = beforeEvents.filter((event) => event.type === 'layout-reset').length;

    openRenderModeMenu();
    clickResetPositionsButton();

    const afterRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const afterEvents = afterRaw ? (JSON.parse(afterRaw) as Array<{ type: string }>) : [];
    const afterResetCount = afterEvents.filter((event) => event.type === 'layout-reset').length;
    expect(afterResetCount).toBe(beforeResetCount + 1);
  });

  it('tints render mode dropdown when manual layout overrides exist', () => {
    setSingleEventSlice();

    renderApp();

    const menuToggle = document.querySelector('button[aria-label="Select render mode"]') as HTMLButtonElement | null;
    expect(menuToggle).not.toBeNull();
    expect(menuToggle?.classList.contains('has-manual-layout-overrides')).toBe(false);

    const node = document.querySelector('.node.evt') as HTMLElement | null;
    expect(node).not.toBeNull();
    const PointerCtor = window.PointerEvent ?? window.MouseEvent;
    act(() => {
      node?.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100, pointerId: 1 }));
      window.dispatchEvent(new PointerCtor('pointermove', { bubbles: true, buttons: 1, clientX: 180, clientY: 180, pointerId: 1 }));
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, button: 0, clientX: 180, clientY: 180, pointerId: 1 }));
    });

    expect(menuToggle?.classList.contains('has-manual-layout-overrides')).toBe(true);

    openRenderModeMenu();
    clickResetPositionsButton();

    expect(menuToggle?.classList.contains('has-manual-layout-overrides')).toBe(false);
  });
});
