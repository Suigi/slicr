import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { DEFAULT_DSL } from './defaultDsl';
import { dslHighlightDecorations } from './dslHighlightDecorations';

type NodeType = string;

type NodeData = Record<string, unknown> | null;

type VisualNode = {
  type: NodeType;
  name: string;
  key: string;
  data: NodeData;
};

type Edge = {
  from: string;
  to: string;
  label: string | null;
};

type Parsed = {
  sliceName: string;
  nodes: Map<string, VisualNode>;
  edges: Edge[];
};

type Position = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type LayoutResult = {
  pos: Record<string, Position>;
  rowY: Record<number, number>;
  usedRows: number[];
  w: number;
  h: number;
};

type ParseResult =
  | { parsed: Parsed; error: '' }
  | { parsed: null; error: string };

type Item = {
  kind: 'arrow' | 'artifact';
  indent: number;
  type: NodeType;
  name: string;
  label?: string | null;
  data: NodeData;
};

const TYPE_LABEL: Record<string, string> = {
  rm: 'rm',
  cmd: 'cmd',
  evt: 'evt',
  exc: 'exc',
  ui: 'ui',
  aut: 'aut',
  ext: 'ext'
};

const NODE_W = 180;
const NODE_H_BASE = 42;
const NODE_FIELD_H = 16;
const NODE_FIELD_PAD = 10;
const COL_GAP = 80;
const PAD_X = 56;
const PAD_TOP = 16;
const ROW_GAP = 120;

function parse(src: string): Parsed {
  const lines = src.split('\n');
  const nodes = new Map<string, VisualNode>();
  const edges: Edge[] = [];
  let sliceName = '';
  const nameCounts: Record<string, number> = {};

  for (const line of lines) {
    const match = line.match(/^slice\s+"([^"]+)"/);
    if (match) {
      sliceName = match[1];
      break;
    }
  }

  const items: Item[] = [];
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('slice')) {
      continue;
    }

    const indent = (line.match(/^(\s*)/)?.[1] ?? '').length;
    const content = line.trim();

    const dataMatch = content.match(/^data:\s*(.+)$/);
    if (dataMatch && items.length > 0) {
      try {
        items[items.length - 1].data = JSON.parse(dataMatch[1]) as Record<string, unknown>;
      } catch {
        // Keep parity with original behavior: ignore bad data blocks.
      }
      continue;
    }

    const arrowMatch = content.match(/^->\s+([a-z]+):([^\s\[]+)(?:\s+\[([^\]]+)])?$/);
    if (arrowMatch) {
      items.push({
        kind: 'arrow',
        indent,
        type: arrowMatch[1],
        name: arrowMatch[2],
        label: arrowMatch[3] ?? null,
        data: null
      });
      continue;
    }

    const artifactMatch = content.match(/^([a-z]+):([^\s\[]+)$/);
    if (artifactMatch) {
      items.push({
        kind: 'artifact',
        indent,
        type: artifactMatch[1],
        name: artifactMatch[2],
        data: null
      });
    }
  }

  const makeKey = (type: string, name: string) => {
    if (type === 'rm' || type === 'ui') {
      const count = (nameCounts[name] ?? 0) + 1;
      nameCounts[name] = count;
      return count === 1 ? name : `${name}#${count}`;
    }
    return name;
  };

  const ownerAt: Record<number, string> = {};

  for (const item of items) {
    const key = makeKey(item.type, item.name);

    if (!nodes.has(key)) {
      nodes.set(key, {
        type: item.type,
        name: item.name,
        key,
        data: item.data
      });
    } else if (item.data) {
      const current = nodes.get(key);
      if (current) {
        current.data = item.data;
      }
    }

    if (item.kind === 'artifact') {
      ownerAt[item.indent] = key;
      continue;
    }

    let from: string | null = null;
    const sorted = Object.keys(ownerAt)
      .map(Number)
      .sort((a, b) => b - a);

    for (const value of sorted) {
      if (value < item.indent) {
        from = ownerAt[value];
        break;
      }
    }

    if (from) {
      edges.push({ from, to: key, label: item.label ?? null });
    }

    ownerAt[item.indent] = key;
  }

  return { sliceName, nodes, edges };
}

function nodeHeight(node: VisualNode): number {
  if (!node.data) {
    return NODE_H_BASE;
  }

  const fields = Object.keys(node.data).length;
  return NODE_H_BASE + NODE_FIELD_PAD + fields * NODE_FIELD_H;
}

function rowFor(type: string): number {
  if (type === 'ui') {
    return 0;
  }
  if (type === 'evt') {
    return 2;
  }
  return 1;
}

