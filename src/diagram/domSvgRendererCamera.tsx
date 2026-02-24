import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import { supportsEditableEdgePoints } from '../domain/diagramEngine';
import { NodeCard } from '../NodeCard';
import { toWorldClientPoint, zoomCameraAroundClientPoint } from './cameraUtils';
import type { DiagramRendererAdapterProps } from './domSvgRenderer';

export function DomSvgDiagramRendererCamera({
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
  rendererId = 'dom-svg',
  cameraControlsEnabled = true,
  initialCamera
}: DiagramRendererAdapterProps) {
  const [camera, setCamera] = useState<{ x: number; y: number; zoom: number }>(
    () => initialCamera ?? { x: 0, y: 0, zoom: 1 }
  );
  void beginCanvasPan;

  const beginCameraPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!cameraControlsEnabled) {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && (target.closest('.node') || target.closest('.edge-segment-handle'))) {
      return;
    }

    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const startCameraX = camera.x;
    const startCameraY = camera.y;

    const onMove = (moveEvent: PointerEvent) => {
      if ((moveEvent.buttons & 1) === 0) {
        return;
      }
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setCamera((current) => ({ ...current, x: startCameraX + dx, y: startCameraY + dy }));
    };

    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleWheelZoom = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!cameraControlsEnabled) {
      return;
    }
    if (!sceneModel?.viewport) {
      return;
    }
    event.preventDefault();

    if (!event.ctrlKey && !event.metaKey) {
      if (event.deltaX === 0 && event.deltaY === 0) {
        return;
      }
      setCamera((current) => ({
        ...current,
        x: current.x - event.deltaX,
        y: current.y - event.deltaY
      }));
      return;
    }

    if (event.deltaY === 0) {
      return;
    }

    setCamera((current) => {
      return zoomCameraAroundClientPoint(
        sceneModel,
        current,
        event.clientX,
        event.clientY,
        event.deltaY < 0 ? 1.1 : 0.9
      );
    });
  };

  const toWorldPointerEvent = (event: ReactPointerEvent): ReactPointerEvent => {
    const world = toWorldClientPoint(sceneModel, camera, event.clientX, event.clientY);
    const proxy = Object.create(event) as ReactPointerEvent;
    Object.defineProperty(proxy, 'clientX', { configurable: true, value: world.x });
    Object.defineProperty(proxy, 'clientY', { configurable: true, value: world.y });
    return proxy;
  };

  return (
    <div
      ref={canvasPanelRef}
      className={`canvas-panel ${isPanning ? 'panning' : ''} ${docsOpen ? 'hidden' : ''}`}
      onPointerDown={beginCameraPan}
      onWheel={handleWheelZoom}
      style={{ overflow: 'hidden' }}
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
            className="canvas-camera-world"
            data-camera-x={String(camera.x)}
            data-camera-y={String(camera.y)}
            data-camera-zoom={String(camera.zoom)}
            style={{
              transform: `translate(${sceneModel.viewport.offsetX + camera.x}px, ${sceneModel.viewport.offsetY + camera.y}px) scale(${camera.zoom})`,
              transformOrigin: '0 0'
            }}
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
                onPointerDown={(event) => beginNodeDrag(toWorldPointerEvent(event), entry.key)}
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
          </div>
        )}
      </div>
    </div>
  );
}
