import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_DSL } from './defaultDsl';
import { edgePath } from './domain/edgePath';
import { formatNodeData } from './domain/formatNodeData';
import { layoutGraph, PAD_X } from './domain/layoutGraph';
import { parseDsl } from './domain/parseDsl';
import { getRelatedElements } from './domain/traversal';
import type { Parsed } from './domain/types';
import { addNewSlice, getSliceNameFromDsl, loadSliceLibrary, saveSliceLibrary, selectSlice, updateSelectedSliceDsl } from './sliceLibrary';
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

function App() {
  const [library, setLibrary] = useState(loadSliceLibrary);
  const [editorOpen, setEditorOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorMountRef = useRef<HTMLDivElement>(null);
  const [highlightRange, setHighlightRange] = useState<Range | null>(null);
  const [hoveredEditorRange, setHoveredEditorRange] = useState<Range | null>(null);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
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
  const errorText =
    parseResult.error || parseResult.warnings.map((warning) => `⚠ ${warning.message}`).join(' · ');
  const currentSliceName = getSliceNameFromDsl(currentDsl);

  const { collapseAllDataRegions, collapseAllRegions } = useDslEditor({
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

  const layoutResult = useMemo(() => {
    if (!parsed || parsed.nodes.size === 0) {
      return null;
    }
    return layoutGraph(parsed.nodes, parsed.edges);
  }, [parsed]);

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
              setLibrary((currentLibrary) => selectSlice(currentLibrary, event.target.value));
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
            onClick={() => {
              setSelectedNodeKey(null);
              setHighlightRange(null);
              setLibrary((currentLibrary) => addNewSlice(currentLibrary));
            }}
          >
            New
          </button>
        </div>

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
            >
              Collapse data
            </button>
            <button
              type="button"
              className="panel-action"
              onClick={collapseAllRegions}
              aria-label="Collapse all regions"
            >
              Collapse all
            </button>
          </div>
          <div ref={editorMountRef} className="dsl-editor" />
          <div className="error-bar">{errorText}</div>
        </div>

        <div className="canvas-panel">
          <div
            id="canvas"
            style={{
              width: layoutResult ? `${layoutResult.w}px` : undefined,
              height: layoutResult ? `${layoutResult.h}px` : undefined
            }}
          >
            {parsed && layoutResult && (
              <>
                {layoutResult.usedRows.map((row, i) => {
                  const bandTop = layoutResult.rowY[row] - 28;
                  const bandHeight =
                    i < layoutResult.usedRows.length - 1
                      ? layoutResult.rowY[layoutResult.usedRows[i + 1]] - layoutResult.rowY[row]
                      : layoutResult.h - bandTop;

                  return (
                    <div
                      key={`lane-${row}`}
                      className="lane-band"
                      style={{ top: `${bandTop}px`, height: `${bandHeight}px` }}
                    />
                  );
                })}

                {parsed.sliceName && (
                  <div className="slice-title" style={{ top: '6px', left: `${PAD_X}px` }}>
                    {parsed.sliceName}
                  </div>
                )}

                {[...parsed.nodes.values()].map((node) => {
                  const position = layoutResult.pos[node.key];
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
                    >
                      <div className="node-header">
                        <span className="node-prefix">{TYPE_LABEL[node.type] ?? node.type}:</span>
                        <span>{node.name.replace(NODE_VERSION_SUFFIX, '')}</span>
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

                <svg id="arrows" width={layoutResult.w} height={layoutResult.h}>
                  <defs>
                    <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill="#3a3a52" />
                    </marker>
                    <marker id="arr-related" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill="var(--text)" />
                    </marker>
                  </defs>

                  {parsed.edges.map((edge, index) => {
                    const from = layoutResult.pos[edge.from];
                    const to = layoutResult.pos[edge.to];
                    if (!from || !to) {
                      return null;
                    }

                    const geometry = edgePath(from, to);
                    const isRelated = relatedElements.edges.has(`${edge.from}->${edge.to}`);

                    return (
                      <g key={`${edge.from}-${edge.to}-${index}`} className={isRelated ? 'related' : ''}>
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
