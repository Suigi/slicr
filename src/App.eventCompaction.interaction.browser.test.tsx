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

describe('App event compaction interactions', () => {
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
});
