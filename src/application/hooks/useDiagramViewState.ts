import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildRenderedEdges, computeDiagramLayout, computeProvisionalDiagramLayout } from '../../domain/diagramEngine';
import type { DiagramPoint } from '../../domain/diagramRouting';
import type { NodeDimensions } from '../../domain/nodeSizing';
import type { Parsed, Position } from '../../domain/types';
import { measureNodeDimensions } from '../../nodeMeasurement';
import { useDiagramInteractions } from '../../useDiagramInteractions';
import { buildSceneModel } from '../../diagram/sceneModel';
import { appendSliceEdgeMovedEvent, appendSliceNodeMovedEvent } from '../../sliceLibrary';

export type UseDiagramViewStateArgs = {
  parsed: Parsed | null;
  currentDsl: string;
  theme: string;
  diagramRendererId: string;
  selectedSliceId: string;
  dragAndDropEnabled: boolean;
  manualNodePositions: Record<string, { x: number; y: number }>;
  manualEdgePoints: Record<string, DiagramPoint[]>;
  setManualNodePositions: Dispatch<SetStateAction<Record<string, { x: number; y: number }>>>;
  setManualEdgePoints: Dispatch<SetStateAction<Record<string, DiagramPoint[]>>>;
  hoveredEditorRange: { from: number; to: number } | null;
  selectedNodeKey: string | null;
  hoveredEdgeKey: string | null;
  hoveredTraceNodeKey: string | null;
  focusRequestVersion: number;
  pendingFocusNodeKeyRef: MutableRefObject<string | null>;
};

