import {Dispatch, SetStateAction, useEffect, useMemo, useRef, useState} from 'react';
import {DEFAULT_DSL} from '../defaultDsl';
import {
  buildRenderedEdges,
  computeClassicDiagramLayout,
  computeDiagramLayout,
  DiagramEngineId,
  DiagramEngineLayout
} from '../domain/diagramEngine';
import {MISSING_DATA_VALUE} from '../domain/dataMapping';
import {DiagramEdgeGeometry, DiagramPoint} from '../domain/diagramRouting';
import {formatNodeData} from '../domain/formatNodeData';
import {parseDsl} from '../domain/parseDsl';
import {
  getDiagramRendererId,
  isCrossSliceDataEnabled,
  isDragAndDropEnabled,
  shouldShowDevDiagramControls
} from '../domain/runtimeFlags';
import { createCrossSliceUsageQueryFromParsed } from '../domain/crossSliceUsage';
import { getCrossSliceDataFromParsed } from '../domain/crossSliceData';
import { collectDataIssues, getAmbiguousSourceCandidates } from '../domain/dataIssues';
import { parseUsesBlocks } from '../domain/dataMapping';
import { traceData } from '../domain/dataTrace';
import type { NodeDimensions } from '../domain/nodeSizing';
import { toNodeAnalysisRef, toNodeAnalysisRefFromNode } from '../domain/nodeAnalysisKey';
import { measureNodeDimensions, NODE_MEASURE_NODE_CLASS } from '../nodeMeasurement';
import type {Parsed, Position} from '../domain/types';
import { useParsedSliceProjection } from '../useParsedSliceProjection';
import {
  addNewSlice,
  appendSliceEdgeMovedEvent,
  appendSliceLayoutResetEvent,
  appendSliceNodeMovedEvent,
  getSliceNameFromDsl,
  loadSliceLayoutOverrides,
  loadSliceLibrary,
  saveSliceLayoutOverrides,
  saveSliceLibrary,
  selectSlice,
  SliceLibrary,
  updateSelectedSliceDsl
} from '../sliceLibrary';
import {EditorWarning, Range, useDslEditor} from '../useDslEditor';
import {useDiagramInteractions} from '../useDiagramInteractions';
import { buildSceneModel } from '../diagram/sceneModel';
import { getDiagramRenderer } from '../diagram/rendererRegistry';

type ParseResult =
  | { parsed: Parsed; error: ''; warnings: Parsed['warnings'] }
  | { parsed: null; error: string; warnings: [] };

const TYPE_LABEL: Record<string, string> = {
  rm: 'rm',
  cmd: 'cmd',
  evt: 'evt',
  exc: 'exc',
  ui: 'ui',
  generic: '',
  aut: 'aut',
  ext: 'ext'
};

const NODE_VERSION_SUFFIX = /@\d+$/;
const THEME_STORAGE_KEY = 'slicr.theme';
const ROUTE_MODE_STORAGE_KEY = 'slicr.routeMode';
type ThemeMode = 'dark' | 'light';
type RouteMode = DiagramEngineId;
type EdgeGeometry = DiagramEdgeGeometry;

function formatTraceSource(source: unknown): string {
  const fields = formatNodeData({ value: source });
  return fields[0]?.text ?? 'value: undefined';
}

