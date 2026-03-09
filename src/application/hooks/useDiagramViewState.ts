import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildOverviewDiagramGraph,
  buildRenderedEdges,
  computeDiagramLayout,
  computeOverviewDiagramLayout,
  computeProvisionalDiagramLayout
} from '../../domain/diagramEngine';
import type { DiagramPoint } from '../../domain/diagramRouting';
import type { NodeDimensions } from '../../domain/nodeSizing';
import type { ParsedSliceProjection } from '../../domain/parsedSliceProjection';
import type { Parsed, Position } from '../../domain/types';
import { measureNodeDimensions } from '../../nodeMeasurement';
import { useDiagramInteractions } from '../../useDiagramInteractions';
import { buildSceneModel } from '../../diagram/sceneModel';
import { appendSliceEdgeMovedEvent, appendSliceNodeMovedEvent } from '../../sliceLibrary';
import type { DiagramMode } from '../appViewModel';

export type UseDiagramViewStateArgs = {
  diagramMode: DiagramMode;
  parsed: Parsed | null;
  parsedSliceProjectionList: ParsedSliceProjection<Parsed>[];
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
    diagramMode,
    parsed,
    parsedSliceProjectionList,
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
  const overviewGraph = useMemo(
    () => (diagramMode === 'overview' ? buildOverviewDiagramGraph(parsedSliceProjectionList) : null),
    [diagramMode, parsedSliceProjectionList]
  );
  const overviewNodeMetadataByKey = overviewGraph?.nodeMetadataByKey;
  const diagramParsed = diagramMode === 'overview' ? overviewGraph?.parsed ?? null : parsed;
  const layoutStateKey = useMemo(() => {
    if (diagramMode === 'overview') {
      return `overview:${parsedSliceProjectionList.map((slice) => `${slice.id}:${slice.dsl}`).join('|')}`;
    }
    return `slice:${selectedSliceId}:${currentDsl}`;
  }, [currentDsl, diagramMode, parsedSliceProjectionList, selectedSliceId]);
  const [diagramEngineLayoutState, setDiagramEngineLayoutState] = useState<{
    key: string;
    layout: Awaited<ReturnType<typeof computeDiagramLayout>> | Awaited<ReturnType<typeof computeOverviewDiagramLayout>>;
  } | null>(null);
  const [measuredNodeDimensions, setMeasuredNodeDimensions] = useState<Record<string, NodeDimensions>>({});
  const provisionalEngineLayout = useMemo(() => {
    if (!diagramParsed || diagramParsed.nodes.size === 0) {
      return null;
    }
    return computeProvisionalDiagramLayout(diagramParsed, { nodeDimensions: measuredNodeDimensions });
  }, [diagramParsed, measuredNodeDimensions]);

  useEffect(() => {
    if (!diagramParsed || diagramParsed.nodes.size === 0) {
      return;
    }
    let active = true;
    const computeLayout = diagramMode === 'overview'
      ? computeOverviewDiagramLayout(parsedSliceProjectionList, { nodeDimensions: measuredNodeDimensions })
      : computeDiagramLayout(diagramParsed, { nodeDimensions: measuredNodeDimensions });
    computeLayout
      .then((result) => {
        if (!active) {
          return;
        }
        setDiagramEngineLayoutState({ key: layoutStateKey, layout: result });
      })
      .catch(() => {
        // Ignore async layout failures and keep the provisional layout.
      });

    return () => {
      active = false;
    };
  }, [currentDsl, diagramMode, diagramParsed, layoutStateKey, measuredNodeDimensions, parsedSliceProjectionList]);

  useEffect(() => {
    if (!diagramParsed || diagramParsed.nodes.size === 0) {
      return;
    }

    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) {
        return;
      }

      const measured = measureNodeDimensions(document);
      const parsedKeys = [...diagramParsed.nodes.keys()];
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
  }, [currentDsl, diagramParsed, theme]);

  const engineLayout = diagramEngineLayoutState?.key === layoutStateKey
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
    if (!diagramParsed) {
      return [] as Array<{ key: string; edgeKey: string; edge: Parsed['edges'][number]; geometry: { d: string; labelX: number; labelY: number; points?: DiagramPoint[] } }>;
    }
    return buildRenderedEdges(diagramParsed, displayedPos, manualEdgePoints);
  }, [diagramParsed, displayedPos, manualEdgePoints]);

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
    if (!hoveredEditorRange || !diagramParsed) {
      return null;
    }
    const pos = hoveredEditorRange.from;
    for (const node of diagramParsed.nodes.values()) {
      if (pos >= node.srcRange.from && pos <= node.srcRange.to) {
        return node.key;
      }
    }
    return null;
  }, [hoveredEditorRange, diagramParsed]);

  const sceneModel = useMemo(
    () =>
      buildSceneModel({
        parsed: diagramParsed,
        activeLayout,
        displayedPos,
        renderedEdges,
        engineLayout,
        activeNodeKeyFromEditor,
        selectedNodeKey,
        hoveredEdgeKey,
        hoveredTraceNodeKey,
        overviewNodeMetadataByKey
      }),
    [
      diagramParsed,
      activeLayout,
      displayedPos,
      renderedEdges,
      engineLayout,
      activeNodeKeyFromEditor,
      selectedNodeKey,
      hoveredEdgeKey,
      hoveredTraceNodeKey,
      overviewNodeMetadataByKey
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
    parsed: diagramParsed,
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
