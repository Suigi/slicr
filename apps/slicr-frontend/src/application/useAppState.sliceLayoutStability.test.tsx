// @vitest-environment jsdom

import { act, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UseAppStateResult } from './appViewModel';
import { DRAG_AND_DROP_FLAG_STORAGE_KEY } from '../domain/runtimeFlags';
import { SLICES_STORAGE_KEY } from '../sliceLibrary';

const computeDiagramLayoutMock = vi.fn();

vi.mock('../domain/diagramEngine', async () => {
  const actual = await vi.importActual<typeof import('../domain/diagramEngine')>('../domain/diagramEngine');
  return {
    ...actual,
    computeDiagramLayout: (...args: Parameters<typeof actual.computeDiagramLayout>) => computeDiagramLayoutMock(...args)
  };
});

import { useAppState } from './useAppState';
import { NodeMeasureLayer } from '../ui/app-shell/NodeMeasureLayer';

let host: HTMLDivElement | null = null;
let root: ReactDOM.Root | null = null;
let latestState: UseAppStateResult | null = null;

function Harness({ onState }: { onState: (state: UseAppStateResult) => void }) {
  const state = useAppState();

  useEffect(() => {
    onState(state);
  }, [onState, state]);

  return <NodeMeasureLayer diagram={state.diagram} constants={state.constants} />;
}

function renderHarness() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);

  act(() => {
    root?.render(<Harness onState={(state) => {
      latestState = state;
    }} />);
  });
}

async function flushWork() {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  });
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }

  latestState = null;
  root = null;
  host?.remove();
  host = null;
  document.body.innerHTML = '';
  localStorage.clear();
  computeDiagramLayoutMock.mockReset();
});

beforeEach(() => {
  computeDiagramLayoutMock.mockImplementation(() => new Promise(() => undefined));
});

describe('useAppState slice layout stability', () => {
  it('hides provisional geometry on initial slice render until async layout settles', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [{ id: 'slice-a', dsl: 'slice "A"\n\nevt:first-node' }]
      })
    );

    renderHarness();

    await flushWork();

    expect(latestState?.diagram.diagramMode).toBe('slice');
    expect(latestState?.diagram.sceneModel).toBeNull();
  });

  it('exposes layoutReady as false while the current slice layout is unsettled', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [{ id: 'slice-a', dsl: 'slice "A"\n\nevt:first-node' }]
      })
    );

    renderHarness();

    await flushWork();

    expect(latestState?.diagram.diagramMode).toBe('slice');
    expect(latestState?.diagram.layoutReady).toBe(false);
  });

  it('disables drag and drop while the current slice layout is unsettled', async () => {
    localStorage.setItem(DRAG_AND_DROP_FLAG_STORAGE_KEY, 'true');
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [{ id: 'slice-a', dsl: 'slice "A"\n\nevt:first-node' }]
      })
    );

    renderHarness();

    await flushWork();

    expect(latestState?.diagram.layoutReady).toBe(false);
    expect(latestState?.diagram.dragAndDropEnabled).toBe(false);
  });
});
