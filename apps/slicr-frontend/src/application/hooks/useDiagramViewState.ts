import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  buildOverviewDiagramGraph,
  buildRenderedEdges,
  computeDiagramLayout,
  computeOverviewDiagramLayout,
  computeProvisionalDiagramLayout
} from '../../domain/diagramEngine';
import type { DiagramPoint } from '../../domain/diagramRouting';
import type { NodeDimensions } from '../../domain/nodeSizing';
import { deriveOverviewCrossSliceLinks } from '../../domain/overviewCrossSliceLinks';
import type { ParsedSliceProjection } from '../../domain/parsedSliceProjection';
import type { Parsed, Position } from '../../domain/types';
import { measureNodeDimensions, measureScenarioGroupWidths } from '../../nodeMeasurement';
import { useDiagramInteractions } from '../../useDiagramInteractions';
import { buildSceneModel } from '../../diagram/sceneModel';
import { appendSliceEdgeMovedEvent, appendSliceNodeMovedEvent } from '../../sliceLibrary';
import type { DiagramMode } from '../appViewModel';
import type { OverviewCrossSliceLink } from '../../domain/overviewCrossSliceLinks';

type DiagramEngineResult = Awaited<ReturnType<typeof computeDiagramLayout>>;
type OverviewDiagramEngineResult = Awaited<ReturnType<typeof computeOverviewDiagramLayout>>;
type ActiveLayout = DiagramEngineResult['layout'] | OverviewDiagramEngineResult['layout'];
type RenderedEdge = ReturnType<typeof buildRenderedEdges>[number];
const EMPTY_OVERVIEW_CROSS_SLICE_LINKS: OverviewCrossSliceLink[] = [];
const EMPTY_PARSED_SLICE_PROJECTIONS: ParsedSliceProjection<Parsed>[] = [];

export type UseDiagramViewStateArgs = {
  diagramMode: DiagramMode;
  overviewNodeDataVisible: boolean;
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
  fallbackOverviewSceneModel: ReturnType<typeof buildSceneModel> | null;
};

