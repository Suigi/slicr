import {Dispatch, SetStateAction, useEffect, useMemo, useRef, useState} from 'react';
import {DEFAULT_DSL} from './defaultDsl';
import {
  buildRenderedEdges,
  computeClassicDiagramLayout,
  computeDiagramLayout,
  DiagramEngineId,
  DiagramEngineLayout,
  supportsEditableEdgePoints
} from './domain/diagramEngine';
import {MISSING_DATA_VALUE} from './domain/dataMapping';
import {DiagramEdgeGeometry, DiagramPoint} from './domain/diagramRouting';
import { routeRoundedPolyline } from './domain/diagramRouting';
import {formatNodeData} from './domain/formatNodeData';
import {PAD_X, rowFor} from './domain/layoutGraph';
import {parseDsl} from './domain/parseDsl';
import {isCrossSliceDataEnabled, isDragAndDropEnabled, shouldShowDevDiagramControls} from './domain/runtimeFlags';
import { createCrossSliceUsageQuery } from './domain/crossSliceUsage';
import { getCrossSliceData } from './domain/crossSliceData';
import { collectDataIssues, getAmbiguousSourceCandidates } from './domain/dataIssues';
import { parseUsesBlocks } from './domain/dataMapping';
import { traceData } from './domain/dataTrace';
import { toNodeAnalysisRef, toNodeAnalysisRefFromNode } from './domain/nodeAnalysisKey';
import { measureNodeHeights, NODE_MEASURE_NODE_CLASS } from './nodeMeasurement';
import type {Parsed, Position} from './domain/types';
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
} from './sliceLibrary';
import {EditorWarning, Range, useDslEditor} from './useDslEditor';
import {useDiagramInteractions} from './useDiagramInteractions';
import { DocumentationPanel } from './DocumentationPanel';
import { NodeCard } from './NodeCard';

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
const CANVAS_MARGIN = 900;
type ThemeMode = 'dark' | 'light';
type RouteMode = DiagramEngineId;
type EdgeGeometry = DiagramEdgeGeometry;

function formatTraceSource(source: unknown): string {
  const fields = formatNodeData({ value: source });
  return fields[0]?.text ?? 'value: undefined';
}

