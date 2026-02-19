import { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction, useRef, useState } from 'react';
import type { DiagramPoint } from './domain/diagramRouting';
import type { Parsed, Position } from './domain/types';

const DRAG_GRID_SIZE = 5;

export type DragTooltipState = {
  text: string;
  clientX: number;
  clientY: number;
};

type RenderedEdgeRef = {
  edgeKey: string;
  edge: Parsed['edges'][number];
  geometry: { points?: DiagramPoint[] };
};

type UseDiagramInteractionsArgs = {
  displayedPos: Record<string, Position>;
  renderedEdges: RenderedEdgeRef[];
  manualEdgePoints: Record<string, DiagramPoint[]>;
  setManualNodePositions: Dispatch<SetStateAction<Record<string, { x: number; y: number }>>>;
  setManualEdgePoints: Dispatch<SetStateAction<Record<string, DiagramPoint[]>>>;
};

function snapToGrid(value: number): number {
  return Math.round(value / DRAG_GRID_SIZE) * DRAG_GRID_SIZE;
}

export function useDiagramInteractions({
  displayedPos,
  renderedEdges,
  manualEdgePoints,
  setManualNodePositions,
  setManualEdgePoints
}: UseDiagramInteractionsArgs): {
  canvasPanelRef: RefObject<HTMLDivElement>;
  dragTooltip: DragTooltipState | null;
  isPanning: boolean;
  beginNodeDrag: (event: ReactPointerEvent, nodeKey: string) => void;
  beginEdgeSegmentDrag: (event: ReactPointerEvent, edgeKey: string, segmentIndex: number, points: DiagramPoint[]) => void;
  beginCanvasPan: (event: ReactPointerEvent<HTMLDivElement>) => void;
} {
  const canvasPanelRef = useRef<HTMLDivElement>(null);
  const [dragTooltip, setDragTooltip] = useState<DragTooltipState | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const beginNodeDrag = (event: ReactPointerEvent, nodeKey: string) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = displayedPos[nodeKey];
    if (!origin) {
      return;
    }
    const overriddenEdges = renderedEdges
      .map(({ edgeKey, edge }) => {
        const points = manualEdgePoints[edgeKey];
        if (!points || points.length < 2) {
          return null;
        }
        const affectsSource = edge.from === nodeKey;
        const affectsTarget = edge.to === nodeKey;
        if (!affectsSource && !affectsTarget) {
          return null;
        }
        return {
          edgeKey,
          points: points.map((point) => ({ ...point })),
          affectsSource,
          affectsTarget
        };
      })
      .filter((value): value is { edgeKey: string; points: DiagramPoint[]; affectsSource: boolean; affectsTarget: boolean } => Boolean(value));

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const nextX = snapToGrid(origin.x + dx);
      const nextY = snapToGrid(origin.y + dy);
      const snappedDx = nextX - origin.x;
      const snappedDy = nextY - origin.y;
      setManualNodePositions((current) => ({
        ...current,
        [nodeKey]: {
          x: nextX,
          y: nextY
        }
      }));
      setDragTooltip({
        text: `${nodeKey}: (${Math.round(nextX)}, ${Math.round(nextY)})`,
        clientX: moveEvent.clientX,
        clientY: moveEvent.clientY
      });
      if (overriddenEdges.length > 0) {
        setManualEdgePoints((current) => {
          const next = { ...current };
          for (const edge of overriddenEdges) {
            const base = edge.points.map((point) => ({ ...point }));
            const lastIndex = base.length - 1;
            if (edge.affectsSource) {
              base[0] = { x: base[0].x + snappedDx, y: base[0].y + snappedDy };
              if (lastIndex >= 1) {
                base[1] = { x: base[1].x + snappedDx, y: base[1].y };
              }
            }
            if (edge.affectsTarget) {
              base[lastIndex] = { x: base[lastIndex].x + snappedDx, y: base[lastIndex].y + snappedDy };
              if (lastIndex - 1 >= 0) {
                base[lastIndex - 1] = { x: base[lastIndex - 1].x + snappedDx, y: base[lastIndex - 1].y };
              }
            }
            next[edge.edgeKey] = base;
          }
          return next;
        });
      }
    };
    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDragTooltip(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const beginEdgeSegmentDrag = (event: ReactPointerEvent, edgeKey: string, segmentIndex: number, points: DiagramPoint[]) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const p1 = points[segmentIndex];
    const p2 = points[segmentIndex + 1];
    if (!p1 || !p2) {
      return;
    }
    const horizontal = Math.abs(p1.x - p2.x) >= Math.abs(p1.y - p2.y);
    const basePoints = points.map((point) => ({ ...point }));

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setManualEdgePoints((current) => {
        const next = current[edgeKey] ? current[edgeKey].map((point) => ({ ...point })) : basePoints.map((point) => ({ ...point }));
        const a = next[segmentIndex];
        const b = next[segmentIndex + 1];
        if (!a || !b) {
          return current;
        }
        if (horizontal) {
          const snappedY = snapToGrid(p1.y + dy);
          a.y = snappedY;
          b.y = snapToGrid(p2.y + dy);
        } else {
          const snappedX = snapToGrid(p1.x + dx);
          a.x = snappedX;
          b.x = snapToGrid(p2.x + dx);
        }
        setDragTooltip({
          text: `p${segmentIndex}: (${Math.round(a.x)}, ${Math.round(a.y)})  p${segmentIndex + 1}: (${Math.round(b.x)}, ${Math.round(b.y)})`,
          clientX: moveEvent.clientX,
          clientY: moveEvent.clientY
        });
        return { ...current, [edgeKey]: next };
      });
    };
    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDragTooltip(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const beginCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && (target.closest('.node') || target.closest('.edge-segment-handle'))) {
      return;
    }
    const panel = canvasPanelRef.current;
    if (!panel) {
      return;
    }
    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const startScrollLeft = panel.scrollLeft;
    const startScrollTop = panel.scrollTop;
    setIsPanning(true);

    const onMove = (moveEvent: PointerEvent) => {
      if ((moveEvent.buttons & 1) === 0) {
        return;
      }
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      panel.scrollLeft = startScrollLeft - dx;
      panel.scrollTop = startScrollTop - dy;
    };
    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setIsPanning(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return {
    canvasPanelRef,
    dragTooltip,
    isPanning,
    beginNodeDrag,
    beginEdgeSegmentDrag,
    beginCanvasPan
  };
}