export function useAppState() {
  const [initialSnapshot] = useState<{
    library: SliceLibrary;
    overrides: ReturnType<typeof loadSliceLayoutOverrides>;
  }>(() => {
    const initialLibrary = loadSliceLibrary();
    return {
      library: initialLibrary,
      overrides: loadSliceLayoutOverrides(initialLibrary.selectedSliceId)
    };
  });
  const [library, setLibrary] = useState(initialSnapshot.library);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sliceMenuRef = useRef<HTMLDivElement>(null);
  const routeMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const skipNextLayoutSaveRef = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorMountRef = useRef<HTMLDivElement>(null);
  const [highlightRange, setHighlightRange] = useState<Range | null>(null);
  const [hoveredEditorRange, setHoveredEditorRange] = useState<Range | null>(null);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);
  const [diagramRendererId] = useState(() => getDiagramRendererId(window.location.hostname));
  const [routeMode, setRouteMode] = useState<RouteMode>(() => {
    try {
      const saved = localStorage.getItem(ROUTE_MODE_STORAGE_KEY);
      return saved === 'classic' ? 'classic' : 'elk';
    } catch {
      return 'elk';
    }
  });
  const [docsOpen, setDocsOpen] = useState(false);
  const [hasOpenedDocs, setHasOpenedDocs] = useState(false);
  const [diagramEngineLayout, setDiagramEngineLayout] = useState<DiagramEngineLayout | null>(null);
  const [sliceMenuOpen, setSliceMenuOpen] = useState(false);
  const [routeMenuOpen, setRouteMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedNodePanelTab, setSelectedNodePanelTab] = useState<'usage' | 'crossSliceData' | 'trace'>('usage');
  const [sourceOverrides, setSourceOverrides] = useState<Record<string, string>>({});
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [hoveredTraceNodeKey, setHoveredTraceNodeKey] = useState<string | null>(null);
  const [crossSliceDataExpandedKeys, setCrossSliceDataExpandedKeys] = useState<Record<string, boolean>>({});
  const [crossSliceTraceExpandedKeys, setCrossSliceTraceExpandedKeys] = useState<Record<string, boolean>>({});
  const [manualNodePositions, setManualNodePositions] = useState<Record<string, { x: number; y: number }>>(
    initialSnapshot.overrides.nodes
  );
  const [manualEdgePoints, setManualEdgePoints] = useState<Record<string, DiagramPoint[]>>(
    initialSnapshot.overrides.edges
  );
  const [measuredNodeDimensions, setMeasuredNodeDimensions] = useState<Record<string, NodeDimensions>>({});
  const [focusRequestVersion, setFocusRequestVersion] = useState(0);
  const pendingFocusNodeKeyRef = useRef<string | null>(null);
  const initializedViewportKeyRef = useRef<string | null>(null);
  const hasManualLayoutOverrides =
    Object.keys(manualNodePositions).length > 0 || Object.keys(manualEdgePoints).length > 0;
  const showDevDiagramControls = shouldShowDevDiagramControls(window.location.hostname);
  const dragAndDropEnabled = isDragAndDropEnabled(window.location.hostname);
  const crossSliceDataEnabled = isCrossSliceDataEnabled(window.location.hostname);
  const currentSlice =
    library.slices.find((slice) => slice.id === library.selectedSliceId) ?? library.slices[0];
  const currentDsl = currentSlice?.dsl ?? DEFAULT_DSL;
  const sliceDocuments = useMemo(
    () => library.slices.map((slice) => ({ id: slice.id, dsl: slice.dsl })),
    [library.slices]
  );
  const { bySliceId: parsedSliceProjections, list: parsedSliceProjectionList } = useParsedSliceProjection(
    sliceDocuments
  );
  const currentSliceProjection = useMemo(
    () => (currentSlice ? parsedSliceProjections.get(currentSlice.id) ?? null : null),
    [currentSlice, parsedSliceProjections]
  );
  const DiagramRenderer = useMemo(() => getDiagramRenderer(diagramRendererId), [diagramRendererId]);

  const setCurrentDsl: Dispatch<SetStateAction<string>> = (updater) => {
    setLibrary((currentLibrary) => {
      const selected =
        currentLibrary.slices.find((slice) => slice.id === currentLibrary.selectedSliceId) ?? currentLibrary.slices[0];
      if (!selected) {
        return currentLibrary;
      }

      const nextDsl = typeof updater === 'function' ? updater(selected.dsl) : updater;
      if (nextDsl === selected.dsl) {
        return currentLibrary;
      }
      return updateSelectedSliceDsl(currentLibrary, nextDsl);
    });
  };

  const parseResult = useMemo<ParseResult>(() => {
    if (currentSliceProjection && currentSliceProjection.dsl === currentDsl) {
      return { parsed: currentSliceProjection.parsed, error: '', warnings: currentSliceProjection.parsed.warnings };
    }
    try {
      const parsed = parseDsl(currentDsl);
      return { parsed, error: '', warnings: parsed.warnings };
    } catch (error) {
      return { parsed: null, error: `⚠ ${(error as Error).message}`, warnings: [] };
    }
  }, [currentDsl, currentSliceProjection]);

  const parsed = parseResult.parsed;
  const errorText = parseResult.error;
  const currentSliceName = getSliceNameFromDsl(currentDsl);

  const { collapseAllDataRegions, collapseAllRegions, expandAllRegions, focusRange } = useDslEditor({
    dsl: currentDsl,
    onDslChange: setCurrentDsl,
    onRangeHover: setHoveredEditorRange,
    editorMountRef,
    highlightRange,
    warnings: parseResult.warnings.map<EditorWarning>((warning) => ({
      range: warning.range,
      message: warning.message,
      level: warning.level
    }))
  });

  useEffect(() => {
    try {
      saveSliceLibrary(library);
    } catch {
      // Ignore storage failures (e.g. restricted environments).
    }
  }, [library]);

  useEffect(() => {
    if (skipNextLayoutSaveRef.current) {
      skipNextLayoutSaveRef.current = false;
      return;
    }
    try {
      saveSliceLayoutOverrides(library.selectedSliceId, {
        nodes: manualNodePositions,
        edges: manualEdgePoints
      }, { emitEvents: false });
    } catch {
      // Ignore storage failures (e.g. restricted environments).
    }
  }, [library.selectedSliceId, manualNodePositions, manualEdgePoints]);

  const classicEngineLayout = useMemo(() => {
    if (!parsed || parsed.nodes.size === 0) {
      return null;
    }
    return computeClassicDiagramLayout(parsed, { nodeDimensions: measuredNodeDimensions });
  }, [parsed, measuredNodeDimensions]);

  useEffect(() => {
    if (routeMode !== 'elk' || !parsed || parsed.nodes.size === 0) {
      return;
    }
    let active = true;
    computeDiagramLayout(parsed, 'elk', { nodeDimensions: measuredNodeDimensions })
      .then((result) => {
        if (!active) {
          return;
        }
        setDiagramEngineLayout(result);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setDiagramEngineLayout(null);
      });

    return () => {
      active = false;
    };
  }, [routeMode, parsed, measuredNodeDimensions]);

  useEffect(() => {
    if (!crossSliceDataEnabled && selectedNodePanelTab === 'crossSliceData') {
      setSelectedNodePanelTab('usage');
    }
  }, [crossSliceDataEnabled, selectedNodePanelTab]);

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

  const engineLayout = routeMode === 'elk'
    ? (diagramEngineLayout ?? classicEngineLayout)
    : classicEngineLayout;
  const activeLayout = engineLayout?.layout ?? null;

  const displayedPos = useMemo(() => {
    if (!activeLayout) {
      return {};
    }
    const next: Record<string, Position> = {};
    for (const [key, position] of Object.entries(activeLayout.pos)) {
      const manual = manualNodePositions[key];
      next[key] = manual
        ? { ...position, x: manual.x, y: manual.y }
        : position;
    }
    return next;
  }, [activeLayout, manualNodePositions]);

  const renderedEdges = useMemo(() => {
    if (!parsed) {
      return [] as Array<{ key: string; edgeKey: string; edge: Parsed['edges'][number]; geometry: EdgeGeometry }>;
    }
    return buildRenderedEdges(parsed, displayedPos, routeMode, manualEdgePoints);
  }, [parsed, displayedPos, routeMode, manualEdgePoints]);

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
      appendSliceNodeMovedEvent(library.selectedSliceId, nodeKey, point);
    },
    onEdgeDragCommit: (edgeKey, points) => {
      appendSliceEdgeMovedEvent(library.selectedSliceId, edgeKey, points);
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

  const sceneModel = useMemo(() => buildSceneModel({
    parsed,
    activeLayout,
    displayedPos,
    renderedEdges,
    routeMode,
    engineLayout,
    activeNodeKeyFromEditor,
    selectedNodeKey,
    hoveredEdgeKey,
    hoveredTraceNodeKey
  }), [
    parsed,
    activeLayout,
    displayedPos,
    renderedEdges,
    routeMode,
    engineLayout,
    activeNodeKeyFromEditor,
    selectedNodeKey,
    hoveredEdgeKey,
    hoveredTraceNodeKey
  ]);

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

  const rendererViewportKey = `${diagramRendererId}:${library.selectedSliceId}:${routeMode}`;

  useEffect(() => {
    const panel = canvasPanelRef.current;
    if (!panel || !sceneModel?.viewport) {
      return;
    }
    const viewportKey = `${library.selectedSliceId}:${routeMode}`;
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
  }, [canvasPanelRef, sceneModel, library.selectedSliceId, routeMode, diagramRendererId]);

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
  }, [focusRequestVersion, sceneModel, displayedPos, canvasPanelRef, diagramRendererId]);

  const selectedNode = useMemo(() => {
    if (!parsed || !selectedNodeKey) {
      return null;
    }
    return parsed.nodes.get(selectedNodeKey) ?? null;
  }, [parsed, selectedNodeKey]);
  const showDataTraceTab = selectedNode ? !isScenarioNodeKey(selectedNode.key) : false;

  useEffect(() => {
    if (!showDataTraceTab && selectedNodePanelTab === 'trace') {
      setSelectedNodePanelTab('usage');
    }
  }, [selectedNodePanelTab, showDataTraceTab]);

  const selectedNodeAnalysisRef = useMemo(() => {
    if (!selectedNode) {
      return null;
    }
    return toNodeAnalysisRefFromNode(selectedNode);
  }, [selectedNode]);

  const selectedNodeAnalysisHeader = useMemo(() => {
    if (!selectedNodeAnalysisRef) {
      return { type: '', key: '' };
    }
    const splitAt = selectedNodeAnalysisRef.indexOf(':');
    if (splitAt < 0) {
      return { type: '', key: selectedNodeAnalysisRef };
    }
    return {
      type: selectedNodeAnalysisRef.slice(0, splitAt),
      key: selectedNodeAnalysisRef.slice(splitAt + 1)
    };
  }, [selectedNodeAnalysisRef]);

  const selectedNodeAnalysisNodes = useMemo(() => {
    if (!parsed || !selectedNodeAnalysisRef || !selectedNode) {
      return [];
    }
    if (isScenarioNodeKey(selectedNode.key)) {
      return [selectedNode];
    }
    return [...parsed.nodes.values()].filter((node) => toNodeAnalysisRefFromNode(node) === selectedNodeAnalysisRef);
  }, [parsed, selectedNode, selectedNodeAnalysisRef]);

  const usesMappingsByRef = useMemo(() => parseUsesBlocks(currentDsl), [currentDsl]);

  const crossSliceUsage = useMemo(() => {
    if (!selectedNodeAnalysisRef) {
      return [];
    }
    const query = createCrossSliceUsageQueryFromParsed(parsedSliceProjectionList);
    return query.getCrossSliceUsage(selectedNodeAnalysisRef);
  }, [parsedSliceProjectionList, selectedNodeAnalysisRef]);

  const dataIssues = useMemo(() => {
    if (!parsed) {
      return [];
    }
    return collectDataIssues({
      dsl: currentDsl,
      nodes: parsed.nodes,
      edges: parsed.edges,
      sliceId: library.selectedSliceId,
      sourceOverrides
    });
  }, [currentDsl, library.selectedSliceId, parsed, sourceOverrides]);

  const selectedNodeIssues = useMemo(() => {
    if (!selectedNodeAnalysisRef || !selectedNode) {
      return [];
    }
    if (isScenarioNodeKey(selectedNode.key)) {
      return dataIssues.filter((issue) => issue.nodeKey === selectedNode.key);
    }
    return dataIssues.filter((issue) => toNodeAnalysisRef(issue.nodeRef) === selectedNodeAnalysisRef);
  }, [dataIssues, selectedNode, selectedNodeAnalysisRef]);

  const selectedNodeIssuesByKey = useMemo(() => {
    const grouped: Record<string, typeof selectedNodeIssues> = {};
    for (const issue of selectedNodeIssues) {
      grouped[issue.key] ??= [];
      grouped[issue.key].push(issue);
    }
    return grouped;
  }, [selectedNodeIssues]);

  const missingSourceIssueKeys = useMemo(() => (
    new Set(selectedNodeIssues
      .filter((issue) => issue.code === 'missing-source')
      .map((issue) => issue.key))
  ), [selectedNodeIssues]);

  const selectedNodeUsesKeys = useMemo(() => {
    if (selectedNodeAnalysisNodes.length === 0) {
      return [];
    }
    const seen = new Set<string>();
    for (const node of selectedNodeAnalysisNodes) {
      const mappings = getUsesMappingsForNode(usesMappingsByRef, node);
      for (const mapping of mappings) {
        seen.add(mapping.targetKey);
      }
    }
    return [...seen].sort((left, right) => left.localeCompare(right));
  }, [selectedNodeAnalysisNodes, usesMappingsByRef]);

  const selectedNodeCrossSliceData = useMemo(() => {
    if (!selectedNodeAnalysisRef) {
      return { keys: [], byKey: {} };
    }
    return getCrossSliceDataFromParsed(
      parsedSliceProjectionList,
      selectedNodeAnalysisRef
    );
  }, [parsedSliceProjectionList, selectedNodeAnalysisRef]);

  const selectedNodeTraceResultsByKey = useMemo(() => {
    if (!parsed) {
      return {} as Record<string, Array<{ nodeKey: string; result: NonNullable<ReturnType<typeof traceData>> }>>;
    }

    const byKey: Record<string, Array<{ nodeKey: string; result: NonNullable<ReturnType<typeof traceData>> }>> = {};
    for (const traceKey of selectedNodeUsesKeys) {
      const matchingNodeKeys = selectedNodeAnalysisNodes
        .filter((node) => {
          const mappings = getUsesMappingsForNode(usesMappingsByRef, node);
          return mappings.some((mapping) => mapping.targetKey === traceKey);
        })
        .map((node) => node.key);

      const traceNodeKeys = matchingNodeKeys.length > 0
        ? matchingNodeKeys
        : (selectedNode ? [selectedNode.key] : []);

      byKey[traceKey] = traceNodeKeys
        .map((nodeKey) => ({
          nodeKey,
          result: traceData({ dsl: currentDsl, nodes: parsed.nodes, edges: parsed.edges }, nodeKey, traceKey)
        }))
        .filter((entry): entry is { nodeKey: string; result: NonNullable<ReturnType<typeof traceData>> } => entry.result !== null);
    }

    return byKey;
  }, [currentDsl, parsed, selectedNode, selectedNodeAnalysisNodes, selectedNodeUsesKeys, usesMappingsByRef]);

  const crossSliceUsageEntries = useMemo(() => {
    return crossSliceUsage.map((usage) => {
      const projection = parsedSliceProjections.get(usage.sliceId) ?? null;
      const sliceName = projection ? getSliceNameFromDsl(projection.dsl) : usage.sliceId;
      const usageNode = projection ? projection.parsed.nodes.get(usage.nodeKey) ?? null : null;
      return {
        usage,
        sliceName,
        node: usageNode
      };
    });
  }, [crossSliceUsage, parsedSliceProjections]);

  const crossSliceUsageGroups = useMemo(() => {
    const grouped = new Map<string, { sliceId: string; sliceName: string; entries: typeof crossSliceUsageEntries }>();
    for (const entry of crossSliceUsageEntries) {
      const existing = grouped.get(entry.usage.sliceId);
      if (existing) {
        existing.entries.push(entry);
        continue;
      }
      grouped.set(entry.usage.sliceId, {
        sliceId: entry.usage.sliceId,
        sliceName: entry.usage.sliceId === library.selectedSliceId
          ? `${entry.sliceName} (this Slice)`
          : entry.sliceName,
        entries: [entry]
      });
    }
    return [...grouped.values()]
      .map((group) => ({
        ...group,
        entries: [...group.entries].sort((left, right) => left.usage.nodeKey.localeCompare(right.usage.nodeKey))
      }));
  }, [crossSliceUsageEntries, library.selectedSliceId]);

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (!editorOpen) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const clickedEditor = editorRef.current?.contains(target) ?? false;
      const clickedToggle = toggleRef.current?.contains(target) ?? false;

      if (!clickedEditor && !clickedToggle) {
        setEditorOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [editorOpen]);

  useEffect(() => {
    const deselectOnCanvasClick = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const canvas = document.getElementById('canvas');
      const targetElement = target as HTMLElement;
      const isCanvasClick = canvas?.contains(target) ?? false;
      const isNodeClick = targetElement.closest('.node');
      const isEdgeHandleClick = targetElement.closest('.edge-segment-handle');

      if (isCanvasClick && !isNodeClick && !isEdgeHandleClick) {
        setSelectedNodeKey(null);
      }
    };

    document.addEventListener('pointerdown', deselectOnCanvasClick);
    return () => document.removeEventListener('pointerdown', deselectOnCanvasClick);
  }, []);

  useEffect(() => {
    const localPrefix = window.location.hostname === 'localhost' ? '[local] ' : '';
    document.title = `${localPrefix}Slicer - ${currentSliceName}`;
  }, [currentSliceName]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures (e.g. restricted environments).
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(ROUTE_MODE_STORAGE_KEY, routeMode);
    } catch {
      // Ignore storage failures (e.g. restricted environments).
    }
  }, [routeMode]);

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (!sliceMenuOpen) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const clickedMenu = sliceMenuRef.current?.contains(target) ?? false;
      if (!clickedMenu) {
        setSliceMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [sliceMenuOpen]);

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (!routeMenuOpen) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const clickedMenu = routeMenuRef.current?.contains(target) ?? false;
      if (!clickedMenu) {
        setRouteMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [routeMenuOpen]);

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (!mobileMenuOpen) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const clickedMenu = mobileMenuRef.current?.contains(target) ?? false;
      if (!clickedMenu) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCommandPalette = (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'k';
      if (isCommandPalette) {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }

      const isTraceShortcut = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 't';
      if (isTraceShortcut && selectedNode && showDataTraceTab) {
        event.preventDefault();
        const firstKey = selectedNodeUsesKeys[0] ?? null;
        if (firstKey) {
          setCrossSliceTraceExpandedKeys({ [firstKey]: true });
        }
        setSelectedNodePanelTab('trace');
        return;
      }

      const isNextSliceShortcut = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'j';
      const isPreviousSliceShortcut = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'k';
      if (isNextSliceShortcut || isPreviousSliceShortcut) {
        event.preventDefault();
        const delta = isNextSliceShortcut ? 1 : -1;
        setSelectedNodeKey(null);
        setHighlightRange(null);
        setLibrary((currentLibrary) => {
          const currentIndex = currentLibrary.slices.findIndex((slice) => slice.id === currentLibrary.selectedSliceId);
          if (currentIndex < 0) {
            return currentLibrary;
          }
          const nextSlice = currentLibrary.slices[currentIndex + delta];
          if (!nextSlice) {
            return currentLibrary;
          }
          const nextLibrary = selectSlice(currentLibrary, nextSlice.id);
          if (nextLibrary.selectedSliceId !== currentLibrary.selectedSliceId) {
            applySelectedSliceOverrides(nextLibrary.selectedSliceId);
          }
          return nextLibrary;
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNode, selectedNodeUsesKeys, showDataTraceTab]);

  const printDiagramGeometry = async () => {
    if (!parsed || !activeLayout) {
      return;
    }
    const snapshot = {
      nodes: [...parsed.nodes.values()]
        .map((node) => {
          const position = displayedPos[node.key];
          return position
            ? { key: node.key, x: Math.round(position.x), y: Math.round(position.y), w: Math.round(position.w), h: Math.round(position.h) }
            : null;
        })
        .filter((value): value is { key: string; x: number; y: number; w: number; h: number } => Boolean(value))
        .sort((a, b) => a.key.localeCompare(b.key)),
      edges: renderedEdges
        .map(({ edgeKey, edge, geometry }) => ({
          key: edgeKey,
          from: edge.from,
          to: edge.to,
          d: geometry.d,
          points: geometry.points?.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) })) ?? []
        }))
        .sort((a, b) => a.key.localeCompare(b.key))
    };
    const trimmedDslLines = currentDsl.split('\n');
    while (trimmedDslLines.length > 0 && trimmedDslLines[trimmedDslLines.length - 1].trim() === '') {
      trimmedDslLines.pop();
    }
    const escapedDsl = trimmedDslLines.join('\n')
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${');

    const formatObjectArray = (items: unknown[], indent: string) => {
      if (items.length === 0) {
        return '';
      }
      return `\n${items.map((item) => `${indent}${JSON.stringify(item)}`).join(',\n')}\n`;
    };

    const expectedGeometryLiteral = `const expectedGeometry = {\n  "nodes": [${formatObjectArray(snapshot.nodes, '    ')}  ],\n  "edges": [${formatObjectArray(snapshot.edges, '    ')}  ]\n};`;
    const harnessArrange = `const dsl = \`\n${escapedDsl}\n\`;\n${expectedGeometryLiteral}\n\nawait assertGeometry(dsl, expectedGeometry);`;
    console.log('[slicr][diagram-geometry][arrange]', harnessArrange);
    try {
      await navigator.clipboard.writeText(harnessArrange);
      console.info('[slicr][diagram-geometry] arrange snippet copied to clipboard');
    } catch {
      // Clipboard may be unavailable in some contexts; console output still provides the data.
    }
  };

  const resetManualLayout = () => {
    setManualNodePositions({});
    setManualEdgePoints({});
    appendSliceLayoutResetEvent(library.selectedSliceId);
  };

  const applySelectedSliceOverrides = (sliceId: string) => {
    const overrides = loadSliceLayoutOverrides(sliceId);
    skipNextLayoutSaveRef.current = true;
    setManualNodePositions(overrides.nodes);
    setManualEdgePoints(overrides.edges);
  };

  const toggleDocumentationPanel = () => {
    setDocsOpen((value) => {
      const next = !value;
      if (next) {
        setHasOpenedDocs(true);
      }
      return next;
    });
  };


  return {
    parsed,
    errorText,
    currentDsl,
    currentSliceName,
    library,
    setLibrary,
    theme,
    setTheme,
    editorOpen,
    setEditorOpen,
    docsOpen,
    hasOpenedDocs,
    routeMode,
    setRouteMode,
    routeMenuOpen,
    setRouteMenuOpen,
    routeMenuRef,
    sliceMenuOpen,
    setSliceMenuOpen,
    sliceMenuRef,
    mobileMenuOpen,
    setMobileMenuOpen,
    mobileMenuRef,
    toggleRef,
    editorRef,
    editorMountRef,
    highlightRange,
    setHighlightRange,
    selectedNode,
    selectedNodeKey,
    setSelectedNodeKey,
    hoveredEdgeKey,
    setHoveredEdgeKey,
    hoveredTraceNodeKey,
    setHoveredTraceNodeKey,
    selectedNodePanelTab,
    setSelectedNodePanelTab,
    selectedNodeAnalysisRef,
    selectedNodeAnalysisHeader,
    selectedNodeAnalysisNodes,
    selectedNodeCrossSliceData,
    selectedNodeIssues,
    selectedNodeIssuesByKey,
    selectedNodeTraceResultsByKey,
    selectedNodeUsesKeys,
    missingSourceIssueKeys,
    crossSliceUsageGroups,
    crossSliceDataEnabled,
    showDataTraceTab,
    commandPaletteOpen,
    setCommandPaletteOpen,
    crossSliceDataExpandedKeys,
    setCrossSliceDataExpandedKeys,
    crossSliceTraceExpandedKeys,
    setCrossSliceTraceExpandedKeys,
    sourceOverrides,
    setSourceOverrides,
    focusRange,
    focusRequestVersion,
    setFocusRequestVersion,
    pendingFocusNodeKeyRef,
    sceneModel,
    DiagramRenderer,
    diagramRendererId,
    rendererViewportKey,
    initialCamera,
    dragTooltip,
    dragAndDropEnabled,
    isPanning,
    beginCanvasPan,
    beginNodeDrag,
    beginEdgeSegmentDrag,
    canvasPanelRef,
    collapseAllDataRegions,
    collapseAllRegions,
    expandAllRegions,
    showDevDiagramControls,
    hasManualLayoutOverrides,
    applySelectedSliceOverrides,
    addNewSlice,
    selectSlice,
    getSliceNameFromDsl,
    parseUsesBlocks,
    getAmbiguousSourceCandidates,
    formatTraceSource,
    printDiagramGeometry,
    resetManualLayout,
    toggleDocumentationPanel,
    TYPE_LABEL,
    NODE_VERSION_SUFFIX,
    NODE_MEASURE_NODE_CLASS,
    MISSING_DATA_VALUE,
    formatNodeData
  };
}

function toNodeRef(node: { type: string; name: string }) {
  return `${node.type}:${node.name}`;
}

function isScenarioNodeKey(nodeKey: string) {
  return nodeKey.startsWith('scn:');
}

function getUsesMappingsForNode(
  usesMappingsByRef: ReturnType<typeof parseUsesBlocks>,
  node: { key: string; type: string; name: string }
) {
  if (isScenarioNodeKey(node.key)) {
    return [];
  }
  return usesMappingsByRef.get(toNodeRef(node)) ?? [];
}