function layout(nodes: Map<string, VisualNode>, edges: Edge[]): LayoutResult {
  const inDeg: Record<string, number> = {};
  nodes.forEach((_, key) => {
    inDeg[key] = 0;
  });

  for (const edge of edges) {
    if (nodes.has(edge.to)) {
      inDeg[edge.to] += 1;
    }
  }

  const encounterOrder: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [...nodes.keys()].filter((key) => !inDeg[key]);

  if (queue.length === 0) {
    const firstKey = nodes.keys().next().value as string | undefined;
    if (firstKey) {
      queue.push(firstKey);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (visited.has(current)) {
      continue;
    }

    visited.add(current);
    encounterOrder.push(current);

    for (const edge of edges) {
      if (edge.from === current && !visited.has(edge.to)) {
        queue.push(edge.to);
      }
    }
  }

  nodes.forEach((_, key) => {
    if (!visited.has(key)) {
      encounterOrder.push(key);
    }
  });

  const minColSource: Record<string, string | string[]> = {};

  for (const edge of edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
      continue;
    }

    if (minColSource[edge.to] === undefined) {
      minColSource[edge.to] = edge.from;
    } else {
      const current = minColSource[edge.to];
      if (Array.isArray(current)) {
        current.push(edge.from);
      } else {
        minColSource[edge.to] = [current, edge.from];
      }
    }
  }

  const col: Record<string, number> = {};
  const occupied: Record<string, boolean> = {};

  for (const key of encounterOrder) {
    const node = nodes.get(key);
    if (!node) {
      continue;
    }

    const row = rowFor(node.type);
    let startCol = 0;
    const sources = minColSource[key];

    if (sources !== undefined) {
      const list = Array.isArray(sources) ? sources : [sources];
      for (const source of list) {
        if (col[source] !== undefined) {
          startCol = Math.max(startCol, col[source]);
        }
      }
    }

    let currentCol = startCol;
    while (occupied[`${currentCol},${row}`]) {
      currentCol += 1;
    }

    col[key] = currentCol;
    occupied[`${currentCol},${row}`] = true;
  }

  const usedRows = [...new Set([...nodes.values()].map((node) => rowFor(node.type)))].sort((a, b) => a - b);

  const rowY: Record<number, number> = {};
  usedRows.forEach((row, i) => {
    rowY[row] = PAD_TOP + 32 + i * (NODE_H_BASE + ROW_GAP);
  });

  const numCols = Math.max(...Object.values(col)) + 1;
  const colX: Record<number, number> = {};
  for (let c = 0; c < numCols; c += 1) {
    colX[c] = PAD_X + c * (NODE_W + COL_GAP);
  }

  const pos: Record<string, Position> = {};
  nodes.forEach((node, key) => {
    pos[key] = {
      x: colX[col[key]],
      y: rowY[rowFor(node.type)],
      w: NODE_W,
      h: nodeHeight(node)
    };
  });

  const maxX = Math.max(...Object.values(pos).map((value) => value.x + value.w)) + PAD_X;
  const maxY = Math.max(...Object.values(pos).map((value) => value.y + value.h)) + 48;

  return { pos, rowY, usedRows, w: maxX, h: maxY };
}

function edgePath(from: Position, to: Position) {
  const fromMidX = from.x + from.w / 2;
  const fromMidY = from.y + from.h / 2;
  const toMidX = to.x + to.w / 2;
  const toMidY = to.y + to.h / 2;
  const sameRow = Math.abs(from.y - to.y) < 4;

  if (sameRow) {
    const x1 = from.x + from.w;
    const y1 = fromMidY;
    const x2 = to.x;
    const y2 = toMidY;
    const cx = (x1 + x2) / 2;

    return {
      d: `M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`,
      labelX: cx,
      labelY: y1 - 7
    };
  }

  const goDown = to.y > from.y;
  const x1 = fromMidX;
  const y1 = goDown ? from.y + from.h : from.y;
  const x2 = toMidX;
  const y2 = goDown ? to.y : to.y + to.h;
  const cy = (y1 + y2) / 2;

  return {
    d: `M ${x1} ${y1} C ${x1} ${cy} ${x2} ${cy} ${x2} ${y2}`,
    labelX: (x1 + x2) / 2 + 6,
    labelY: cy
  };
}

function App() {
  const [dsl, setDsl] = useState(DEFAULT_DSL);
  const [editorOpen, setEditorOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorMountRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  const parseResult = useMemo<ParseResult>(() => {
    try {
      return { parsed: parse(dsl), error: '' };
    } catch (error) {
      return { parsed: null, error: `⚠ ${(error as Error).message}` };
    }
  }, [dsl]);

  const layoutResult = useMemo(() => {
    if (!parseResult.parsed || parseResult.parsed.nodes.size === 0) {
      return null;
    }
    return layout(parseResult.parsed.nodes, parseResult.parsed.edges);
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

  useEffect(() => {
    if (!editorMountRef.current || editorViewRef.current) {
      return;
    }

    const editorView = new EditorView({
      state: EditorState.create({
        doc: dsl,
        extensions: [
          dslHighlightDecorations,
          EditorView.lineWrapping,
          EditorView.theme({
            '&': {
              height: '100%',
              backgroundColor: 'transparent'
            },
            '.cm-scroller': {
              overflow: 'auto',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '13px',
              lineHeight: '1.7',
              padding: '16px'
            },
            '.cm-content': {
              caretColor: '#f97316'
            },
            '.cm-cursor, .cm-dropCursor': {
              borderLeftColor: '#f97316'
            },
            '.cm-selectionBackground, ::selection': {
              backgroundColor: 'rgb(59 130 246 / 30%)'
            },
            '&.cm-focused': {
              outline: 'none'
            },
            '.cm-activeLine': {
              backgroundColor: 'rgb(255 255 255 / 2%)'
            }
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) {
              return;
            }

            const nextValue = update.state.doc.toString();
            setDsl((current) => (current === nextValue ? current : nextValue));
          })
        ]
      }),
      parent: editorMountRef.current
    });

    editorViewRef.current = editorView;

    return () => {
      editorView.destroy();
      editorViewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editorView = editorViewRef.current;
    if (!editorView) {
      return;
    }

    const current = editorView.state.doc.toString();
    if (current === dsl) {
      return;
    }

    editorView.dispatch({
      changes: { from: 0, to: current.length, insert: dsl }
    });
  }, [dsl]);

  const parsed = parseResult.parsed;
  const errorText = parseResult.error;

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
                        <span>{node.name}</span>
                      </div>

                      {node.data && (
                        <div className="node-fields">
                          {Object.entries(node.data).map(([key, value]) => (
                            <div key={`${node.key}-${key}`} className="node-field">
                              <span className="node-field-key">{key}:</span>
                              <span className="node-field-val">{JSON.stringify(value)}</span>
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
