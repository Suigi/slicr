// @vitest-environment jsdom
/* eslint-disable react-hooks/refs */

import { act, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramSceneModel } from '../../diagram/rendererContract';
import type { DiagramPoint } from '../../domain/diagramRouting';
import { parseDsl } from '../../domain/parseDsl';
import type { Parsed } from '../../domain/types';
import { TYPE_LABEL, NODE_VERSION_SUFFIX } from '../appConstants';
import { NODE_MEASURE_NODE_CLASS } from '../../nodeMeasurement';

const { computeDiagramLayoutMock, realComputeDiagramLayoutRef } = vi.hoisted(() => ({
  computeDiagramLayoutMock: vi.fn(),
  realComputeDiagramLayoutRef: {
    current: null as null | typeof import('../../domain/diagramEngine').computeDiagramLayout
  }
}));

vi.mock('../../domain/diagramEngine', async () => {
  const actual = await vi.importActual<typeof import('../../domain/diagramEngine')>('../../domain/diagramEngine');
  realComputeDiagramLayoutRef.current = actual.computeDiagramLayout;
  return {
    ...actual,
    computeDiagramLayout: (...args: Parameters<typeof actual.computeDiagramLayout>) => computeDiagramLayoutMock(...args)
  };
});

import { useDiagramViewState } from './useDiagramViewState';
import { NodeMeasureLayer } from '../../ui/app-shell/NodeMeasureLayer';

type ViewStateResult = ReturnType<typeof useDiagramViewState>;

let host: HTMLDivElement | null = null;
let root: ReactDOM.Root | null = null;
let latestSceneModel: DiagramSceneModel | null = null;
let latestViewState: ViewStateResult | null = null;
let rerenderHarness: ((args: {
  dsl: string;
  parsed: Parsed | null;
  focusRequestVersion: number;
  pendingFocusNodeKey: string | null;
}) => void) | null = null;

function ViewStateHarness({
  dsl,
  parsed,
  focusRequestVersion,
  pendingFocusNodeKey,
  onSceneModel
}: {
  dsl: string;
  parsed: Parsed | null;
  focusRequestVersion: number;
  pendingFocusNodeKey: string | null;
  onSceneModel: (sceneModel: DiagramSceneModel | null) => void;
}) {
  const parsedValue = useMemo(() => parsed, [parsed]);
  const [manualNodePositions, setManualNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [manualEdgePoints, setManualEdgePoints] = useState<Record<string, DiagramPoint[]>>({});
  const pendingFocusNodeKeyRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    pendingFocusNodeKeyRef.current = pendingFocusNodeKey;
  }, [pendingFocusNodeKey]);
  const viewState = useDiagramViewState({
    diagramMode: 'slice',
    overviewNodeDataVisible: true,
    parsed: parsedValue,
    parsedSliceProjectionList: [],
    currentDsl: dsl,
    theme: 'light',
    diagramRendererId: 'dom-svg',
    selectedSliceId: 'slice-a',
    dragAndDropEnabled: false,
    manualNodePositions,
    manualEdgePoints,
    setManualNodePositions,
    setManualEdgePoints,
    hoveredEditorRange: null,
    selectedNodeKey: null,
    hoveredEdgeKey: null,
    hoveredTraceNodeKey: null,
    focusRequestVersion,
    pendingFocusNodeKeyRef,
    fallbackOverviewSceneModel: null
  });

  useEffect(() => {
    latestViewState = viewState;
  }, [viewState]);

  useEffect(() => {
    onSceneModel(viewState.sceneModel);
  }, [onSceneModel, viewState.sceneModel]);

  const measureLayerDiagram = {
    diagramMode: 'slice',
    overviewNodeDataVisible: true,
    parsed: viewState.parsed
  } as never;

  return (
    <>
      <div ref={viewState.canvasPanelRef} />
      <NodeMeasureLayer
        diagram={measureLayerDiagram}
        constants={{ TYPE_LABEL, NODE_VERSION_SUFFIX, NODE_MEASURE_NODE_CLASS } as never}
      />
    </>
  );
}

function renderHarness(
  initialDsl: string,
  parsed: Parsed | null = parseDsl(initialDsl),
  focusRequestVersion = 0,
  pendingFocusNodeKey: string | null = null
) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);

  rerenderHarness = (args) => {
    act(() => {
      root?.render(<ViewStateHarness
        dsl={args.dsl}
        parsed={args.parsed}
        focusRequestVersion={args.focusRequestVersion}
        pendingFocusNodeKey={args.pendingFocusNodeKey}
        onSceneModel={(sceneModel) => {
          latestSceneModel = sceneModel;
        }}
      />);
    });
  };

  rerenderHarness({
    dsl: initialDsl,
    parsed,
    focusRequestVersion,
    pendingFocusNodeKey
  });
}

async function flushWork() {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

async function waitForSceneModel(attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    if (latestSceneModel) {
      return latestSceneModel;
    }
    await flushWork();
  }
  return latestSceneModel;
}