export function useDiagramViewState(args: UseDiagramViewStateArgs) {
  const {
    parsed,
    currentDsl,
    theme,
    diagramRendererId,
    selectedSliceId,
    dragAndDropEnabled,
    manualNodePositions,
    manualEdgePoints,
    setManualNodePositions,
    setManualEdgePoints,
    hoveredEditorRange,
    selectedNodeKey,
    hoveredEdgeKey,
    hoveredTraceNodeKey,
    focusRequestVersion,
    pendingFocusNodeKeyRef
  } = args;

  const initializedViewportKeyRef = useRef<string | null>(null);
  const [diagramEngineLayoutState, setDiagramEngineLayoutState] = useState<{
    dsl: string;
    layout: Awaited<ReturnType<typeof computeDiagramLayout>>;
  } | null>(null);
  const [measuredNodeDimensions, setMeasuredNodeDimensions] = useState<Record<string, NodeDimensions>>({});
  const provisionalEngineLayout = useMemo(() => {
    if (!parsed || parsed.nodes.size === 0) {
      return null;
    }
    return computeProvisionalDiagramLayout(parsed, { nodeDimensions: measuredNodeDimensions });
  }, [parsed, measuredNodeDimensions]);

  useEffect(() => {
    if (!parsed || parsed.nodes.size === 0) {
      return;
    }
    let active = true;
    computeDiagramLayout(parsed, { nodeDimensions: measuredNodeDimensions })
      .then((result) => {
        if (!active) {
          return;
        }
        setDiagramEngineLayoutState({ dsl: currentDsl, layout: result });
      })
      .catch(() => {
        // Ignore async layout failures and keep the provisional layout.
      });

    return () => {
      active = false;
    };
  }, [parsed, measuredNodeDimensions, currentDsl]);

  useEffect(() => {
    if (!parsed || parsed.nodes.size === 0) {
      return;
    }

    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) {
        return;
      }

      const measured = measureNodeDimensions(document);
      const parsedKeys = [...parsed.nodes.keys()];
      const next: Record<string, NodeDimensions> = {};
      for (const key of parsedKeys) {
        if (measured[key] !== undefined) {
          next[key] = measured[key];
        }
      }

      setMeasuredNodeDimensions((previous) => {
        const nextKeys = Object.keys(next);
        const previousKeys = Object.keys(previous);
        if (
          nextKeys.length === previousKeys.length &&
          nextKeys.every(
            (key) =>
              previous[key]?.width === next[key]?.width &&
              previous[key]?.height === next[key]?.height
          )
        ) {
          return previous;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [parsed, currentDsl, theme]);

  const engineLayout = diagramEngineLayoutState?.dsl === currentDsl
    ? diagramEngineLayoutState.layout
    : provisionalEngineLayout;
  const activeLayout = engineLayout?.layout ?? null;

  const displayedPos = useMemo(() => {
    if (!activeLayout) {
      return {};
    }
    const next: Record<string, Position> = {};
    for (const [key, position] of Object.entries(activeLayout.pos)) {
      const manual = manualNodePositions[key];
      next[key] = manual ? { ...position, x: manual.x, y: manual.y } : position;
    }
    return next;
  }, [activeLayout, manualNodePositions]);

  const renderedEdges = useMemo(() => {
    if (!parsed) {
      return [] as Array<{ key: string; edgeKey: string; edge: Parsed['edges'][number]; geometry: { d: string; labelX: number; labelY: number; points?: DiagramPoint[] } }>;
    }
    return buildRenderedEdges(parsed, displayedPos, manualEdgePoints);
  }, [parsed, displayedPos, manualEdgePoints]);

  const {
    canvasPanelRef,
    dragTooltip,
    isPanning,
    beginNodeDrag,
    beginEdgeSegmentDrag,
    beginCanvasPan
  } = useDiagramInteractions({
    dragAndDropEnabled,
    displayedPos,
    renderedEdges,
    manualEdgePoints,
    setManualNodePositions,
    setManualEdgePoints,
    onNodeDragCommit: (nodeKey, point) => {
      appendSliceNodeMovedEvent(selectedSliceId, nodeKey, point);
    },
    onEdgeDragCommit: (edgeKey, points) => {
      appendSliceEdgeMovedEvent(selectedSliceId, edgeKey, points);
    }
  });

  const activeNodeKeyFromEditor = useMemo(() => {
    if (!hoveredEditorRange || !parsed) {
      return null;
    }
    const pos = hoveredEditorRange.from;
    for (const node of parsed.nodes.values()) {
      if (pos >= node.srcRange.from && pos <= node.srcRange.to) {
        return node.key;
      }
    }
    return null;
  }, [hoveredEditorRange, parsed]);

  const sceneModel = useMemo(
    () =>
      buildSceneModel({
        parsed,
        activeLayout,
        displayedPos,
        renderedEdges,
        engineLayout,
        activeNodeKeyFromEditor,
        selectedNodeKey,
        hoveredEdgeKey,
        hoveredTraceNodeKey
      }),
    [
      parsed,
      activeLayout,
      displayedPos,
      renderedEdges,
      engineLayout,
      activeNodeKeyFromEditor,
      selectedNodeKey,
      hoveredEdgeKey,
      hoveredTraceNodeKey
    ]
  );

  const initialCamera = useMemo(() => {
    if (diagramRendererId !== 'dom-svg-camera' || !sceneModel?.viewport) {
      return undefined;
    }
    const targetPadding = 80;
    return {
      x: Math.min(0, targetPadding - sceneModel.viewport.offsetX),
      y: Math.min(0, targetPadding - sceneModel.viewport.offsetY),
      zoom: 1
    };
  }, [diagramRendererId, sceneModel]);

  const rendererViewportKey = `${diagramRendererId}:${selectedSliceId}`;

  useEffect(() => {
    const panel = canvasPanelRef.current;
    if (!panel || !sceneModel?.viewport) {
      return;
    }
    const viewportKey = selectedSliceId;
    if (initializedViewportKeyRef.current === viewportKey) {
      return;
    }
    if (diagramRendererId !== 'dom-svg') {
      panel.scrollLeft = 0;
      panel.scrollTop = 0;
      initializedViewportKeyRef.current = viewportKey;
      return;
    }
    panel.scrollLeft = Math.max(0, sceneModel.viewport.offsetX - 80);
    panel.scrollTop = Math.max(0, sceneModel.viewport.offsetY - 80);
    initializedViewportKeyRef.current = viewportKey;
  }, [canvasPanelRef, sceneModel, selectedSliceId, diagramRendererId]);

  useEffect(() => {
    const pendingFocusNodeKey = pendingFocusNodeKeyRef.current;
    if (!pendingFocusNodeKey || !sceneModel?.viewport) {
      return;
    }
    if (diagramRendererId !== 'dom-svg') {
      pendingFocusNodeKeyRef.current = null;
      return;
    }
    const panel = canvasPanelRef.current;
    const position = displayedPos[pendingFocusNodeKey];
    if (!panel || !position) {
      return;
    }

    const targetX = sceneModel.viewport.offsetX + position.x + position.w / 2 - panel.clientWidth / 2;
    const targetY = sceneModel.viewport.offsetY + position.y + position.h / 2 - panel.clientHeight / 2;
    panel.scrollLeft = Math.max(0, targetX);
    panel.scrollTop = Math.max(0, targetY);
    pendingFocusNodeKeyRef.current = null;
  }, [focusRequestVersion, sceneModel, displayedPos, canvasPanelRef, diagramRendererId, pendingFocusNodeKeyRef]);

  return {
    sceneModel,
    initialCamera,
    rendererViewportKey,
    dragTooltip,
    isPanning,
    beginNodeDrag,
    beginEdgeSegmentDrag,
    beginCanvasPan,
    canvasPanelRef,
    displayedPos,
    renderedEdges,
    activeLayout
  };
}
