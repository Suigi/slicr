import { Dispatch, SetStateAction, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ElkPoint } from 'elkjs/lib/elk-api';
import { DEFAULT_DSL } from './defaultDsl';
import { buildElkLaneMeta, computeElkLayout, middlePoint, routeForwardEdge, routePolyline } from './domain/elkLayout';
import { edgePath } from './domain/edgePath';
import { formatNodeData } from './domain/formatNodeData';
import { layoutGraph, PAD_X, rowFor } from './domain/layoutGraph';
import { parseDsl } from './domain/parseDsl';
import { shouldShowDevDiagramControls } from './domain/runtimeFlags';
import { getRelatedElements } from './domain/traversal';
import type { LayoutResult, Parsed, Position } from './domain/types';
import { addNewSlice, getSliceNameFromDsl, loadSliceLayoutOverrides, loadSliceLibrary, saveSliceLayoutOverrides, saveSliceLibrary, selectSlice, SliceLibrary, updateSelectedSliceDsl } from './sliceLibrary';
import { EditorWarning, Range, useDslEditor } from './useDslEditor';

type ParseResult =
  | { parsed: Parsed; error: ''; warnings: Parsed['warnings'] }
  | { parsed: null; error: string; warnings: [] };

const TYPE_LABEL: Record<string, string> = {
  rm: 'rm',
  cmd: 'cmd',
  evt: 'evt',
  exc: 'exc',
  ui: 'ui',
  aut: 'aut',
  ext: 'ext'
};

const NODE_VERSION_SUFFIX = /@\d+$/;
const THEME_STORAGE_KEY = 'slicr.theme';
const ROUTE_MODE_STORAGE_KEY = 'slicr.routeMode';
type ThemeMode = 'dark' | 'light';
type RouteMode = 'classic' | 'elk';
type EdgeGeometry = { d: string; labelX: number; labelY: number; points?: ElkPoint[] };
type ElkLayoutResult = {
  pos: Record<string, Position>;
  w: number;
  h: number;
};
type DragTooltipState = {
  text: string;
  clientX: number;
  clientY: number;
};

const DRAG_GRID_SIZE = 5;