function App() {
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
  const [measuredNodeHeights, setMeasuredNodeHeights] = useState<Record<string, number>>({});
  const [focusRequestVersion, setFocusRequestVersion] = useState(0);
  const pendingFocusNodeKeyRef = useRef<string | null>(null);
  const initializedViewportKeyRef = useRef<string | null>(null);
  const showDevDiagramControls = shouldShowDevDiagramControls(window.location.hostname);
  const dragAndDropEnabled = isDragAndDropEnabled(window.location.hostname);
  const crossSliceDataEnabled = isCrossSliceDataEnabled(window.location.hostname);
  const currentSlice =
    library.slices.find((slice) => slice.id === library.selectedSliceId) ?? library.slices[0];
  const currentDsl = currentSlice?.dsl ?? DEFAULT_DSL;

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
    try {
      const parsed = parseDsl(currentDsl);
      return { parsed, error: '', warnings: parsed.warnings };
    } catch (error) {
      return { parsed: null, error: `⚠ ${(error as Error).message}`, warnings: [] };
    }
  }, [currentDsl]);

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
    return computeClassicDiagramLayout(parsed, { nodeHeights: measuredNodeHeights });
  }, [parsed, measuredNodeHeights]);

  useEffect(() => {
    if (routeMode !== 'elk' || !parsed || parsed.nodes.size === 0) {
      return;
    }
    let active = true;
    computeDiagramLayout(parsed, 'elk', { nodeHeights: measuredNodeHeights })
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
  }, [routeMode, parsed, measuredNodeHeights]);

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

      const measured = measureNodeHeights(document);
      const parsedKeys = [...parsed.nodes.keys()];
      const next: Record<string, number> = {};
      for (const key of parsedKeys) {
        if (measured[key] !== undefined) {
          next[key] = measured[key];
        }
      }

      setMeasuredNodeHeights((previous) => {
        const nextKeys = Object.keys(next);
        const previousKeys = Object.keys(previous);
        if (
          nextKeys.length === previousKeys.length &&
          nextKeys.every((key) => previous[key] === next[key])
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

  const laneOverlay = useMemo(() => {
    if (!parsed || !activeLayout) {
      return null;
    }

    if (routeMode === 'classic') {
      return {
        usedRows: activeLayout.usedRows,
        rowY: activeLayout.rowY,
        rowStreamLabels: activeLayout.rowStreamLabels,
        height: activeLayout.h
      };
    }

    const rowBuckets = new Map<number, { minY: number; streamLabel: string }>();
    const laneByKey = engineLayout?.laneByKey ?? new Map<string, number>();
    for (const node of parsed.nodes.values()) {
      const position = displayedPos[node.key];
      if (!position) {
        continue;
      }
      const row = laneByKey.get(node.key) ?? rowFor(node.type);
      const existing = rowBuckets.get(row);
      const streamLabel = engineLayout?.rowStreamLabels[row] ?? existing?.streamLabel ?? '';
      rowBuckets.set(row, {
        minY: existing ? Math.min(existing.minY, position.y) : position.y,
        streamLabel
      });
    }

    const usedRows = [...rowBuckets.keys()].sort((a, b) => a - b);
    const rowY: Record<number, number> = {};
    const rowStreamLabels: Record<number, string> = {};
    for (const row of usedRows) {
      const data = rowBuckets.get(row);
      if (!data) {
        continue;
      }
      rowY[row] = data.minY;
      if (data.streamLabel) {
        rowStreamLabels[row] = data.streamLabel;
      }
    }

    return { usedRows, rowY, rowStreamLabels, height: activeLayout.h };
  }, [parsed, activeLayout, routeMode, engineLayout, displayedPos]);

  const canvasViewport = useMemo(() => {
    if (!activeLayout) {
      return null;
    }

    let minX = 0;
    let minY = 0;
    let maxX = activeLayout.w;
    let maxY = activeLayout.h;

    for (const position of Object.values(displayedPos)) {
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + position.w);
      maxY = Math.max(maxY, position.y + position.h);
    }

    for (const rendered of renderedEdges) {
      const points = rendered.geometry.points;
      if (!points) {
        continue;
      }
      for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    return {
      width: contentWidth + CANVAS_MARGIN * 2,
      height: contentHeight + CANVAS_MARGIN * 2,
      offsetX: CANVAS_MARGIN - minX,
      offsetY: CANVAS_MARGIN - minY
    };
  }, [activeLayout, displayedPos, renderedEdges]);

  useEffect(() => {
    const panel = canvasPanelRef.current;
    if (!panel || !canvasViewport) {
      return;
    }
    const viewportKey = `${library.selectedSliceId}:${routeMode}`;
    if (initializedViewportKeyRef.current === viewportKey) {
      return;
    }
    panel.scrollLeft = Math.max(0, canvasViewport.offsetX - 80);
    panel.scrollTop = Math.max(0, canvasViewport.offsetY - 80);
    initializedViewportKeyRef.current = viewportKey;
  }, [canvasPanelRef, canvasViewport, library.selectedSliceId, routeMode]);

  useEffect(() => {
    const pendingFocusNodeKey = pendingFocusNodeKeyRef.current;
    if (!pendingFocusNodeKey || !canvasViewport) {
      return;
    }
    const panel = canvasPanelRef.current;
    const position = displayedPos[pendingFocusNodeKey];
    if (!panel || !position) {
      return;
    }

    const targetX = canvasViewport.offsetX + position.x + position.w / 2 - panel.clientWidth / 2;
    const targetY = canvasViewport.offsetY + position.y + position.h / 2 - panel.clientHeight / 2;
    panel.scrollLeft = Math.max(0, targetX);
    panel.scrollTop = Math.max(0, targetY);
    pendingFocusNodeKeyRef.current = null;
  }, [focusRequestVersion, canvasViewport, displayedPos, canvasPanelRef]);

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

  const selectedNode = useMemo(() => {
    if (!parsed || !selectedNodeKey) {
      return null;
    }
    return parsed.nodes.get(selectedNodeKey) ?? null;
  }, [parsed, selectedNodeKey]);

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
    if (!parsed || !selectedNodeAnalysisRef) {
      return [];
    }
    return [...parsed.nodes.values()].filter((node) => toNodeAnalysisRefFromNode(node) === selectedNodeAnalysisRef);
  }, [parsed, selectedNodeAnalysisRef]);

  const usesMappingsByRef = useMemo(() => parseUsesBlocks(currentDsl), [currentDsl]);

  const crossSliceUsage = useMemo(() => {
    if (!selectedNodeAnalysisRef) {
      return [];
    }
    const query = createCrossSliceUsageQuery(library.slices.map((slice) => ({ id: slice.id, dsl: slice.dsl })));
    return query.getCrossSliceUsage(selectedNodeAnalysisRef);
  }, [library.slices, selectedNodeAnalysisRef]);

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
    if (!selectedNodeAnalysisRef) {
      return [];
    }
    return dataIssues.filter((issue) => toNodeAnalysisRef(issue.nodeRef) === selectedNodeAnalysisRef);
  }, [dataIssues, selectedNodeAnalysisRef]);

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
      const mappings = usesMappingsByRef.get(toNodeRef(node)) ?? [];
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
    return getCrossSliceData(
      library.slices.map((slice) => ({ id: slice.id, dsl: slice.dsl })),
      selectedNodeAnalysisRef
    );
  }, [library.slices, selectedNodeAnalysisRef]);

  const selectedNodeTraceResultsByKey = useMemo(() => {
    if (!parsed) {
      return {} as Record<string, Array<{ nodeKey: string; result: NonNullable<ReturnType<typeof traceData>> }>>;
    }

    const byKey: Record<string, Array<{ nodeKey: string; result: NonNullable<ReturnType<typeof traceData>> }>> = {};
    for (const traceKey of selectedNodeUsesKeys) {
      const matchingNodeKeys = selectedNodeAnalysisNodes
        .filter((node) => {
          const mappings = usesMappingsByRef.get(toNodeRef(node)) ?? [];
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
      const slice = library.slices.find((item) => item.id === usage.sliceId) ?? null;
      const sliceName = slice ? getSliceNameFromDsl(slice.dsl) : usage.sliceId;
      const usageNode = slice ? parseDsl(slice.dsl).nodes.get(usage.nodeKey) ?? null : null;
      return {
        usage,
        sliceName,
        node: usageNode
      };
    });
  }, [crossSliceUsage, library.slices]);

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
        sliceName: entry.usage.sliceId === library.selectedSliceId ? 'This Slice' : entry.sliceName,
        entries: [entry]
      });
    }
    return [...grouped.values()]
      .map((group) => ({
        ...group,
        entries: [...group.entries].sort((left, right) => left.usage.nodeKey.localeCompare(right.usage.nodeKey))
      }))
      .sort((left, right) => {
        if (left.sliceId === library.selectedSliceId && right.sliceId !== library.selectedSliceId) {
          return -1;
        }
        if (right.sliceId === library.selectedSliceId && left.sliceId !== library.selectedSliceId) {
          return 1;
        }
        const byName = left.sliceName.localeCompare(right.sliceName);
        if (byName !== 0) {
          return byName;
        }
        return left.sliceId.localeCompare(right.sliceId);
      });
  }, [crossSliceUsageEntries, library.selectedSliceId]);

  const hoveredEdgeNodeKeys = useMemo(() => {
    if (!hoveredEdgeKey) {
      return new Set<string>();
    }
    const hoveredEdge = renderedEdges.find(({ edgeKey }) => edgeKey === hoveredEdgeKey);
    if (!hoveredEdge) {
      return new Set<string>();
    }
    return new Set<string>([hoveredEdge.edge.from, hoveredEdge.edge.to]);
  }, [hoveredEdgeKey, renderedEdges]);

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
    document.title = `Slicer - ${currentSliceName}`;
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
      const isCommandPalette = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isCommandPalette) {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }

      const isTraceShortcut = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 't';
      if (isTraceShortcut && selectedNode) {
        event.preventDefault();
        const firstKey = selectedNodeUsesKeys[0] ?? null;
        if (firstKey) {
          setCrossSliceTraceExpandedKeys({ [firstKey]: true });
        }
        setSelectedNodePanelTab('trace');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNode, selectedNodeUsesKeys]);

  const renderMeasureDataLine = (line: string, index: number) => {
    const match = line.match(/^(\s*(?:-\s*)?)([^:\n]+:)(.*)$/);
    if (!match) {
      return (
        <div key={index} className="node-measure-field-line">
          {line}
        </div>
      );
    }

    const value = match[3];
    const isMissing = value.trim() === MISSING_DATA_VALUE;
    const keyWithColon = match[2];
    const key = keyWithColon.endsWith(':') ? keyWithColon.slice(0, -1) : keyWithColon;

    return (
      <div key={index} className={`node-measure-field-line${isMissing ? ' missing' : ''}`}>
        {match[1]}
        <span className="node-measure-field-key">{key}</span>
        <span className="node-measure-field-colon">:</span>
        <span className="node-measure-field-val">{value}</span>
      </div>
    );
  };

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

  return (
    <>
      <header>
        <h1>Slicer</h1>
        <div className="legend">
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'var(--cmd)' }} />
            <span>command</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'var(--evt)' }} />
            <span>event</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'var(--rm)' }} />
            <span>read model</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'var(--exc)' }} />
            <span>exception</span>
          </div>
        </div>
        <div className="slice-controls">
          <div className="slice-menu" ref={sliceMenuRef}>
            <button
              type="button"
              className="slice-select-toggle"
              aria-label="Select slice"
              title="Select slice"
              onClick={() => setSliceMenuOpen((current) => !current)}
            >
              <span className="slice-select-label">{currentSliceName}</span>
              <span aria-hidden="true">▾</span>
            </button>
            {sliceMenuOpen && (
              <div className="slice-menu-panel" role="menu" aria-label="Slice list">
                {library.slices.map((slice) => {
                  const sliceName = getSliceNameFromDsl(slice.dsl);
                  return (
                    <button
                      key={slice.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={library.selectedSliceId === slice.id}
                      className="slice-menu-item"
                      onClick={() => {
                        setSelectedNodeKey(null);
                        setHighlightRange(null);
                        setLibrary((currentLibrary) => {
                          const nextLibrary = selectSlice(currentLibrary, slice.id);
                          if (nextLibrary.selectedSliceId !== currentLibrary.selectedSliceId) {
                            applySelectedSliceOverrides(nextLibrary.selectedSliceId);
                          }
                          return nextLibrary;
                        });
                        setSliceMenuOpen(false);
                      }}
                    >
                      <span className="slice-menu-check" aria-hidden="true">
                        {library.selectedSliceId === slice.id ? '✓' : ''}
                      </span>
                      <span>{sliceName}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            type="button"
            className="slice-new"
            aria-label="Create new slice"
            title="Create new slice"
            onClick={() => {
              setSelectedNodeKey(null);
              setHighlightRange(null);
              setLibrary((currentLibrary) => {
                const nextLibrary = addNewSlice(currentLibrary);
                applySelectedSliceOverrides(nextLibrary.selectedSliceId);
                return nextLibrary;
              });
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9.5 1.1l3.4 3.5.1.4v2h-1V6H8V2H3v11h4v1H2.5l-.5-.5v-12l.5-.5h6.7l.3.1zM9 2v3h2.9L9 2zm4 14h-1v-3H9v-1h3V9h1v3h3v1h-3v3z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <button
          type="button"
          className="theme-toggle desktop-only"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        >
          {theme === 'dark' ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
              <line x1="4.93" y1="4.93" x2="7.05" y2="7.05" />
              <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" />
              <line x1="16.95" y1="7.05" x2="19.07" y2="4.93" />
              <line x1="4.93" y1="19.07" x2="7.05" y2="16.95" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </button>

        <button
          ref={toggleRef}
          className="dsl-toggle"
          aria-label="Toggle DSL editor"
          onClick={() => setEditorOpen((value) => !value)}
          style={{
            color: editorOpen ? 'var(--text)' : undefined,
            borderColor: editorOpen ? 'var(--text)' : undefined
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          DSL
        </button>
        <button
          type="button"
          className="docs-toggle desktop-only"
          aria-label="Toggle documentation panel"
          onClick={toggleDocumentationPanel}
          style={{
            color: docsOpen ? 'var(--text)' : undefined,
            borderColor: docsOpen ? 'var(--text)' : undefined
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M4 4.5A2.5 2.5 0 0 1 6.5 7H20" />
            <path d="M6.5 7v10" />
          </svg>
          Docs
        </button>
        <div className="mobile-menu" ref={mobileMenuRef}>
          <button
            type="button"
            className="mobile-menu-toggle"
            aria-label="Open more actions"
            title="More actions"
            onClick={() => setMobileMenuOpen((current) => !current)}
            style={{
              color: mobileMenuOpen ? 'var(--text)' : undefined,
              borderColor: mobileMenuOpen ? 'var(--text)' : undefined
            }}
          >
            ⋯
          </button>
          {mobileMenuOpen && (
            <div className="mobile-menu-panel" role="menu" aria-label="More actions">
              <button
                type="button"
                role="menuitem"
                className="mobile-menu-item"
                onClick={() => {
                  setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
                  setMobileMenuOpen(false);
                }}
              >
                Theme: {theme === 'dark' ? 'Dark' : 'Light'}
              </button>
              <button
                type="button"
                role="menuitem"
                className="mobile-menu-item"
                onClick={() => {
                  toggleDocumentationPanel();
                  setMobileMenuOpen(false);
                }}
              >
                {docsOpen ? 'Hide Docs' : 'Show Docs'}
              </button>
              {showDevDiagramControls && (
                <>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={routeMode === 'elk'}
                    className="mobile-menu-item"
                    onClick={() => {
                      setRouteMode('elk');
                      setMobileMenuOpen(false);
                    }}
                  >
                    Render: ELK {routeMode === 'elk' ? '✓' : ''}
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={routeMode === 'classic'}
                    className="mobile-menu-item"
                    onClick={() => {
                      setRouteMode('classic');
                      setMobileMenuOpen(false);
                    }}
                  >
                    Render: Classic {routeMode === 'classic' ? '✓' : ''}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="mobile-menu-item"
                    onClick={() => {
                      resetManualLayout();
                      setMobileMenuOpen(false);
                    }}
                  >
                    Reset positions
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="mobile-menu-item"
                    onClick={() => {
                      printDiagramGeometry();
                      setMobileMenuOpen(false);
                    }}
                  >
                    Geometry
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {showDevDiagramControls && (
          <>
            <div className="route-menu desktop-only" ref={routeMenuRef}>
              <button
                type="button"
                className="route-toggle"
                aria-label="Select render mode"
                title="Select render mode"
                onClick={() => setRouteMenuOpen((current) => !current)}
              >
                {routeMode === 'elk' ? 'ELK' : 'Classic'} ▾
              </button>
              {routeMenuOpen && (
                <div className="route-menu-panel" role="menu" aria-label="Render mode">
                  {(['classic', 'elk'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="menuitemradio"
                      aria-checked={routeMode === mode}
                      className="route-menu-item"
                      onClick={() => {
                        setRouteMode(mode);
                        setRouteMenuOpen(false);
                      }}
                    >
                      <span className="route-menu-check" aria-hidden="true">{routeMode === mode ? '✓' : ''}</span>
                      <span>{mode === 'elk' ? 'ELK' : 'Classic'}</span>
                    </button>
                  ))}
                  <div className="route-menu-separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="route-menu-item"
                    onClick={() => {
                      resetManualLayout();
                      setRouteMenuOpen(false);
                    }}
                  >
                    <span className="route-menu-check" aria-hidden="true">↺</span>
                    <span>Reset positions</span>
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="route-toggle desktop-only"
              aria-label="Print diagram geometry"
              title="Print current node/edge geometry to console (and clipboard when available)"
              onClick={printDiagramGeometry}
            >
              Geometry
            </button>
          </>
        )}
      </header>

      {parsed && parsed.nodes.size > 0 && (
        <div className="node-measure-layer" aria-hidden="true">
          {[...parsed.nodes.values()].map((node) => {
            const nodePrefix = TYPE_LABEL[node.type] ?? node.type;
            return (
              <div
                key={`measure-${node.key}`}
                className={NODE_MEASURE_NODE_CLASS}
                data-node-key={node.key}
                style={{ width: '180px' }}
              >
                <div className="node-measure-header">
                  {nodePrefix ? <span className="node-measure-prefix">{nodePrefix}:</span> : null}
                  <span className="node-measure-title">{node.alias ?? node.name.replace(NODE_VERSION_SUFFIX, '')}</span>
                </div>
                {node.data && (
                  <div className="node-measure-fields">
                    {formatNodeData(node.data).map((field) => (
                      <div
                        key={`measure-${node.key}-${field.key}`}
                        className="node-measure-field"
                      >
                        <div className="node-measure-field-lines">
                          {field.text.split('\n').map((line, index) => renderMeasureDataLine(line, index))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="main">
        <div ref={editorRef} className={`editor-panel ${editorOpen ? 'open' : ''}`}>
          <div className="panel-label">
            <div className="panel-handle" />
            <span>DSL</span>
            <button
              type="button"
              className="panel-action"
              onClick={collapseAllDataRegions}
              aria-label="Collapse all data regions"
              title="Collapse data regions"
            >
              <svg
                className="panel-action-icon"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path d="M2.5 2.5 5 5M5 5V3.6M5 5H3.6M9.5 9.5 7 7M7 7V8.4M7 7H8.4M4.2 7.8 7.8 4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              data
            </button>
            <button
              type="button"
              className="panel-action"
              onClick={collapseAllRegions}
              aria-label="Collapse all regions"
              title="Collapse all regions"
            >
              <svg
                className="panel-action-icon"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path d="M2.5 2.5 5 5M5 5V3.6M5 5H3.6M9.5 9.5 7 7M7 7V8.4M7 7H8.4M4.2 7.8 7.8 4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              all
            </button>
            <button
              type="button"
              className="panel-action"
              onClick={expandAllRegions}
              aria-label="Expand all regions"
              title="Expand all regions"
            >
              <svg
                className="panel-action-icon"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path d="M5 5 2.5 2.5M2.5 2.5V3.9M2.5 2.5H3.9M7 7 9.5 9.5M9.5 9.5V8.1M9.5 9.5H8.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              all
            </button>
          </div>
          <div ref={editorMountRef} className="dsl-editor" />
          {errorText && <div className="error-bar">{errorText}</div>}
        </div>

        <div
          ref={canvasPanelRef}
          className={`canvas-panel ${isPanning ? 'panning' : ''} ${docsOpen ? 'hidden' : ''}`}
          onPointerDown={beginCanvasPan}
          aria-hidden={docsOpen}
        >
          <div
            id="canvas"
            style={{
              width: canvasViewport ? `${canvasViewport.width}px` : undefined,
              height: canvasViewport ? `${canvasViewport.height}px` : undefined
            }}
          >
            {dragTooltip && (
              <div
                className="drag-tooltip"
                style={{
                  left: `${dragTooltip.clientX + 12}px`,
                  top: `${dragTooltip.clientY + 12}px`
                }}
              >
                {dragTooltip.text}
              </div>
            )}
            {parsed && activeLayout && canvasViewport && (
              <div
                className="canvas-world"
                style={{ transform: `translate(${canvasViewport.offsetX}px, ${canvasViewport.offsetY}px)` }}
              >
                {laneOverlay?.usedRows.map((row, i) => {
                  const bandTop = laneOverlay.rowY[row] - 28;
                  const bandHeight =
                    i < laneOverlay.usedRows.length - 1
                      ? laneOverlay.rowY[laneOverlay.usedRows[i + 1]] - laneOverlay.rowY[row]
                      : laneOverlay.height - bandTop;
                  const streamLabel = laneOverlay.rowStreamLabels[row];

                  return (
                    <div key={`lane-${row}`}>
                      <div
                        className="lane-band"
                        style={{ top: `${bandTop}px`, height: `${bandHeight}px` }}
                      />
                      {streamLabel && (
                        <div className="lane-stream-label" style={{ top: `${bandTop + 8}px`, left: `${Math.max(8, PAD_X - 48)}px` }}>
                          {streamLabel}
                        </div>
                      )}
                    </div>
                  );
                })}

                {parsed.boundaries.map((boundary, index) => {
                  const afterPos = displayedPos[boundary.after];
                  if (!afterPos) {
                    return null;
                  }
                  const topLaneRow = laneOverlay?.usedRows[0];
                  const topLaneY = topLaneRow === undefined ? 0 : (laneOverlay?.rowY[topLaneRow] ?? 0);
                  const dividerTop = (topLaneY - 28) - 40;
                  const dividerHeight = activeLayout.h - dividerTop;
                  const x = afterPos.x + afterPos.w + 40;
                  return (
                    <div
                      key={`slice-divider-${index}-${boundary.after}`}
                      className="slice-divider"
                      style={{ left: `${x}px`, top: `${dividerTop}px`, height: `${dividerHeight}px` }}
                    />
                  );
                })}

                {parsed.sliceName && (
                  <div className="slice-title" style={{ top: '6px', left: `${PAD_X}px` }}>
                    {parsed.sliceName}
                  </div>
                )}

                {[...parsed.nodes.values()].map((node) => {
                  const position = displayedPos[node.key];
                  if (!position) {
                    return null;
                  }
                  const nodePrefix = TYPE_LABEL[node.type] ?? node.type;

                  const isHighlighted = activeNodeKeyFromEditor === node.key;
                  const isSelected = selectedNodeKey === node.key;
                  const isRelated = hoveredEdgeNodeKeys.has(node.key);
                  const isTraceHovered = hoveredTraceNodeKey === node.key;

                  return (
                    <NodeCard
                      key={node.key}
                      node={{
                        ...node,
                        name: node.name.replace(NODE_VERSION_SUFFIX, '')
                      }}
                      nodePrefix={nodePrefix}
                      className={`${isHighlighted ? 'highlighted' : ''} ${isSelected ? 'selected' : ''} ${isRelated ? 'related' : ''} ${isTraceHovered ? 'trace-hovered' : ''}`.trim()}
                      style={{
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        width: `${position.w}px`,
                        height: `${position.h}px`
                      }}
                      onMouseEnter={() => setHighlightRange(node.srcRange)}
                      onMouseLeave={() => setHighlightRange(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeKey(node.key);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeKey(node.key);
                        setEditorOpen(true);
                        focusRange(node.srcRange);
                      }}
                      onPointerDown={(event) => beginNodeDrag(event, node.key)}
                    />
                  );
                })}

                  <svg id="arrows" width={activeLayout.w} height={activeLayout.h}>
                    <defs>
                      <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L8,3 z" fill="var(--arrow)" />
                      </marker>
                      <marker id="arr-related" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L8,3 z" fill="var(--edge-highlight)" />
                      </marker>
                    </defs>

                    {renderedEdges.map(({ key, edgeKey, edge, geometry }) => {
                      const edgePath = geometry.points ? routeRoundedPolyline(geometry.points, 5) : geometry.d;
                      const isHovered = hoveredEdgeKey === edgeKey;
                      const isRelated = isHovered;
                      const handleEdgeHoverEnter = () => setHoveredEdgeKey(edgeKey);
                      const handleEdgeHoverLeave = () => {
                        setHoveredEdgeKey((current) => (current === edgeKey ? null : current));
                      };

                      return (
                        <g key={key} className={`${isRelated ? 'related ' : ''}${isHovered ? 'hovered' : ''}`.trim()}>
                          <path
                            d={edgePath}
                            className="edge-hover-target"
                            onPointerEnter={handleEdgeHoverEnter}
                            onPointerLeave={handleEdgeHoverLeave}
                            onMouseEnter={handleEdgeHoverEnter}
                            onMouseLeave={handleEdgeHoverLeave}
                          />
                          <path
                            d={edgePath}
                            className="arrow-path"
                            markerEnd={isRelated ? "url(#arr-related)" : "url(#arr)"}
                            onPointerEnter={handleEdgeHoverEnter}
                            onPointerLeave={handleEdgeHoverLeave}
                            onMouseEnter={handleEdgeHoverEnter}
                            onMouseLeave={handleEdgeHoverLeave}
                          />
                          {edge.label && (
                            <text
                              className="arrow-label"
                              textAnchor="middle"
                              x={geometry.labelX}
                              y={geometry.labelY}
                            >
                              [{edge.label}]
                            </text>
                          )}
                          {dragAndDropEnabled &&
                            supportsEditableEdgePoints(routeMode) &&
                            geometry.points?.map((point, pointIndex) => {
                              const nextPoint = geometry.points?.[pointIndex + 1];
                              if (!nextPoint) {
                                return null;
                              }
                              const segmentCount = geometry.points!.length - 1;
                              const middleIndex = Math.max(0, Math.floor((segmentCount - 1) / 2));
                              const draggableSegmentIndices = new Set<number>([
                                0,
                                middleIndex,
                                segmentCount - 1
                              ]);
                              if (!draggableSegmentIndices.has(pointIndex)) {
                                return null;
                              }
                              return (
                                <line
                                  key={`${edgeKey}-segment-handle-${pointIndex}`}
                                  x1={point.x}
                                  y1={point.y}
                                x2={nextPoint.x}
                                y2={nextPoint.y}
                                className="edge-segment-handle"
                                onPointerEnter={handleEdgeHoverEnter}
                                onPointerLeave={handleEdgeHoverLeave}
                                onMouseEnter={handleEdgeHoverEnter}
                                onMouseLeave={handleEdgeHoverLeave}
                                onPointerDown={(event) => beginEdgeSegmentDrag(event, edgeKey, pointIndex, geometry.points!)}
                              />
                            );
                          })}
                        </g>
                      );
                    })}
                  </svg>
              </div>
            )}
          </div>
        </div>
        {selectedNode && (
          <aside className="cross-slice-usage-panel" aria-label="Cross-Slice Usage" style={{ overflowY: 'auto' }}>
            <div className="cross-slice-panel-tabs" role="tablist" aria-label="Node panel tabs">
              <button
                type="button"
                role="tab"
                aria-selected={selectedNodePanelTab === 'usage'}
                className={`cross-slice-panel-tab ${selectedNodePanelTab === 'usage' ? 'active' : ''}`}
                onClick={() => setSelectedNodePanelTab('usage')}
              >
                Cross-Slice Usage
              </button>
              {crossSliceDataEnabled && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedNodePanelTab === 'crossSliceData'}
                  className={`cross-slice-panel-tab ${selectedNodePanelTab === 'crossSliceData' ? 'active' : ''}`}
                  onClick={() => setSelectedNodePanelTab('crossSliceData')}
                >
                  Cross-Slice Data
                </button>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={selectedNodePanelTab === 'trace'}
                className={`cross-slice-panel-tab ${selectedNodePanelTab === 'trace' ? 'active' : ''} ${missingSourceIssueKeys.size > 0 ? 'has-missing-source' : ''}`}
                onClick={() => {
                  setSelectedNodePanelTab('trace');
                }}
              >
                Data Trace
              </button>
            </div>
            <div className="cross-slice-panel-divider" aria-hidden="true" />
            <div className={`cross-slice-usage-node ${selectedNodeAnalysisHeader.type}`.trim()}>
              {selectedNodeAnalysisHeader.type && (
                <span className="cross-slice-usage-node-type">{selectedNodeAnalysisHeader.type}:</span>
              )}
              <span className="cross-slice-usage-node-key">{selectedNodeAnalysisHeader.key}</span>
            </div>
            {selectedNodePanelTab === 'usage' && (
              <div className="cross-slice-usage-list">
                {crossSliceUsageGroups.map((group) => (
                  <section key={group.sliceId} className="cross-slice-usage-group">
                    <div className="cross-slice-usage-group-title">{group.sliceName}</div>
                    <div className="cross-slice-usage-group-items">
                      <div className="cross-slice-usage-group-frame">
                        {group.entries.map(({ usage, node }) => {
                          const nodeType = node?.type ?? '';
                          const nodePrefix = TYPE_LABEL[nodeType] ?? nodeType;
                          return (
                            <button
                              key={`${usage.sliceId}:${usage.nodeKey}`}
                              type="button"
                              className="cross-slice-usage-item"
                              data-slice-id={usage.sliceId}
                              onClick={() => {
                                setSelectedNodeKey(usage.nodeKey);
                                pendingFocusNodeKeyRef.current = usage.nodeKey;
                                setFocusRequestVersion((version) => version + 1);
                                setLibrary((currentLibrary) => {
                                  const nextLibrary = selectSlice(currentLibrary, usage.sliceId);
                                  if (nextLibrary.selectedSliceId !== currentLibrary.selectedSliceId) {
                                    applySelectedSliceOverrides(nextLibrary.selectedSliceId);
                                  }
                                  return nextLibrary;
                                });
                              }}
                            >
                              <NodeCard
                                node={node ?? {
                                  type: 'generic',
                                  name: usage.nodeKey,
                                  alias: null,
                                  stream: null,
                                  key: usage.nodeKey,
                                  data: null,
                                  srcRange: { from: 0, to: 0 }
                                }}
                                nodePrefix={nodePrefix}
                                className="cross-slice-usage-node-card"
                                maxFields={2}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            )}
            {crossSliceDataEnabled && selectedNodePanelTab === 'crossSliceData' && (
              <div className="cross-slice-data-list">
                {selectedNodeCrossSliceData.keys.map((key) => {
                  const isExpanded = Boolean(crossSliceDataExpandedKeys[key]);
                  return (
                    <div key={`${selectedNodeAnalysisRef}:${key}`} className="cross-slice-data-key-section">
                      <button
                        type="button"
                        className="cross-slice-data-key-toggle"
                        aria-expanded={isExpanded ? 'true' : 'false'}
                        onClick={() => setCrossSliceDataExpandedKeys((current) => ({ ...current, [key]: !current[key] }))}
                      >
                        <span className="cross-slice-data-key-toggle-icon" aria-hidden="true">
                          <svg viewBox="0 0 12 12" width="10" height="10">
                            <rect
                              x="1.5"
                              y="1.5"
                              width="9"
                              height="9"
                              rx="1"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                            <path
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              d="M4 6 L8 6"
                            />
                            {!isExpanded && (
                              <path
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                d="M6 4 L6 8"
                              />
                            )}
                          </svg>
                        </span>
                        <span className="cross-slice-data-key-toggle-label">{key}</span>
                      </button>
                      {isExpanded && (
                        <div className="cross-slice-data-values">
                          {(selectedNodeCrossSliceData.byKey[key] ?? []).length === 0 && (
                            <div className="cross-slice-data-empty">No values</div>
                          )}
                          {(selectedNodeCrossSliceData.byKey[key] ?? []).map((valueEntry) => (
                            <div
                              key={`${selectedNode.key}:${key}:${valueEntry.sliceId}`}
                              className="cross-slice-data-value-item"
                            >
                              {valueEntry.sliceName}: {String(valueEntry.value)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {selectedNodePanelTab === 'trace' && (
              <div className="cross-slice-trace-list">
                {selectedNodeUsesKeys.map((traceKey) => {
                  const isExpanded = Boolean(crossSliceTraceExpandedKeys[traceKey]);
                  const entries = selectedNodeTraceResultsByKey[traceKey] ?? [];
                  return (
                    <div
                      key={`${selectedNodeAnalysisRef}:${traceKey}`}
                      className={`cross-slice-trace-key-section ${missingSourceIssueKeys.has(traceKey) ? 'missing-source' : ''}`}
                    >
                      <button
                        type="button"
                        className="cross-slice-trace-key-toggle"
                        aria-expanded={isExpanded ? 'true' : 'false'}
                        onClick={() =>
                          setCrossSliceTraceExpandedKeys((current) => ({ ...current, [traceKey]: !current[traceKey] }))}
                      >
                        <span className="cross-slice-trace-key-toggle-icon" aria-hidden="true">
                          <svg viewBox="0 0 12 12" width="10" height="10">
                            <rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
                            <path fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" d="M4 6 L8 6" />
                            {!isExpanded && (
                              <path fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" d="M6 4 L6 8" />
                            )}
                          </svg>
                        </span>
                        <span className="cross-slice-trace-key-toggle-label">{traceKey}</span>
                      </button>
                      {isExpanded && (
                        <div className="cross-slice-trace-key-values">
                          {entries.length === 0 && (
                            <div className="cross-slice-trace-empty">No trace</div>
                          )}
                          {entries.map((entry) => (
                            <div key={`${selectedNodeAnalysisRef}:${traceKey}:${entry.nodeKey}`} className="cross-slice-trace-result">
                              {entries.length > 1 && (
                                <div className="cross-slice-trace-version">{entry.nodeKey}</div>
                              )}
                              <div className="cross-slice-trace-hops">
                                {!entry.result.contributors && entry.result.hops.map((hop, index) => (
                                  <div
                                    key={`${entry.nodeKey}:${hop.nodeKey}:${hop.key}:${index}`}
                                    className={`cross-slice-trace-hop ${parsed?.nodes.get(hop.nodeKey)?.type ?? 'generic'}`}
                                    onMouseOver={() => setHoveredTraceNodeKey(hop.nodeKey)}
                                    onMouseOut={() => setHoveredTraceNodeKey((current) => (current === hop.nodeKey ? null : current))}
                                  >
                                    <span className="cross-slice-trace-hop-node">{hop.nodeKey}</span>
                                    <span className="cross-slice-trace-hop-sep">.</span>
                                    <span className="cross-slice-trace-hop-key">{hop.key}</span>
                                  </div>
                                ))}
                                {entry.result.contributors?.map((contributor) => (
                                  <div key={`${entry.nodeKey}:${contributor.label}`} className="cross-slice-trace-contributor">
                                    <div className="cross-slice-trace-contributor-label">{contributor.label}</div>
                                    {contributor.hops.map((hop, index) => (
                                      <div
                                        key={`${entry.nodeKey}:${contributor.label}:${hop.nodeKey}:${hop.key}:${index}`}
                                        className={`cross-slice-trace-hop ${parsed?.nodes.get(hop.nodeKey)?.type ?? 'generic'}`}
                                        onMouseOver={() => setHoveredTraceNodeKey(hop.nodeKey)}
                                        onMouseOut={() =>
                                          setHoveredTraceNodeKey((current) => (current === hop.nodeKey ? null : current))}
                                      >
                                        <span className="cross-slice-trace-hop-node">{hop.nodeKey}</span>
                                        <span className="cross-slice-trace-hop-sep">.</span>
                                        <span className="cross-slice-trace-hop-key">{hop.key}</span>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                                {(selectedNodeIssuesByKey[traceKey] ?? [])
                                  .filter((issue) => issue.nodeKey === entry.nodeKey)
                                  .map((issue) => (
                                    <div
                                      key={`${issue.code}:${issue.nodeKey}:${issue.key}:${issue.range.from}`}
                                      className="cross-slice-trace-hop issue"
                                    >
                                      <span className="cross-slice-trace-issue-code">{issue.code}</span>
                                      {parsed && issue.code === 'ambiguous-source' && (
                                        <div className="cross-slice-issue-fixes">
                                          {getAmbiguousSourceCandidates(
                                            { dsl: currentDsl, nodes: parsed.nodes, edges: parsed.edges, sourceOverrides },
                                            issue.nodeKey,
                                            issue.key
                                          ).map((candidate) => (
                                            <button
                                              key={`${issue.nodeKey}:${issue.key}:${candidate}`}
                                              type="button"
                                              className="cross-slice-issue-fix"
                                              onClick={() =>
                                                setSourceOverrides((current) => ({
                                                  ...current,
                                                  [`${issue.nodeKey}:${issue.key}`]: candidate
                                                }))}
                                            >
                                              Use {candidate}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                              </div>
                              {!selectedNodeIssues.some((issue) => (
                                issue.code === 'missing-source' && issue.key === traceKey && issue.nodeKey === entry.nodeKey
                              )) && (
                                <div className="cross-slice-trace-source">
                                  {formatTraceSource(entry.result.source)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        )}
        {commandPaletteOpen && (
          <div className="command-palette" role="dialog" aria-label="Command palette">
            <button
              type="button"
              className="command-palette-item"
              onClick={() => {
                if (selectedNode) {
                  const firstKey = selectedNodeUsesKeys[0] ?? null;
                  if (firstKey) {
                    setCrossSliceTraceExpandedKeys({ [firstKey]: true });
                  }
                  setSelectedNodePanelTab('trace');
                }
                setCommandPaletteOpen(false);
              }}
            >
              Trace data
            </button>
            <button
              type="button"
              className="command-palette-item"
              onClick={() => {
                setSelectedNodePanelTab('usage');
                setCommandPaletteOpen(false);
              }}
            >
              Show cross-slice usage
            </button>
          </div>
        )}
        {(hasOpenedDocs || docsOpen) && (
          <div className={`docs-panel-shell ${docsOpen ? '' : 'hidden'}`} aria-hidden={!docsOpen}>
            <DocumentationPanel />
          </div>
        )}
      </div>
    </>
  );
}

export default App;

function toNodeRef(node: { type: string; name: string }) {
  return `${node.type}:${node.name}`;
}
