import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { InfiniteCanvas } from '@slicr/react-ui';
import type { InfiniteCanvasHandle } from '@slicr/react-ui';
import { supportsEditableEdgePoints } from '../domain/diagramEngine';
import { NodeCard } from '../NodeCard';
import { toWorldClientPoint } from './cameraUtils';
import type { DiagramRendererAdapterProps } from './domSvgRenderer';
import type { DiagramScenario, DiagramScenarioNode } from './rendererContract';
import { OverviewDashedConnectors } from './overviewDashedConnectors';

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

function scenarioAreaLeft(sceneModel: NonNullable<DiagramRendererAdapterProps['sceneModel']>): number {
  if (sceneModel.nodes.length === 0) {
    return 0;
  }
  return Math.min(...sceneModel.nodes.map((node) => node.x));
}

function renderScenarioBoxes(
  scenarios: DiagramScenario[],
  hideData: boolean,
  onNodeHoverRange: DiagramRendererAdapterProps['onNodeHoverRange'],
  onNodeSelect: DiagramRendererAdapterProps['onNodeSelect'],
  onNodeOpenInEditor: DiagramRendererAdapterProps['onNodeOpenInEditor']
) {
  return scenarios.map((scenario) => (
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
            className={`scenario-node-card ${entry.className ?? ''}`.trim()}
            hideData={hideData}
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
          />
        ))}
      </div>
      <div className="scenario-section">
        <div className="scenario-section-label">When</div>
        {scenario.when && (
          <NodeCard
            {...toScenarioNodeCardProps(scenario.when)}
            className={`scenario-node-card ${scenario.when.className ?? ''}`.trim()}
            hideData={hideData}
            onMouseEnter={() => onNodeHoverRange(scenario.when!.srcRange)}
            onMouseLeave={() => onNodeHoverRange(null)}
            onClick={(event) => {
              event.stopPropagation();
              onNodeSelect(scenario.when!.key);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onNodeOpenInEditor(scenario.when!.key, scenario.when!.srcRange);
            }}
          />
        )}
      </div>
      <div className="scenario-section">
        <div className="scenario-section-label">Then</div>
        {scenario.then.map((entry, index) => (
          <NodeCard
            key={`${scenario.name}-then-${entry.key}-${index}`}
            {...toScenarioNodeCardProps(entry)}
            className={`scenario-node-card ${entry.className ?? ''}`.trim()}
            hideData={hideData}
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
          />
        ))}
      </div>
    </section>
  ));
}

const DEFAULT_CAMERA = { x: 0, y: 0, zoom: 1 } as const;
const CAMERA_ZOOM_STEP = 1.5;