beforeEach(() => {
  computeDiagramLayoutMock.mockImplementation((parsed, options) => realComputeDiagramLayoutRef.current?.(parsed, options));
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }

  latestSceneModel = null;
  latestViewState = null;
  rerenderHarness = null;
  root = null;
  host?.remove();
  host = null;
  document.body.innerHTML = '';
  computeDiagramLayoutMock.mockReset();
});

describe('useDiagramViewState slice layout stability', () => {
  it('keeps the previous settled slice scene visible until the edited layout settles', async () => {
    computeDiagramLayoutMock.mockImplementation((parsed, options) => (
      parsed.nodes.has('second-node')
        ? new Promise(() => undefined)
        : realComputeDiagramLayoutRef.current?.(parsed, options)
    ));

    renderHarness('slice "A"\n\nevt:first-node');

    const initialSceneModel = await waitForSceneModel();
    expect(initialSceneModel?.nodes.map((node) => node.key)).toEqual(['first-node']);

    rerenderHarness?.({
      dsl: 'slice "A"\n\nevt:second-node',
      parsed: parseDsl('slice "A"\n\nevt:second-node'),
      focusRequestVersion: 0,
      pendingFocusNodeKey: null
    });
    await flushWork();

    expect(latestSceneModel?.nodes.map((node) => node.key)).toEqual(['first-node']);
  });

  it('keeps the previous settled slice scene visible when the edited layout fails', async () => {
    computeDiagramLayoutMock.mockImplementation((parsed, options) => (
      parsed.nodes.has('second-node')
        ? Promise.reject(new Error('layout failed'))
        : realComputeDiagramLayoutRef.current?.(parsed, options)
    ));

    renderHarness('slice "A"\n\nevt:first-node');

    const initialSceneModel = await waitForSceneModel();
    expect(initialSceneModel?.nodes.map((node) => node.key)).toEqual(['first-node']);

    rerenderHarness?.({
      dsl: 'slice "A"\n\nevt:second-node',
      parsed: parseDsl('slice "A"\n\nevt:second-node'),
      focusRequestVersion: 0,
      pendingFocusNodeKey: null
    });
    await flushWork();

    expect(latestSceneModel?.nodes.map((node) => node.key)).toEqual(['first-node']);
  });

  it('keeps the previous settled slice scene visible when the current DSL is invalid', async () => {
    renderHarness('slice "A"\n\nevt:first-node');

    const initialSceneModel = await waitForSceneModel();
    expect(initialSceneModel?.nodes.map((node) => node.key)).toEqual(['first-node']);

    rerenderHarness?.({
      dsl: 'slice "A"\n\nscenario "Broken"\ngiven:\n  evt:missing-when',
      parsed: null,
      focusRequestVersion: 0,
      pendingFocusNodeKey: null
    });
    await flushWork();

    expect(latestSceneModel?.nodes.map((node) => node.key)).toEqual(['first-node']);
  });

  it('does not start canvas panning while slice layout is unsettled', async () => {
    computeDiagramLayoutMock.mockImplementation(() => new Promise(() => undefined));

    renderHarness('slice "A"\n\nevt:first-node');
    await flushWork();

    act(() => {
      latestViewState?.beginCanvasPan({
        button: 0,
        clientX: 10,
        clientY: 20,
        pointerId: 1,
        target: latestViewState.canvasPanelRef.current,
        preventDefault: () => undefined
      } as never);
    });

    expect(latestViewState?.layoutReady).toBe(false);
    expect(latestViewState?.isPanning).toBe(false);
  });

  it('waits for the next settled slice layout before applying pending focus', async () => {
    computeDiagramLayoutMock.mockImplementation((parsed, options) => (
      parsed.nodes.has('second-node')
        ? new Promise(() => undefined)
        : realComputeDiagramLayoutRef.current?.(parsed, options)
    ));

    renderHarness('slice "A"\n\nevt:first-node');

    const initialSceneModel = await waitForSceneModel();
    expect(initialSceneModel?.nodes.map((node) => node.key)).toEqual(['first-node']);

    const panel = latestViewState?.canvasPanelRef.current as HTMLDivElement | null;
    expect(panel).not.toBeNull();
    Object.defineProperty(panel, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(panel, 'clientHeight', { configurable: true, value: 200 });
    panel!.scrollLeft = 0;
    panel!.scrollTop = 0;

    rerenderHarness?.({
      dsl: 'slice "A"\n\nevt:first-node\n\nevt:second-node',
      parsed: parseDsl('slice "A"\n\nevt:first-node\n\nevt:second-node'),
      focusRequestVersion: 1,
      pendingFocusNodeKey: 'first-node'
    });
    await flushWork();

    expect(latestViewState?.layoutReady).toBe(false);
    expect(panel?.scrollLeft).toBe(0);
    expect(panel?.scrollTop).toBe(0);
  });
});