export function useDiagramViewState(args: UseDiagramViewStateArgs) {
  const {
    diagramMode,
    overviewNodeDataVisible,
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
    pendingFocusNodeKeyRef,
    fallbackOverviewSceneModel
  } = args;

  const initializedViewportKeyRef = useRef<string | null>(null);
  const activeParsedSliceProjectionList = diagramMode === 'overview'
    ? parsedSliceProjectionList
    : EMPTY_PARSED_SLICE_PROJECTIONS;
  const overviewGraph = useMemo(
    () => (diagramMode === 'overview' ? buildOverviewDiagramGraph(activeParsedSliceProjectionList) : null),
    [activeParsedSliceProjectionList, diagramMode]
  );
  const overviewNodeMetadataByKey = overviewGraph?.nodeMetadataByKey;
  const overviewScenarioMetadataByScenario = overviewGraph?.scenarioMetadataByScenario;
  const overviewCrossSliceLinks = useMemo(
    () => (
      diagramMode === 'overview' && overviewNodeMetadataByKey
        ? deriveOverviewCrossSliceLinks(activeParsedSliceProjectionList, overviewNodeMetadataByKey)
        : EMPTY_OVERVIEW_CROSS_SLICE_LINKS
    ),
    [activeParsedSliceProjectionList, diagramMode, overviewNodeMetadataByKey]
  );
  const diagramParsed = diagramMode === 'overview' ? overviewGraph?.parsed ?? null : parsed;
  const layoutStateKey = useMemo(() => {
    if (diagramMode === 'overview') {
      return `overview:${overviewNodeDataVisible ? 'data:on' : 'data:off'}:${activeParsedSliceProjectionList.map((slice) => `${slice.id}:${slice.dsl}`).join('|')}`;
    }
    return `slice:${selectedSliceId}:${currentDsl}`;
  }, [activeParsedSliceProjectionList, currentDsl, diagramMode, overviewNodeDataVisible, selectedSliceId]);
  const [diagramEngineLayoutState, setDiagramEngineLayoutState] = useState<{
    key: string;
    layout: Awaited<ReturnType<typeof computeDiagramLayout>> | Awaited<ReturnType<typeof computeOverviewDiagramLayout>>;
  } | null>(null);
  const [nodeMeasurementState, setNodeMeasurementState] = useState<{
    key: string;
    dimensions: Record<string, NodeDimensions>;
    settled: boolean;
  } | null>(null);
  const measuredNodeDimensions = useMemo(
    () => (nodeMeasurementState?.key === layoutStateKey
      ? nodeMeasurementState.dimensions
      : {}),
    [layoutStateKey, nodeMeasurementState]
  );
  const [scenarioGroupMeasurementState, setScenarioGroupMeasurementState] = useState<{
    key: string;
    widths: Record<string, number>;
    settled: boolean;
  } | null>(null);
  const [visibleSliceSnapshotState, setVisibleSliceSnapshotState] = useState<{
    key: string;
    sliceId: string;
    sceneModel: ReturnType<typeof buildSceneModel>;
    activeLayout: ActiveLayout;
    displayedPos: Record<string, Position>;
    renderedEdges: RenderedEdge[];
  } | null>(null);
  const measuredScenarioGroupWidths = useMemo(
    () => (scenarioGroupMeasurementState?.key === layoutStateKey
      ? scenarioGroupMeasurementState.widths
      : {}),
    [layoutStateKey, scenarioGroupMeasurementState]
  );
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
      ? computeOverviewDiagramLayout(activeParsedSliceProjectionList, {
        nodeDimensions: measuredNodeDimensions,
        scenarioGroupWidths: measuredScenarioGroupWidths
      })
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
  }, [
    currentDsl,
    diagramMode,
    diagramParsed,
    layoutStateKey,
    measuredNodeDimensions,
    measuredScenarioGroupWidths,
    activeParsedSliceProjectionList
  ]);

  useLayoutEffect(() => {
    if (!diagramParsed || diagramParsed.nodes.size === 0) {
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

    queueMicrotask(() => {
      setNodeMeasurementState((previous) => {
        if (previous?.key === layoutStateKey) {
          const nextKeys = Object.keys(next);
          const previousKeys = Object.keys(previous.dimensions);
          if (
            nextKeys.length === previousKeys.length &&
            nextKeys.every(
              (key) =>
                previous.dimensions[key]?.width === next[key]?.width &&
                previous.dimensions[key]?.height === next[key]?.height
            )
          ) {
            return previous;
          }
        }
        return {
          key: layoutStateKey,
          dimensions: next,
          settled: true
        };
      });
    });
  }, [currentDsl, diagramParsed, layoutStateKey, overviewNodeDataVisible, theme]);

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
    const slicePrecomputedEdges = diagramMode === 'slice'
      ? engineLayout?.precomputedEdges
      : undefined;
    return buildRenderedEdges(diagramParsed, displayedPos, manualEdgePoints, slicePrecomputedEdges);
  }, [diagramMode, diagramParsed, displayedPos, engineLayout, manualEdgePoints]);
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

  const rawSceneModel = useMemo(
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
        overviewNodeMetadataByKey,
        overviewScenarioMetadataByScenario,
        overviewCrossSliceLinks,
        measuredScenarioGroupWidths
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
      overviewNodeMetadataByKey,
      overviewScenarioMetadataByScenario,
      overviewCrossSliceLinks,
        measuredScenarioGroupWidths
      ]
  );

  const overviewScenarioGroupKeys = diagramMode === 'overview'
    ? (rawSceneModel?.scenarioGroups ?? []).map((group) => group.key)
    : [];
  const nodeMeasurementKeys = diagramParsed
    ? [...diagramParsed.nodes.keys()].filter((key) => !diagramParsed.scenarioOnlyNodeKeys.includes(key))
    : [];
  const nodeMeasurementSettledWithoutGeometry = nodeMeasurementState?.key === layoutStateKey
    && nodeMeasurementState.settled
    && Object.keys(measuredNodeDimensions).length === 0;
  const nodeMeasurementsReady = nodeMeasurementKeys.length === 0
    || nodeMeasurementKeys.every((key) => measuredNodeDimensions[key] !== undefined)
    || nodeMeasurementSettledWithoutGeometry;
  const overviewNeedsScenarioMeasurement = overviewScenarioGroupKeys.length > 0;
  const scenarioMeasurementSettledWithoutGeometry = scenarioGroupMeasurementState?.key === layoutStateKey
    && scenarioGroupMeasurementState.settled
    && Object.keys(measuredScenarioGroupWidths).length === 0;
  const scenarioGroupMeasurementsReady = !overviewNeedsScenarioMeasurement
    || overviewScenarioGroupKeys.every((key) => measuredScenarioGroupWidths[key] !== undefined)
    || scenarioMeasurementSettledWithoutGeometry;
  const currentAsyncLayoutReady = diagramEngineLayoutState?.key === layoutStateKey;
  const layoutReady = diagramMode === 'overview'
    ? currentAsyncLayoutReady && nodeMeasurementsReady && scenarioGroupMeasurementsReady
    : currentAsyncLayoutReady && nodeMeasurementsReady;

  useEffect(() => {
    if (
      diagramMode !== 'slice'
      || !layoutReady
      || !rawSceneModel
      || !activeLayout
    ) {
      return;
    }

    queueMicrotask(() => {
      setVisibleSliceSnapshotState({
        key: layoutStateKey,
        sliceId: selectedSliceId,
        sceneModel: rawSceneModel,
        activeLayout,
        displayedPos,
        renderedEdges
      });
    });
  }, [
    activeLayout,
    diagramMode,
    displayedPos,
    layoutReady,
    layoutStateKey,
    rawSceneModel,
    renderedEdges,
    selectedSliceId
  ]);

  const visibleSliceSnapshot = diagramMode === 'slice'
    && !layoutReady
    && visibleSliceSnapshotState?.sliceId === selectedSliceId
    ? visibleSliceSnapshotState
    : null;
  const sceneModel = diagramMode === 'overview'
    ? (scenarioGroupMeasurementsReady && nodeMeasurementsReady ? rawSceneModel : fallbackOverviewSceneModel)
    : (layoutReady ? rawSceneModel : (visibleSliceSnapshot?.sceneModel ?? null));
  const visibleActiveLayout = visibleSliceSnapshot?.activeLayout ?? activeLayout;
  const visibleDisplayedPos = visibleSliceSnapshot?.displayedPos ?? displayedPos;
  const visibleRenderedEdges = visibleSliceSnapshot?.renderedEdges ?? renderedEdges;
  const interactionDragAndDropEnabled = dragAndDropEnabled && layoutReady;

  const {
    canvasPanelRef,
    dragTooltip,
    isPanning,
    beginNodeDrag,
    beginEdgeSegmentDrag,
    beginCanvasPan
  } = useDiagramInteractions({
    interactionsEnabled: layoutReady,
    dragAndDropEnabled: interactionDragAndDropEnabled,
    displayedPos: visibleDisplayedPos,
    renderedEdges: visibleRenderedEdges,
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

  useLayoutEffect(() => {
    if (diagramMode !== 'overview' || !rawSceneModel?.scenarioGroups || rawSceneModel.scenarioGroups.length === 0) {
      queueMicrotask(() => {
        setScenarioGroupMeasurementState((previous) => {
          if (previous?.key === layoutStateKey && Object.keys(previous.widths).length === 0) {
            return previous;
          }
          return { key: layoutStateKey, widths: {}, settled: true };
        });
      });
      return;
    }

    const measured = measureScenarioGroupWidths(document);
    queueMicrotask(() => {
      setScenarioGroupMeasurementState((previous) => {
        if (previous?.key === layoutStateKey) {
          const nextKeys = Object.keys(measured);
          const previousKeys = Object.keys(previous.widths);
          if (
            nextKeys.length === previousKeys.length &&
            nextKeys.every((key) => previous.widths[key] === measured[key])
          ) {
            return previous;
          }
        }
        return {
          key: layoutStateKey,
          widths: measured,
          settled: true
        };
      });
    });
  }, [diagramMode, rawSceneModel, theme, layoutStateKey]);

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
    if (
      !pendingFocusNodeKey
      || !sceneModel?.viewport
      || (diagramMode === 'slice' && !layoutReady)
    ) {
      return;
    }
    if (diagramRendererId !== 'dom-svg') {
      pendingFocusNodeKeyRef.current = null;
      return;
    }
    const panel = canvasPanelRef.current;
    const position = visibleDisplayedPos[pendingFocusNodeKey];
    if (!panel || !position) {
      return;
    }

    const targetX = sceneModel.viewport.offsetX + position.x + position.w / 2 - panel.clientWidth / 2;
    const targetY = sceneModel.viewport.offsetY + position.y + position.h / 2 - panel.clientHeight / 2;
    panel.scrollLeft = Math.max(0, targetX);
    panel.scrollTop = Math.max(0, targetY);
    pendingFocusNodeKeyRef.current = null;
  }, [canvasPanelRef, diagramMode, diagramRendererId, focusRequestVersion, layoutReady, pendingFocusNodeKeyRef, sceneModel, visibleDisplayedPos]);

  return {
    parsed: diagramParsed,
    sceneModel,
    layoutReady,
    dragAndDropEnabled: interactionDragAndDropEnabled,
    measurementScenarioGroups: diagramMode === 'overview'
      ? (rawSceneModel?.scenarioGroups ?? [])
      : [],
    initialCamera,
    rendererViewportKey,
    dragTooltip,
    isPanning,
    beginNodeDrag,
    beginEdgeSegmentDrag,
    beginCanvasPan,
    canvasPanelRef,
    displayedPos: visibleDisplayedPos,
    renderedEdges: visibleRenderedEdges,
    activeLayout: visibleActiveLayout
  };
}
