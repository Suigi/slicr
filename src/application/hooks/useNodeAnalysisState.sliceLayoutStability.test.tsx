// @vitest-environment jsdom

import { act, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { parseDsl } from '../../domain/parseDsl';
import { useNodeAnalysisState } from './useNodeAnalysisState';

let host: HTMLDivElement | null = null;
let root: ReactDOM.Root | null = null;
let latestSelectedNodeKey: string | null = null;
let rerenderHarness: ((args: { dsl: string; selectedNodeKey: string | null; layoutReady: boolean }) => void) | null = null;

function Harness({ dsl, selectedNodeKey, layoutReady }: { dsl: string; selectedNodeKey: string | null; layoutReady: boolean }) {
  const parsed = parseDsl(dsl);
  const analysis = useNodeAnalysisState({
    parsed,
    currentDsl: dsl,
    selectedSliceId: 'slice-a',
    selectedNodeKey,
    layoutReady,
    parsedSliceProjectionList: [],
    parsedSliceProjections: new Map(),
    crossSliceDataEnabled: false
  });

  useEffect(() => {
    latestSelectedNodeKey = analysis.selectedNode?.key ?? null;
  }, [analysis.selectedNode]);

  return null;
}

function renderHarness(initialArgs: { dsl: string; selectedNodeKey: string | null; layoutReady: boolean }) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);

  rerenderHarness = (args) => {
    act(() => {
      root?.render(<Harness {...args} />);
    });
  };

  rerenderHarness(initialArgs);
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }

  latestSelectedNodeKey = null;
  rerenderHarness = null;
  root = null;
  host?.remove();
  host = null;
  document.body.innerHTML = '';
});

describe('useNodeAnalysisState slice layout stability', () => {
  it('keeps the previous selected node visible while slice layout is unsettled', () => {
    renderHarness({
      dsl: 'slice "A"\n\nevt:first-node',
      selectedNodeKey: 'first-node',
      layoutReady: true
    });

    expect(latestSelectedNodeKey).toBe('first-node');

    rerenderHarness?.({
      dsl: 'slice "A"\n\nevt:second-node',
      selectedNodeKey: 'first-node',
      layoutReady: false
    });

    expect(latestSelectedNodeKey).toBe('first-node');
  });
});