function snapToGrid(value: number): number {
  return Math.round(value / DRAG_GRID_SIZE) * DRAG_GRID_SIZE;
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
  const routeMenuRef = useRef<HTMLDivElement>(null);
  const canvasPanelRef = useRef<HTMLDivElement>(null);
  const skipNextLayoutSaveRef = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorMountRef = useRef<HTMLDivElement>(null);
  const [highlightRange, setHighlightRange] = useState<Range | null>(null);
  const [hoveredEditorRange, setHoveredEditorRange] = useState<Range | null>(null);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [routeMode, setRouteMode] = useState<RouteMode>(() => {
    try {
      const saved = localStorage.getItem(ROUTE_MODE_STORAGE_KEY);
      return saved === 'elk' ? 'elk' : 'classic';
    } catch {
      return 'classic';
    }
  });
  const [elkLayoutResult, setElkLayoutResult] = useState<ElkLayoutResult | null>(null);
  const [routeMenuOpen, setRouteMenuOpen] = useState(false);
  const [manualNodePositions, setManualNodePositions] = useState<Record<string, { x: number; y: number }>>(
    initialSnapshot.overrides.nodes
  );
  const [manualEdgePoints, setManualEdgePoints] = useState<Record<string, ElkPoint[]>>(
    initialSnapshot.overrides.edges
  );
  const [dragTooltip, setDragTooltip] = useState<DragTooltipState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const showDevDiagramControls = shouldShowDevDiagramControls(window.location.hostname);
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

  const { collapseAllDataRegions, collapseAllRegions, expandAllRegions } = useDslEditor({
    dsl: currentDsl,
    onDslChange: setCurrentDsl,
    onRangeHover: setHoveredEditorRange,
    editorMountRef,
    highlightRange,
    warnings: parseResult.warnings.map<EditorWarning>((warning) => ({
      range: warning.range,
      message: warning.message
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
      });
    } catch {
      // Ignore storage failures (e.g. restricted environments).
    }
  }, [library.selectedSliceId, manualNodePositions, manualEdgePoints]);

  const layoutResult = useMemo(() => {
    if (!parsed || parsed.nodes.size === 0) {
      return null;
    }
    return layoutGraph(parsed.nodes, parsed.edges, parsed.boundaries);
  }, [parsed]);
  const elkLaneMeta = useMemo(() => (parsed ? buildElkLaneMeta(parsed) : null), [parsed]);

  useEffect(() => {
    if (routeMode !== 'elk' || !parsed) {
      return;
    }

    let active = true;
    computeElkLayout(parsed)
      .then((result) => {
        if (!active) {
          return;
        }
        setElkLayoutResult({ pos: result.pos, w: result.w, h: result.h });
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setElkLayoutResult(null);
      });

    return () => {
      active = false;
    };
  }, [routeMode, parsed, elkLaneMeta]);

  const activeLayout: LayoutResult | ElkLayoutResult | null =
    routeMode === 'elk' && elkLayoutResult ? elkLayoutResult : layoutResult;

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

  const attachmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!parsed) {
      return counts;
    }
    for (const edge of parsed.edges) {
      counts.set(edge.from, (counts.get(edge.from) ?? 0) + 1);
      counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1);
    }
    return counts;
  }, [parsed]);

  const renderedEdges = useMemo(() => {
    if (!parsed || !activeLayout) {
      return [] as Array<{ key: string; edgeKey: string; edge: Parsed['edges'][number]; geometry: EdgeGeometry }>;
    }

    return parsed.edges.map((edge, index) => {
      const edgeKey = `${edge.from}->${edge.to}#${index}`;
      const from = displayedPos[edge.from];
      const to = displayedPos[edge.to];
      if (!from || !to) {
        return null;
      }

      let geometry: EdgeGeometry;
      if (routeMode === 'elk') {
        const base = routeForwardEdge(from, to, {
          sourceAttachmentCount: attachmentCounts.get(edge.from) ?? 1,
          targetAttachmentCount: attachmentCounts.get(edge.to) ?? 1,
          routeIndex: index
        });
        const overridden = manualEdgePoints[edgeKey];
        if (overridden && overridden.length === base.points?.length) {
          const points = overridden.map((point) => ({ ...point }));
          const label = middlePoint(points);
          geometry = {
            d: routePolyline(points),
            labelX: label.x,
            labelY: label.y - 7,
            points
          };
        } else {
          geometry = base;
        }
      } else {
        const path = edgePath(from, to);
        geometry = { d: path.d, labelX: path.labelX, labelY: path.labelY };
      }

      return { key: `${edge.from}-${edge.to}-${index}`, edgeKey, edge, geometry };
    }).filter((value): value is { key: string; edgeKey: string; edge: Parsed['edges'][number]; geometry: EdgeGeometry } => Boolean(value));
  }, [parsed, activeLayout, displayedPos, routeMode, attachmentCounts, manualEdgePoints]);

  const laneOverlay = useMemo(() => {
    if (!parsed || !activeLayout) {
      return null;
    }

    if (layoutResult && routeMode !== 'elk') {
      return {
        usedRows: layoutResult.usedRows,
        rowY: layoutResult.rowY,
        rowStreamLabels: layoutResult.rowStreamLabels,
        height: layoutResult.h
      };
    }

    const rowBuckets = new Map<number, { minY: number; streamLabel: string }>();
    const laneByKey = elkLaneMeta?.laneByKey ?? new Map<string, number>();
    for (const node of parsed.nodes.values()) {
      const position = displayedPos[node.key];
      if (!position) {
        continue;
      }
      const row = laneByKey.get(node.key) ?? rowFor(node.type);
      const existing = rowBuckets.get(row);
      const streamLabel = elkLaneMeta?.rowStreamLabels[row] ?? existing?.streamLabel ?? '';
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
  }, [parsed, activeLayout, layoutResult, routeMode, elkLaneMeta, displayedPos]);

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

  const relatedElements = useMemo(() => {
    if (!parsed) return { nodes: new Set<string>(), edges: new Set<string>() };
    return getRelatedElements(parsed, selectedNodeKey);
  }, [parsed, selectedNodeKey]);

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
      const isCanvasClick = canvas?.contains(target) && target === canvas;
      const isNodeClick = (target as HTMLElement).closest('.node');

      if (isCanvasClick && !isNodeClick) {
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

  const renderDataLine = (line: string, index: number) => {
    const match = line.match(/^(\s*(?:-\s*)?)([^:\n]+:)(.*)$/);
    if (!match) {
      return (
        <div key={index} className="node-field-line">
          {line}
        </div>
      );
    }

    return (
      <div key={index} className="node-field-line">
        {match[1]}
        <span className="node-field-key">{match[2]}</span>
        <span className="node-field-val">{match[3]}</span>
      </div>
    );
  };

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
      .filter((value): value is { edgeKey: string; points: ElkPoint[]; affectsSource: boolean; affectsTarget: boolean } => Boolean(value));

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
                // Keep manually adjusted corner Y stable when moving the attached node vertically.
                base[1] = { x: base[1].x + snappedDx, y: base[1].y };
              }
            }
            if (edge.affectsTarget) {
              base[lastIndex] = { x: base[lastIndex].x + snappedDx, y: base[lastIndex].y + snappedDy };
              if (lastIndex - 1 >= 0) {
                // Keep manually adjusted corner Y stable when moving the attached node vertically.
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

  const beginEdgeSegmentDrag = (event: ReactPointerEvent, edgeKey: string, segmentIndex: number, points: ElkPoint[]) => {
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
  };

  const applySelectedSliceOverrides = (sliceId: string) => {
    const overrides = loadSliceLayoutOverrides(sliceId);
    skipNextLayoutSaveRef.current = true;
    setManualNodePositions(overrides.nodes);
    setManualEdgePoints(overrides.edges);
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
    let didMove = false;
    setIsPanning(true);

    const onMove = (moveEvent: PointerEvent) => {
      if ((moveEvent.buttons & 1) === 0) {
        return;
      }
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!didMove && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        didMove = true;
      }
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
            <div className="legend-dot" style={{ background: 'var(--rm)' }} />
            <span>read model</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'var(--evt)' }} />
            <span>event</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'var(--exc)' }} />
            <span>exception</span>
          </div>
        </div>
        <div className="slice-controls">
          <label className="sr-only" htmlFor="slice-select">
            Select slice
          </label>
          <select
            id="slice-select"
            className="slice-select"
            aria-label="Select slice"
            value={library.selectedSliceId}
            onChange={(event) => {
              setSelectedNodeKey(null);
              setHighlightRange(null);
              setLibrary((currentLibrary) => {
                const nextLibrary = selectSlice(currentLibrary, event.target.value);
                if (nextLibrary.selectedSliceId !== currentLibrary.selectedSliceId) {
                  applySelectedSliceOverrides(nextLibrary.selectedSliceId);
                }
                return nextLibrary;
              });
            }}
          >
            {library.slices.map((slice) => (
              <option key={slice.id} value={slice.id}>
                {getSliceNameFromDsl(slice.dsl)}
              </option>
            ))}
          </select>
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
          className="theme-toggle"
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
        {showDevDiagramControls && (
          <>
            <div className="route-menu" ref={routeMenuRef}>
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
              className="route-toggle"
              aria-label="Print diagram geometry"
              title="Print current node/edge geometry to console (and clipboard when available)"
              onClick={printDiagramGeometry}
            >
              Geometry
            </button>
          </>
        )}
      </header>

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
          className={`canvas-panel ${isPanning ? 'panning' : ''}`}
          onPointerDown={beginCanvasPan}
        >
          <div
            id="canvas"
            style={{
              width: activeLayout ? `${activeLayout.w}px` : undefined,
              height: activeLayout ? `${activeLayout.h}px` : undefined
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
            {parsed && activeLayout && (
              <>
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
                  const x = afterPos.x + afterPos.w + 40;
                  return (
                    <div
                      key={`slice-divider-${index}-${boundary.after}`}
                      className="slice-divider"
                      style={{ left: `${x}px`, height: `${activeLayout.h}px` }}
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

                  const isHighlighted = activeNodeKeyFromEditor === node.key;
                  const isSelected = selectedNodeKey === node.key;
                  const isRelated = relatedElements.nodes.has(node.key);

                  return (
                    <div
                      key={node.key}
                      className={`node ${node.type || 'rm'} ${isHighlighted ? 'highlighted' : ''} ${isSelected ? 'selected' : ''} ${isRelated ? 'related' : ''}`}
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
                      onPointerDown={(event) => beginNodeDrag(event, node.key)}
                    >
                      <div className="node-header">
                        <span className="node-prefix">{TYPE_LABEL[node.type] ?? node.type}:</span>
                        <span>{node.alias ?? node.name.replace(NODE_VERSION_SUFFIX, '')}</span>
                      </div>

                      {node.data && (
                        <div className="node-fields">
                          {formatNodeData(node.data).map((field) => (
                            <div key={`${node.key}-${field.key}`} className="node-field">
                              <div className="node-field-lines">
                                {field.text.split('\n').map((line, index) => renderDataLine(line, index))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                <svg id="arrows" width={activeLayout.w} height={activeLayout.h}>
                  <defs>
                    <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill="var(--arrow)" />
                    </marker>
                    <marker id="arr-related" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill="var(--text)" />
                    </marker>
                  </defs>

                  {renderedEdges.map(({ key, edgeKey, edge, geometry }) => {
                    const isRelated = relatedElements.edges.has(`${edge.from}->${edge.to}`);

                    return (
                      <g key={key} className={isRelated ? 'related' : ''}>
                        <path d={geometry.d} className="arrow-path" markerEnd={isRelated ? "url(#arr-related)" : "url(#arr)"} />
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
                        {routeMode === 'elk' &&
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
                                onPointerDown={(event) => beginEdgeSegmentDrag(event, edgeKey, pointIndex, geometry.points!)}
                              />
                            );
                          })}
                      </g>
                    );
                  })}
                </svg>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
