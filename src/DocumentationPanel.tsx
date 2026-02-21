import { useMemo } from 'react';
import { DOCUMENTATION_GROUPS, DocumentationFeature } from './documentationCatalog';
import { buildRenderedEdges, computeClassicDiagramLayout } from './domain/diagramEngine';
import { MISSING_DATA_VALUE } from './domain/dataMapping';
import { formatNodeData } from './domain/formatNodeData';
import { PAD_X } from './domain/layoutGraph';
import { parseDsl } from './domain/parseDsl';
import { ReadOnlyDslEditor } from './ReadOnlyDslEditor';

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

const PREVIEW_MARGIN = 64;

type PreviewData =
  | {
      error: string;
    }
  | {
      error: '';
      parsed: ReturnType<typeof parseDsl>;
      layout: ReturnType<typeof computeClassicDiagramLayout>;
      renderedEdges: ReturnType<typeof buildRenderedEdges>;
      viewport: {
        width: number;
        height: number;
        offsetX: number;
        offsetY: number;
      };
    };

function renderDataLine(line: string, index: number) {
  const match = line.match(/^(\s*(?:-\s*)?)([^:\n]+:)(.*)$/);
  if (!match) {
    return (
      <div key={index} className="node-field-line">
        {line}
      </div>
    );
  }

  const value = match[3];
  const isMissing = value.trim() === MISSING_DATA_VALUE;

  return (
    <div key={index} className={`node-field-line${isMissing ? ' missing' : ''}`}>
      {match[1]}
      <span className="node-field-key">{match[2]}</span>
      <span className="node-field-val">{value}</span>
    </div>
  );
}

function computePreview(feature: DocumentationFeature): PreviewData {
  try {
    const parsed = parseDsl(feature.dsl);
    const layout = computeClassicDiagramLayout(parsed);
    if (!layout) {
      return { error: 'No nodes to render in this example.' };
    }

    const renderedEdges = buildRenderedEdges(parsed, layout.layout.pos, 'classic', {});

    let minX = 0;
    let minY = 0;
    let maxX = layout.layout.w;
    let maxY = layout.layout.h;

    for (const position of Object.values(layout.layout.pos)) {
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + position.w);
      maxY = Math.max(maxY, position.y + position.h);
    }

    for (const rendered of renderedEdges) {
      for (const point of rendered.geometry.points ?? []) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);

    return {
      error: '',
      parsed,
      layout,
      renderedEdges,
      viewport: {
        width: contentWidth + PREVIEW_MARGIN * 2,
        height: contentHeight + PREVIEW_MARGIN * 2,
        offsetX: PREVIEW_MARGIN - minX,
        offsetY: PREVIEW_MARGIN - minY
      }
    };
  } catch (error) {
    return { error: (error as Error).message || 'Unable to render example.' };
  }
}

