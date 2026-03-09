// @vitest-environment jsdom

import { act, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { UseAppStateResult } from './appViewModel';
import { useAppState } from './useAppState';
import { SLICES_LAYOUT_STORAGE_KEY, SLICES_STORAGE_KEY } from '../sliceLibrary';
import { NodeMeasureLayer } from '../ui/app-shell/NodeMeasureLayer';
import { ScenarioGroupMeasureLayer } from '../ui/app-shell/ScenarioGroupMeasureLayer';

let host: HTMLDivElement | null = null;
let root: ReactDOM.Root | null = null;
let latestState: UseAppStateResult | null = null;

function Harness({ onState }: { onState: (state: UseAppStateResult) => void }) {
  const state = useAppState();

  useEffect(() => {
    onState(state);
  }, [onState, state]);

  return (
    <>
      <NodeMeasureLayer diagram={state.diagram} constants={state.constants} />
      <ScenarioGroupMeasureLayer scenarioGroups={state.diagram.measurementScenarioGroups} />
    </>
  );
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

async function waitForOverviewMode(attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    if (latestState?.diagram.diagramMode === 'overview') {
      return latestState.diagram;
    }
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    });
  }
  return latestState?.diagram.diagramMode === 'overview' ? latestState.diagram : null;
}

async function waitForOverviewScene(attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    const sceneModel = latestState?.diagram.diagramMode === 'overview'
      ? latestState.diagram.sceneModel
      : null;
    const isOverviewScene = sceneModel
      ? sceneModel.sliceFrames.length > 0 || sceneModel.nodes.some((node) => node.key.includes('::'))
      : false;
    if (sceneModel && isOverviewScene) {
      return sceneModel;
    }
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    });
  }
  if (latestState?.diagram.diagramMode !== 'overview') {
    return null;
  }
  const sceneModel = latestState.diagram.sceneModel;
  if (!sceneModel) {
    return null;
  }
  return sceneModel.sliceFrames.length > 0 || sceneModel.nodes.some((node) => node.key.includes('::'))
    ? sceneModel
    : null;
}

async function waitForSliceScene(attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    const sceneModel = latestState?.diagram.diagramMode === 'slice'
      ? latestState.diagram.sceneModel
      : null;
    if (sceneModel) {
      return sceneModel;
    }
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    });
  }
  return latestState?.diagram.diagramMode === 'slice'
    ? (latestState.diagram.sceneModel ?? null)
    : null;
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
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

