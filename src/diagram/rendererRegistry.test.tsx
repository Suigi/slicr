// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomSvgDiagramRenderer } from './domSvgRenderer';
import { ExperimentalDiagramRenderer } from './experimentalRenderer';
import { getDiagramRenderer } from './rendererRegistry';
import type { DiagramRendererAdapterProps } from './domSvgRenderer';
import type { DiagramSceneModel } from './rendererContract';

let root: ReactDOM.Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root && host) {
    act(() => root?.unmount());
  }
  root = null;
  host = null;
  document.body.innerHTML = '';
});

function renderWithRegistryRenderer(rendererId: 'dom-svg' | 'experimental') {
  const Renderer = getDiagramRenderer(rendererId);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);

  const sceneModel: DiagramSceneModel = {
    nodes: [],
    edges: [],
    lanes: [],
    boundaries: [],
    worldWidth: 100,
    worldHeight: 100,
    title: null,
    viewport: { width: 100, height: 100, offsetX: 0, offsetY: 0 }
  };

  const props: DiagramRendererAdapterProps = {
    sceneModel,
    canvasPanelRef: { current: null },
    isPanning: false,
    docsOpen: false,
    dragTooltip: null,
    dragAndDropEnabled: true,
    routeMode: 'classic',
    beginCanvasPan: vi.fn(),
    beginNodeDrag: vi.fn(),
    beginEdgeSegmentDrag: vi.fn(),
    onNodeHoverRange: vi.fn(),
    onNodeSelect: vi.fn(),
    onNodeOpenInEditor: vi.fn(),
    onEdgeHover: vi.fn()
  };

  act(() => {
    root?.render(<Renderer {...props} />);
  });
}

describe('rendererRegistry', () => {
  it('returns dom-svg renderer for dom-svg id', () => {
    expect(getDiagramRenderer('dom-svg')).toBe(DomSvgDiagramRenderer);
  });

  it('returns experimental renderer for experimental id', () => {
    expect(getDiagramRenderer('experimental')).toBe(ExperimentalDiagramRenderer);
  });

  it('falls back to dom-svg renderer for unknown id', () => {
    expect(getDiagramRenderer('unknown' as 'dom-svg')).toBe(DomSvgDiagramRenderer);
  });

  it('mounts camera world wrapper for experimental renderer', () => {
    renderWithRegistryRenderer('experimental');
    expect(document.querySelector('.canvas-camera-world')).not.toBeNull();
  });
});