function FeatureCard({ feature }: { feature: DocumentationFeature }) {
  const preview = useMemo(() => computePreview(feature), [feature]);

  return (
    <article className="doc-feature-card">
      <div className="doc-feature-header">
        <div>
          <h4>{feature.title}</h4>
          <p>{feature.description}</p>
        </div>
      </div>

      <div className="doc-feature-content">
        <ReadOnlyDslEditor className="doc-dsl" value={feature.dsl} copyAriaLabel={`Copy example for ${feature.title}`} />

        {'parsed' in preview && preview.error === '' ? (
          <div className="doc-diagram-shell">
            <div
              className="doc-diagram"
              style={{
                width: `${preview.viewport.width}px`,
                height: `${preview.viewport.height}px`
              }}
            >
              <div
                className="canvas-world"
                style={{ transform: `translate(${preview.viewport.offsetX}px, ${preview.viewport.offsetY}px)` }}
              >
              {preview.layout.layout.usedRows.map((row, i) => {
                const bandTop = preview.layout.layout.rowY[row] - 28;
                const bandHeight =
                  i < preview.layout.layout.usedRows.length - 1
                    ? preview.layout.layout.rowY[preview.layout.layout.usedRows[i + 1]] - preview.layout.layout.rowY[row]
                    : preview.layout.layout.h - bandTop;
                const streamLabel = preview.layout.layout.rowStreamLabels[row];

                return (
                  <div key={`lane-${feature.id}-${row}`}>
                    <div className="lane-band" style={{ top: `${bandTop}px`, height: `${bandHeight}px` }} />
                    {streamLabel && (
                      <div className="lane-stream-label" style={{ top: `${bandTop + 8}px`, left: `${Math.max(8, PAD_X - 48)}px` }}>
                        {streamLabel}
                      </div>
                    )}
                  </div>
                );
              })}

              {preview.parsed.boundaries.map((boundary, index) => {
                const afterPos = preview.layout.layout.pos[boundary.after];
                if (!afterPos) {
                  return null;
                }
                const topLaneRow = preview.layout.layout.usedRows[0];
                const topLaneY = topLaneRow === undefined ? 0 : (preview.layout.layout.rowY[topLaneRow] ?? 0);
                const dividerTop = topLaneY - 68;
                const dividerHeight = preview.layout.layout.h - dividerTop;
                const x = afterPos.x + afterPos.w + 40;
                return (
                  <div
                    key={`slice-divider-${feature.id}-${index}-${boundary.after}`}
                    className="slice-divider"
                    style={{ left: `${x}px`, top: `${dividerTop}px`, height: `${dividerHeight}px` }}
                  />
                );
              })}

              {preview.parsed.sliceName && (
                <div className="slice-title" style={{ top: '6px', left: `${PAD_X}px` }}>
                  {preview.parsed.sliceName}
                </div>
              )}

              {[...preview.parsed.nodes.values()].map((node) => {
                const position = preview.layout.layout.pos[node.key];
                if (!position) {
                  return null;
                }
                const nodePrefix = TYPE_LABEL[node.type] ?? node.type;

                return (
                  <div
                    key={`${feature.id}-${node.key}`}
                    className={`node ${node.type || 'rm'} doc-node`}
                    style={{
                      left: `${position.x}px`,
                      top: `${position.y}px`,
                      width: `${position.w}px`,
                      height: `${position.h}px`
                    }}
                  >
                    <div className="node-header">
                      {nodePrefix ? <span className="node-prefix">{nodePrefix}:</span> : null}
                      <span className="node-title">{node.alias ?? node.name}</span>
                    </div>

                    {node.data && (
                      <div className="node-fields">
                        {formatNodeData(node.data).map((field) => (
                          <div key={`${feature.id}-${node.key}-${field.key}`} className="node-field">
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

                <svg className="doc-arrows" width={preview.layout.layout.w} height={preview.layout.layout.h}>
                  <defs>
                    <marker id={`doc-arr-${feature.id}`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill="var(--arrow)" />
                    </marker>
                  </defs>
                  {preview.renderedEdges.map(({ key, geometry }) => (
                    <g key={`${feature.id}-${key}`}>
                      <path d={geometry.d} className="arrow-path" markerEnd={`url(#doc-arr-${feature.id})`} />
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </div>
        ) : (
          <div className="doc-render-error">⚠ {preview.error}</div>
        )}
      </div>
    </article>
  );
}

export function DocumentationPanel() {
  return (
    <div className="docs-panel">
      <div className="docs-panel-inner">
        <section className="docs-intro">
          <h2>Syntax Documentation</h2>
          <p>Use these examples as a quick reference for writing valid diagram syntax.</p>
        </section>

        {DOCUMENTATION_GROUPS.map((group) => (
          <section key={group.id} className="doc-group">
            <div className="doc-group-header">
              <h3>{group.title}</h3>
              <p>{group.description}</p>
            </div>
            <div className="doc-feature-list">
              {group.features.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
