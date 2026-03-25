// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramRendererAdapterProps } from '../../diagram/domSvgRenderer';
import { DiagramCanvas } from './DiagramCanvas';
import { DiagramInteractionProvider } from './contexts/DiagramInteractionContext';

let host: HTMLDivElement | null = null;
let root: ReactDOM.Root | null = null;

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  host?.remove();
  root = null;
  host = null;
});

describe('DiagramCanvas', () => {
  it('threads the overview node data flag and toggle action into the renderer props', async () => {
    const rendererSpy = vi.fn((props: DiagramRendererAdapterProps) => {
      void props;
      return null;
    });
    const toggleOverviewNodeDataVisibility = vi.fn();

    host = document.createElement('div');
    document.body.appendChild(host);
    root = ReactDOM.createRoot(host);

    await act(async () => {
      root?.render(
        <DiagramInteractionProvider
          value={{
            diagram: {
              diagramMode: 'overview',
              DiagramRenderer: rendererSpy,
              rendererViewportKey: 'viewport-key',
              sceneModel: null,
              overviewNodeDataVisible: false,
              initialCamera: { x: 10, y: 20, zoom: 1.25 },
              dragTooltip: null,
              dragAndDropEnabled: false,
              isPanning: false,
              canvasPanelRef: { current: null },
              beginCanvasPan: vi.fn(),
              beginNodeDrag: vi.fn(),
              beginEdgeSegmentDrag: vi.fn()
            },
            docsOpen: false,
            actions: {
              onNodeHoverRange: vi.fn(),
              onNodeSelect: vi.fn(),
              onNodeOpenInEditor: vi.fn(),
              onEdgeHover: vi.fn(),
              onToggleOverviewNodeDataVisibility: toggleOverviewNodeDataVisibility
            }
          }}
        >
          <DiagramCanvas />
        </DiagramInteractionProvider>
      );
    });

    expect(rendererSpy).toHaveBeenCalledTimes(1);
    expect(rendererSpy.mock.calls[0]?.[0].diagramMode).toBe('overview');
    expect(rendererSpy.mock.calls[0]?.[0].overviewNodeDataVisible).toBe(false);
    expect(rendererSpy.mock.calls[0]?.[0].onToggleOverviewNodeDataVisibility).toBe(toggleOverviewNodeDataVisibility);
  });
});
