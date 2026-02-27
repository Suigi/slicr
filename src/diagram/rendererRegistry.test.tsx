// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomSvgDiagramRenderer } from './domSvgRenderer';
import { DomSvgCameraDiagramRenderer } from './domSvgCameraRenderer';
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

function renderWithRegistryRenderer(rendererId: 'dom-svg' | 'dom-svg-camera') {
  const Renderer = getDiagramRenderer(rendererId);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);

  const sceneModel: DiagramSceneModel = {
    nodes: [],
    edges: [],
    lanes: [],
    boundaries: [],
    scenarios: [],
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

  it('returns dom-svg-camera renderer for dom-svg-camera id', () => {
    expect(getDiagramRenderer('dom-svg-camera')).toBe(DomSvgCameraDiagramRenderer);
  });

  it('falls back to dom-svg-camera renderer for unknown id', () => {
    expect(getDiagramRenderer('unknown' as 'dom-svg-camera')).toBe(DomSvgCameraDiagramRenderer);
  });

  it('mounts camera world wrapper for dom-svg-camera renderer', () => {
    renderWithRegistryRenderer('dom-svg-camera');
    expect(document.querySelector('.canvas-camera-world')).not.toBeNull();
  });
});