export function DomSvgDiagramRendererCamera({
  diagramMode,
  sceneModel,
  overviewNodeDataVisible = true,
  canvasPanelRef,
  isPanning,
  docsOpen,
  dragTooltip,
  dragAndDropEnabled,
  beginCanvasPan,
  beginNodeDrag,
  beginEdgeSegmentDrag,
  onNodeHoverRange,
  onNodeSelect,
  onNodeOpenInEditor,
  onEdgeHover,
  onToggleOverviewNodeDataVisibility,
  rendererId = 'dom-svg',
  cameraControlsEnabled = true,
  initialCamera
}: DiagramRendererAdapterProps) {
  const canvasRef = useRef<InfiniteCanvasHandle | null>(null);
  const [camera, setCamera] = useState<{ x: number; y: number; zoom: number }>(
    () => initialCamera ?? DEFAULT_CAMERA
  );
  const [cameraControlled, setCameraControlled] = useState(Boolean(initialCamera));
  const effectiveCamera = !cameraControlled && initialCamera
    ? initialCamera
    : camera;
  void beginCanvasPan;
  const showOverviewNodeDataToggle = diagramMode === 'overview' && cameraControlsEnabled;
  const hideOverviewNodeData = diagramMode === 'overview' && overviewNodeDataVisible === false;

  const handleCameraChange = (nextCamera: { x: number; y: number; zoom: number }) => {
    setCameraControlled(true);
    setCamera(nextCamera);
  };

  const toWorldPointerEvent = (event: ReactPointerEvent): ReactPointerEvent => {
    const rect = canvasPanelRef.current?.getBoundingClientRect();
    const scrollLeft = canvasPanelRef.current?.scrollLeft ?? 0;
    const scrollTop = canvasPanelRef.current?.scrollTop ?? 0;
    const localX = rect ? event.clientX - rect.left + scrollLeft : event.clientX;
    const localY = rect ? event.clientY - rect.top + scrollTop : event.clientY;

    const world = toWorldClientPoint(sceneModel, effectiveCamera, localX, localY);
    const proxy = Object.create(event) as ReactPointerEvent;
    Object.defineProperty(proxy, 'clientX', { configurable: true, value: world.x });
    Object.defineProperty(proxy, 'clientY', { configurable: true, value: world.y });
    return proxy;
  };

  const zoomAroundPanelCenter = (zoomFactor: number) => {
    if (!sceneModel?.viewport) {
      return;
    }
    if (zoomFactor > 1) {
      canvasRef.current?.zoomIn();
    } else {
      canvasRef.current?.zoomOut();
    }
  };

  const resetCamera = () => {
    setCameraControlled(true);
    canvasRef.current?.resetCamera();
  };


  return (
    <InfiniteCanvas
      ref={canvasRef}
      viewportRef={canvasPanelRef}
      id="canvas"
      className={`canvas-panel ${isPanning ? 'panning' : ''} ${docsOpen ? 'hidden' : ''}`}
      style={{ position: 'relative', overflow: 'hidden' }}
      hidden={docsOpen}
      data-diagram-renderer={rendererId}
      bounds={sceneModel?.viewport ? {
        width: sceneModel.viewport.width,
        height: sceneModel.viewport.height,
        offsetX: sceneModel.viewport.offsetX,
        offsetY: sceneModel.viewport.offsetY
      } : undefined}
      camera={effectiveCamera}
      defaultCamera={initialCamera ?? DEFAULT_CAMERA}
      controls={{
        pan: cameraControlsEnabled,
        wheelPan: cameraControlsEnabled,
        wheelZoom: cameraControlsEnabled,
        toolbar: false,
        minZoom: 0.4,
        maxZoom: 2.5,
        zoomStep: CAMERA_ZOOM_STEP
      }}
      onCameraChange={handleCameraChange}
      ignorePanSelector=".node, .edge-segment-handle, .camera-zoom-toolbar"
      worldClassName="canvas-camera-world"
      overlay={(
        <>
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
          <div className="canvas-ui-overlay">
            {cameraControlsEnabled && (
              <div className="camera-zoom-toolbar" onPointerDown={(event) => event.stopPropagation()}>
                {showOverviewNodeDataToggle && (
                  <label className="camera-zoom-toggle">
                    <input
                      type="checkbox"
                      aria-label="Show Node Data"
                      checked={overviewNodeDataVisible}
                      onChange={() => onToggleOverviewNodeDataVisibility?.()}
                    />
                    <span>Show Node Data</span>
                  </label>
                )}
                <button
                  type="button"
                  className="camera-zoom-button"
                  aria-label="Zoom out"
                  title="Zoom out"
                  onClick={() => zoomAroundPanelCenter(1 / 1.1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 12h12" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="camera-zoom-button"
                  aria-label="Reset zoom"
                  title="Reset zoom"
                  onClick={resetCamera}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 12a8 8 0 1 0 2.34-5.66" />
                    <path d="M4 4v4h4" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="camera-zoom-button"
                  aria-label="Zoom in"
                  title="Zoom in"
                  onClick={() => zoomAroundPanelCenter(1.1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 6v12" />
                    <path d="M6 12h12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    >
      {sceneModel?.viewport && (
        <>
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

            {sceneModel.sliceFrames.map((frame) => (
              <div key={frame.key}>
                <div
                  className="overview-slice-frame"
                  style={{
                    left: `${frame.left}px`,
                    top: `${frame.top}px`,
                    width: `${frame.width}px`,
                    height: `${frame.height}px`
                  }}
                />
                <div
                  className="slice-title overview-slice-frame-label"
                  style={{ top: `${frame.labelTop}px`, left: `${frame.labelLeft}px` }}
                >
                  {frame.label}
                </div>
              </div>
            ))}

            {sceneModel.nodes.filter((entry) => !entry.hidden).map((entry) => (
              <NodeCard
                key={entry.renderKey}
                node={entry.node}
                nodePrefix={entry.nodePrefix}
                className={entry.className}
                hideData={hideOverviewNodeData}
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
                  onNodeSelect(entry.interactionNodeKey ?? entry.key);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  onNodeOpenInEditor(entry.interactionNodeKey ?? entry.key, entry.srcRange);
                }}
                onPointerDown={(event) => beginNodeDrag(
                  toWorldPointerEvent(event),
                  entry.interactionNodeKey ?? entry.key
                )}
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

              <OverviewDashedConnectors crossSliceLinks={sceneModel.crossSliceLinks} />

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
                      supportsEditableEdgePoints() &&
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
                            onPointerDown={(event) => beginEdgeSegmentDrag(
                              toWorldPointerEvent(event),
                              edge.edgeKey,
                              pointIndex,
                              edge.points
                            )}
                          />
                        );
                      })}
                  </g>
                );
              })}
            </svg>

            {sceneModel.scenarioGroups && sceneModel.scenarioGroups.length > 0 ? (
              <>
                {sceneModel.scenarioGroups.map((group) => (
                  <div
                    key={group.key}
                    className="scenario-area scenario-group"
                    data-scenario-group-key={group.key}
                    style={{
                      top: `${group.top}px`,
                      left: `${group.left}px`,
                      width: `${group.width}px`
                    }}
                  >
                    {renderScenarioBoxes(group.scenarios, hideOverviewNodeData, onNodeHoverRange, onNodeSelect, onNodeOpenInEditor)}
                  </div>
                ))}
              </>
            ) : sceneModel.scenarios.length > 0 && (
              <div
                className="scenario-area"
                style={{
                  top: `${sceneModel.worldHeight + 24}px`,
                  left: `${scenarioAreaLeft(sceneModel)}px`
                }}
              >
                {renderScenarioBoxes(sceneModel.scenarios, hideOverviewNodeData, onNodeHoverRange, onNodeSelect, onNodeOpenInEditor)}
              </div>
            )}

        </>
      )}
    </InfiniteCanvas>
  );
}
