// @vitest-environment jsdom

import { act, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramPoint } from './domain/diagramRouting';
import type { Position } from './domain/types';
import { useDiagramInteractions } from './useDiagramInteractions';

function Harness({ onEdgeDragCommit }: { onEdgeDragCommit: (edgeKey: string, points: DiagramPoint[]) => void }) {
  const [, setManualNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [manualEdgePoints, setManualEdgePoints] = useState<Record<string, DiagramPoint[]>>({});
  const displayedPos: Record<string, Position> = {
    a: { x: 100, y: 100, w: 120, h: 80 },
    b: { x: 400, y: 100, w: 120, h: 80 }
  };

  const renderedEdges = [
    {
      edgeKey: 'a->b#0',
      edge: { from: 'a', to: 'b', label: null },
      geometry: {
        points: [
          { x: 220, y: 140 },
          { x: 300, y: 140 },
          { x: 400, y: 140 }
        ]
      }
    }
  ];

  const {
    beginEdgeSegmentDrag
  } = useDiagramInteractions({
    dragAndDropEnabled: true,
    displayedPos,
    renderedEdges,
    manualEdgePoints,
    setManualNodePositions,
    setManualEdgePoints,
    onEdgeDragCommit
  });

  return (
    <button
      type="button"
      onPointerDown={(event) => beginEdgeSegmentDrag(
        event,
        'a->b#0',
        0,
        [
          { x: 220, y: 140 },
          { x: 300, y: 140 },
          { x: 400, y: 140 }
        ]
      )}
    >
      drag
    </button>
  );
}

describe('useDiagramInteractions edge drag commit', () => {
  let root: ReactDOM.Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    host = null;
    document.body.innerHTML = '';
  });

  it('commits edge points on drag end', () => {
    const onEdgeDragCommit = vi.fn();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = ReactDOM.createRoot(host);

    act(() => {
      root?.render(<Harness onEdgeDragCommit={onEdgeDragCommit} />);
    });

    const button = document.querySelector('button');
    expect(button).not.toBeNull();

    const PointerCtor = window.PointerEvent ?? window.MouseEvent;
    act(() => {
      button?.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, button: 0, clientX: 220, clientY: 140, pointerId: 9 }));
      window.dispatchEvent(new PointerCtor('pointermove', { bubbles: true, buttons: 1, clientX: 220, clientY: 180, pointerId: 9 }));
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, button: 0, clientX: 220, clientY: 180, pointerId: 9 }));
    });

    expect(onEdgeDragCommit).toHaveBeenCalledTimes(1);
    const [edgeKey, points] = onEdgeDragCommit.mock.calls[0] as [string, DiagramPoint[]];
    expect(edgeKey).toBe('a->b#0');
    expect(points).toHaveLength(3);
  });
});
