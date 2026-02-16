import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_DSL } from './defaultDsl';
import { edgePath } from './domain/edgePath';
import { formatNodeData } from './domain/formatNodeData';
import { layoutGraph, PAD_X } from './domain/layoutGraph';
import { parseDsl } from './domain/parseDsl';
import type { Parsed } from './domain/types';
import { useDslEditor } from './useDslEditor';

type ParseResult =
  | { parsed: Parsed; error: '' }
  | { parsed: null; error: string };

const TYPE_LABEL: Record<string, string> = {
  rm: 'rm',
  cmd: 'cmd',
  evt: 'evt',
  exc: 'exc',
  ui: 'ui',
  aut: 'aut',
  ext: 'ext'
};

const DSL_STORAGE_KEY = 'slicr.dsl';
const NODE_VERSION_SUFFIX = /@\d+$/;

function readInitialDsl(): string {
  try {
    const savedDsl = localStorage.getItem(DSL_STORAGE_KEY);
    return savedDsl ?? DEFAULT_DSL;
  } catch {
    return DEFAULT_DSL;
  }
}

function App() {
  const [dsl, setDsl] = useState(readInitialDsl);
  const [editorOpen, setEditorOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorMountRef = useRef<HTMLDivElement>(null);

  useDslEditor({ dsl, onDslChange: setDsl, editorMountRef });

  useEffect(() => {
    try {
      localStorage.setItem(DSL_STORAGE_KEY, dsl);
    } catch {
      // Ignore storage failures (e.g. restricted environments).
    }
  }, [dsl]);

  const parseResult = useMemo<ParseResult>(() => {
    try {
      return { parsed: parseDsl(dsl), error: '' };
    } catch (error) {
      return { parsed: null, error: `⚠ ${(error as Error).message}` };
    }
  }, [dsl]);

  const layoutResult = useMemo(() => {
    if (!parseResult.parsed || parseResult.parsed.nodes.size === 0) {
      return null;
    }
    return layoutGraph(parseResult.parsed.nodes, parseResult.parsed.edges);
  }, [parseResult]);

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

  const parsed = parseResult.parsed;
  const errorText = parseResult.error;
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
        <h1>Slice Visualizer</h1>
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
            DSL
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

                  return (
                    <div
                      key={node.key}
                      className={`node ${node.type || 'rm'}`}
                      style={{
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        width: `${position.w}px`,
                        height: `${position.h}px`
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
                  </defs>

                  {parsed.edges.map((edge, index) => {
                    const from = layoutResult.pos[edge.from];
                    const to = layoutResult.pos[edge.to];
                    if (!from || !to) {
                      return null;
                    }

                    const geometry = edgePath(from, to);

                    return (
                      <g key={`${edge.from}-${edge.to}-${index}`}>
                        <path d={geometry.d} className="arrow-path" markerEnd="url(#arr)" />
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