describe('useAppState overview mode', () => {
  it('defaults to slice mode and exposes overview enter and exit actions', () => {
    renderHarness();

    expect(latestState?.diagram.diagramMode).toBe('slice');
    expect(latestState?.actions.onShowProjectOverview).toBeTypeOf('function');
    expect(latestState?.actions.onHideProjectOverview).toBeTypeOf('function');
  });

  it('enters overview mode by clearing the visible slice selection and closing the editor', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [{ id: 'slice-a', dsl: 'slice "Overview"\n\nevt:selected-node' }]
      })
    );

    renderHarness();
    await waitForSliceScene();

    act(() => {
      latestState?.actions.onNodeSelect('selected-node');
      latestState?.actions.onToggleEditor();
    });

    expect(latestState?.analysisPanel.selectedNode?.key).toBe('selected-node');
    expect(latestState?.editor.editorOpen).toBe(true);

    act(() => {
      latestState?.actions.onShowProjectOverview();
    });

    expect(latestState?.diagram.diagramMode).toBe('overview');
    expect(latestState?.analysisPanel.selectedNode).toBeNull();
    expect(latestState?.editor.editorOpen).toBe(false);
  });

  it('exits overview mode by restoring the previous editor state and selected slice node', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [{ id: 'slice-a', dsl: 'slice "Overview"\n\nevt:selected-node' }]
      })
    );

    renderHarness();
    await waitForSliceScene();

    act(() => {
      latestState?.actions.onNodeSelect('selected-node');
      latestState?.actions.onToggleEditor();
      latestState?.actions.onShowProjectOverview();
    });

    expect(latestState?.diagram.diagramMode).toBe('overview');
    expect(latestState?.analysisPanel.selectedNode).toBeNull();
    expect(latestState?.editor.editorOpen).toBe(false);

    act(() => {
      latestState?.actions.onHideProjectOverview();
    });

    expect(latestState?.diagram.diagramMode).toBe('slice');
    expect(latestState?.analysisPanel.selectedNode?.key).toBe('selected-node');
    expect(latestState?.editor.editorOpen).toBe(true);
  });

  it('clears overview-local selection when overview closes and reopens', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [{
          id: 'slice-a',
          dsl: 'slice "Overview"\n\nevt:slice-node\n\nevt:overview-node'
        }]
      })
    );

    renderHarness();
    await waitForSliceScene();

    act(() => {
      latestState?.actions.onNodeSelect('slice-node');
      latestState?.actions.onShowProjectOverview();
    });

    await waitForOverviewScene();

    act(() => {
      latestState?.actions.onNodeSelect('slice-a::overview-node');
    });

    expect(latestState?.analysisPanel.selectedNode).toBeNull();
    expect(latestState?.diagram.sceneModel?.nodes.find((node) => node.key === 'slice-a::overview-node')?.selected).toBe(true);

    act(() => {
      latestState?.actions.onHideProjectOverview();
    });

    expect(latestState?.analysisPanel.selectedNode?.key).toBe('slice-node');
    expect(latestState?.diagram.sceneModel?.nodes.find((node) => node.key === 'slice-a::overview-node')).toBeUndefined();

    act(() => {
      latestState?.actions.onShowProjectOverview();
    });

    await waitForOverviewScene();

    expect(latestState?.analysisPanel.selectedNode).toBeNull();
    expect(latestState?.diagram.sceneModel?.nodes.find((node) => node.key === 'slice-a::overview-node')?.selected).toBe(false);
  });

  it('renders a merged overview scene with nodes from multiple slices', async () => {
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

    renderHarness();

    act(() => {
      latestState?.actions.onShowProjectOverview();
    });

    const nodeKeys = (await waitForOverviewScene())?.nodes.map((node) => node.key) ?? [];
    expect(nodeKeys).toContain('slice-a::first-node');
    expect(nodeKeys).toContain('slice-b::second-node');
  });

  it('renders overview scenarios from the merged namespaced parsed graph', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [
          {
            id: 'slice-a',
            dsl: [
              'slice "Alpha"',
              '',
              'cmd:rename',
              '',
              'scenario "Rename"',
              'given:',
              '  evt:item-created',
              '',
              'when:',
              '  cmd:rename',
              '',
              'then:',
              '  evt:item-renamed'
            ].join('\n')
          }
        ]
      })
    );

    renderHarness();

    act(() => {
      latestState?.actions.onShowProjectOverview();
    });

    const scenario = (await waitForOverviewMode())?.parsed?.scenarios[0];
    expect(scenario?.given[0]?.key.startsWith('slice-a::scn:')).toBe(true);
    expect(scenario?.when?.key.startsWith('slice-a::scn:')).toBe(true);
    expect(scenario?.then[0]?.key.startsWith('slice-a::scn:')).toBe(true);
  });

  it('ignores overview hover ranges that are outside the current slice editor document', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [
          {
            id: 'slice-a',
            dsl: [
              'slice "Alpha"',
              '',
              'cmd:rename',
              '',
              'scenario "Rename"',
              'given:',
              '  evt:item-created',
              '',
              'when:',
              '  cmd:rename',
              '',
              'then:',
              '  evt:item-renamed'
            ].join('\n')
          }
        ]
      })
    );

    renderHarness();

    act(() => {
      latestState?.actions.onShowProjectOverview();
    });

    expect(() => {
      act(() => {
        latestState?.actions.onNodeHoverRange({ from: 640, to: 640 });
      });
    }).not.toThrow();
    expect(latestState?.diagram.diagramMode).toBe('overview');
  });

  it('skips invalid slices when building the overview scene', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-valid',
        slices: [
          { id: 'slice-valid', dsl: 'slice "Valid"\n\nevt:valid-node' },
          { id: 'slice-invalid', dsl: 'slice "Broken"\n\nscenario "Missing when"\ngiven:\n  evt:broken-node' }
        ]
      })
    );

    renderHarness();

    act(() => {
      latestState?.actions.onShowProjectOverview();
    });

    const nodeKeys = (await waitForOverviewScene())?.nodes.map((node) => node.key) ?? [];
    expect(nodeKeys).toContain('slice-valid::valid-node');
    expect(nodeKeys.some((key) => key.startsWith('slice-invalid::'))).toBe(false);
  });

  it('renders a one-slice project through the overview pipeline with namespaced node keys', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [{ id: 'slice-a', dsl: 'slice "Solo"\n\nevt:solo-node' }]
      })
    );

    renderHarness();

    act(() => {
      latestState?.actions.onShowProjectOverview();
    });

    const nodeKeys = (await waitForOverviewScene())?.nodes.map((node) => node.key) ?? [];
    expect(nodeKeys).toEqual(['slice-a::solo-node']);
  });

  it('does not apply slice manual layout overrides to overview nodes', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [{ id: 'slice-a', dsl: 'slice "Solo"\n\nevt:solo-node' }]
      })
    );
    localStorage.setItem(
      SLICES_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        'slice-a': {
          nodes: { 'solo-node': { x: 315, y: 265 } },
          edges: {}
        }
      })
    );

    renderHarness();

    const sliceNode = (await waitForSliceScene())?.nodes.find((node) => node.key === 'solo-node');
    expect(sliceNode?.x).toBe(315);
    expect(sliceNode?.y).toBe(265);

    act(() => {
      latestState?.actions.onShowProjectOverview();
    });

    const overviewNode = (await waitForOverviewScene())?.nodes.find((node) => node.key === 'slice-a::solo-node');
    expect(overviewNode).toBeDefined();
    expect(overviewNode?.x).not.toBe(315);
    expect(overviewNode?.y).not.toBe(265);
  });
});
