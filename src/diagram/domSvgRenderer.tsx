import type { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from 'react';
import { supportsEditableEdgePoints, type DiagramEngineId } from '../domain/diagramEngine';
import type { DiagramPoint } from '../domain/diagramRouting';
import type { DiagramSceneModel } from './rendererContract';
import type { DiagramRendererId } from '../domain/runtimeFlags';
import { NodeCard } from '../NodeCard';
import type { Range } from '../useDslEditor';
import type { DragTooltipState } from '../useDiagramInteractions';
import type { DiagramScenarioNode } from './rendererContract';

function toScenarioNodeCardProps(entry: DiagramScenarioNode) {
  return {
    node: entry.node ?? {
      type: entry.type,
      name: entry.title,
      alias: null,
      stream: null,
      key: entry.key,
      data: null,
      srcRange: entry.srcRange
    },
    nodePrefix: entry.nodePrefix ?? entry.prefix
  };
}

function scenarioAreaLeft(sceneModel: DiagramSceneModel): number {
  if (sceneModel.nodes.length === 0) {
    return 0;
  }
  return Math.min(...sceneModel.nodes.map((node) => node.x));
}

export type DiagramRendererAdapterProps = {
  sceneModel: DiagramSceneModel | null;
  canvasPanelRef: RefObject<HTMLDivElement>;
  isPanning: boolean;
  docsOpen: boolean;
  dragTooltip: DragTooltipState | null;
  dragAndDropEnabled: boolean;
  routeMode: DiagramEngineId;
  beginCanvasPan: (event: ReactPointerEvent<HTMLDivElement>) => void;
  beginNodeDrag: (event: ReactPointerEvent, nodeKey: string) => void;
  beginEdgeSegmentDrag: (
    event: ReactPointerEvent,
    edgeKey: string,
    segmentIndex: number,
    points: DiagramPoint[]
  ) => void;
  onNodeHoverRange: (range: Range | null) => void;
  onNodeSelect: (nodeKey: string) => void;
  onNodeOpenInEditor: (nodeKey: string, range: Range) => void;
  onEdgeHover: Dispatch<SetStateAction<string | null>>;
  rendererId?: DiagramRendererId;
  cameraControlsEnabled?: boolean;
  initialCamera?: { x: number; y: number; zoom: number };
};

export function DomSvgDiagramRenderer({
  sceneModel,
  canvasPanelRef,
  isPanning,
  docsOpen,
  dragTooltip,
  dragAndDropEnabled,
  routeMode,
  beginCanvasPan,
  beginNodeDrag,
  beginEdgeSegmentDrag,
  onNodeHoverRange,
  onNodeSelect,
  onNodeOpenInEditor,
  onEdgeHover,
  rendererId = 'dom-svg'
}: DiagramRendererAdapterProps) {
  return (
    <div
      ref={canvasPanelRef}
      className={`canvas-panel ${isPanning ? 'panning' : ''} ${docsOpen ? 'hidden' : ''}`}
      onPointerDown={beginCanvasPan}
      aria-hidden={docsOpen}
      data-diagram-renderer={rendererId}
    >
      <div
        id="canvas"
        style={{
          width: sceneModel?.viewport ? `${sceneModel.viewport.width}px` : undefined,
          height: sceneModel?.viewport ? `${sceneModel.viewport.height}px` : undefined
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
        {sceneModel?.viewport && (
          <div
            className="canvas-world"
            style={{ transform: `translate(${sceneModel.viewport.offsetX}px, ${sceneModel.viewport.offsetY}px)` }}
          >
            {sceneModel.lanes.map((lane) => (
              <div key={lane.key}>
                <div
                  className="lane-band"
                  style={{ top: `${lane.bandTop}px`, height: `${lane.bandHeight}px` }}
                />
                {lane.streamLabel && (
                  <div className="lane-stream-label" style={{ top: `${lane.labelTop}px`, left: `${lane.labelLeft}px` }}>
                    {lane.streamLabel}
                  </div>
                )}
              </div>
            ))}

            {sceneModel.boundaries.map((boundary) => (
              <div
                key={boundary.key}
                className="slice-divider"
                style={{ left: `${boundary.left}px`, top: `${boundary.top}px`, height: `${boundary.height}px` }}
              />
            ))}

            {sceneModel.title && (
              <div className="slice-title" style={{ top: `${sceneModel.title.top}px`, left: `${sceneModel.title.left}px` }}>
                {sceneModel.title.text}
              </div>
            )}

            {sceneModel.nodes.map((entry) => (
              <NodeCard
                key={entry.renderKey}
                node={entry.node}
                nodePrefix={entry.nodePrefix}
                className={entry.className}
                style={{
                  left: `${entry.x}px`,
                  top: `${entry.y}px`,
                  width: `${entry.w}px`,
                  height: `${entry.h}px`
                }}
                onMouseEnter={() => onNodeHoverRange(entry.srcRange)}
                onMouseLeave={() => onNodeHoverRange(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  onNodeSelect(entry.key);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  onNodeOpenInEditor(entry.key, entry.srcRange);
                }}
                onPointerDown={(event) => beginNodeDrag(event, entry.key)}
              />
            ))}

            <svg id="arrows" width={sceneModel.worldWidth} height={sceneModel.worldHeight}>
              <defs>
                <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill="var(--arrow)" />
                </marker>
                <marker id="arr-related" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill="var(--edge-highlight)" />
                </marker>
              </defs>

              {sceneModel.edges.map((edge) => {
                const handleEdgeHoverEnter = () => onEdgeHover(edge.edgeKey);
                const handleEdgeHoverLeave = () => {
                  onEdgeHover((current) => (current === edge.edgeKey ? null : current));
                };

                return (
                  <g key={edge.renderKey} className={`${edge.related ? 'related ' : ''}${edge.hovered ? 'hovered' : ''}`.trim()}>
                    <path
                      d={edge.path}
                      className="edge-hover-target"
                      onPointerEnter={handleEdgeHoverEnter}
                      onPointerLeave={handleEdgeHoverLeave}
                      onMouseEnter={handleEdgeHoverEnter}
                      onMouseLeave={handleEdgeHoverLeave}
                    />
                    <path
                      d={edge.path}
                      className="arrow-path"
                      markerEnd={edge.related ? 'url(#arr-related)' : 'url(#arr)'}
                      onPointerEnter={handleEdgeHoverEnter}
                      onPointerLeave={handleEdgeHoverLeave}
                      onMouseEnter={handleEdgeHoverEnter}
                      onMouseLeave={handleEdgeHoverLeave}
                    />
                    {edge.label && (
                      <text
                        className="arrow-label"
                        textAnchor="middle"
                        x={edge.labelX}
                        y={edge.labelY}
                      >
                        [{edge.label}]
                      </text>
                    )}
                    {dragAndDropEnabled &&
                      supportsEditableEdgePoints(routeMode) &&
                      edge.points?.map((point, pointIndex) => {
                        const nextPoint = edge.points?.[pointIndex + 1];
                        if (!nextPoint) {
                          return null;
                        }
                        if (!edge.draggableSegmentIndices.includes(pointIndex)) {
                          return null;
                        }
                        return (
                          <line
                            key={`${edge.edgeKey}-segment-handle-${pointIndex}`}
                            x1={point.x}
                            y1={point.y}
                            x2={nextPoint.x}
                            y2={nextPoint.y}
                            className="edge-segment-handle"
                            onPointerEnter={handleEdgeHoverEnter}
                            onPointerLeave={handleEdgeHoverLeave}
                            onMouseEnter={handleEdgeHoverEnter}
                            onMouseLeave={handleEdgeHoverLeave}
                            onPointerDown={(event) => beginEdgeSegmentDrag(event, edge.edgeKey, pointIndex, edge.points)}
                          />
                        );
                      })}
                  </g>
                );
              })}
            </svg>

            {sceneModel.scenarios.length > 0 && (
              <div
                className="scenario-area"
                style={{
                  top: `${sceneModel.worldHeight + 24}px`,
                  left: `${scenarioAreaLeft(sceneModel)}px`
                }}
              >
                {sceneModel.scenarios.map((scenario) => (
                  <section
                    key={`${scenario.name}-${scenario.srcRange.from}`}
                    className="scenario-box"
                  >
                    <h3 className="scenario-title">{scenario.name}</h3>
                    <div className="scenario-section">
                      <div className="scenario-section-label">Given</div>
                      {scenario.given.map((entry, index) => (
                        <NodeCard
                          key={`${scenario.name}-given-${entry.key}-${index}`}
                          {...toScenarioNodeCardProps(entry)}
                          className="scenario-node-card"
                        />
                      ))}
                    </div>
                    <div className="scenario-section">
                      <div className="scenario-section-label">When</div>
                      {scenario.when && (
                        <NodeCard
                          {...toScenarioNodeCardProps(scenario.when)}
                          className="scenario-node-card"
                        />
                      )}
                    </div>
                    <div className="scenario-section">
                      <div className="scenario-section-label">Then</div>
                      {scenario.then.map((entry, index) => (
                        <NodeCard
                          key={`${scenario.name}-then-${entry.key}-${index}`}
                          {...toScenarioNodeCardProps(entry)}
                          className="scenario-node-card"
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
