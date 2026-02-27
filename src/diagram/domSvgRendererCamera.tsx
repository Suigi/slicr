import { useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
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
    if (
      target instanceof Element &&
      (target.closest('.node') || target.closest('.edge-segment-handle') || target.closest('.camera-zoom-toolbar'))
    ) {
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

  type WheelLikeEvent = {
    deltaX: number;
    deltaY: number;
    clientX: number;
    clientY: number;
    ctrlKey: boolean;
    metaKey: boolean;
  };

  const handleWheelZoom = (event: WheelLikeEvent) => {
    if (!cameraControlsEnabled) {
      return;
    }
    if (!sceneModel?.viewport) {
      return;
    }

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

    const zoomFactor = Math.pow(1.1, -event.deltaY / 100);

    const rect = canvasPanelRef.current?.getBoundingClientRect();
    const scrollLeft = canvasPanelRef.current?.scrollLeft ?? 0;
    const scrollTop = canvasPanelRef.current?.scrollTop ?? 0;
    const localX = rect ? event.clientX - rect.left + scrollLeft : event.clientX;
    const localY = rect ? event.clientY - rect.top + scrollTop : event.clientY;

    setCamera((current) => {
      return zoomCameraAroundClientPoint(
        sceneModel,
        current,
        localX,
        localY,
        zoomFactor
      );
    });
  };

  useEffect(() => {
    const el = canvasPanelRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!cameraControlsEnabled || !sceneModel?.viewport) {
        return;
      }
      // prevent the browser's default scroll/zoom when interacting with the canvas
      e.preventDefault();
      handleWheelZoom(e as unknown as WheelLikeEvent);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [canvasPanelRef, cameraControlsEnabled, sceneModel]);

  const toWorldPointerEvent = (event: ReactPointerEvent): ReactPointerEvent => {
    const rect = canvasPanelRef.current?.getBoundingClientRect();
    const scrollLeft = canvasPanelRef.current?.scrollLeft ?? 0;
    const scrollTop = canvasPanelRef.current?.scrollTop ?? 0;
    const localX = rect ? event.clientX - rect.left + scrollLeft : event.clientX;
    const localY = rect ? event.clientY - rect.top + scrollTop : event.clientY;

    const world = toWorldClientPoint(sceneModel, camera, localX, localY);
    const proxy = Object.create(event) as ReactPointerEvent;
    Object.defineProperty(proxy, 'clientX', { configurable: true, value: world.x });
    Object.defineProperty(proxy, 'clientY', { configurable: true, value: world.y });
    return proxy;
  };

  const zoomAroundPanelCenter = (zoomFactor: number) => {
    if (!sceneModel?.viewport) {
      return;
    }
    const panel = canvasPanelRef.current;
    const rect = panel?.getBoundingClientRect();
    const anchorX = panel
      ? ((panel.clientWidth || rect?.width || 0) / 2) + (panel.scrollLeft ?? 0)
      : ((sceneModel.viewport.width || 0) / 2);
    const anchorY = panel
      ? ((panel.clientHeight || rect?.height || 0) / 2) + (panel.scrollTop ?? 0)
      : ((sceneModel.viewport.height || 0) / 2);

    setCamera((current) => (
      zoomCameraAroundClientPoint(sceneModel, current, anchorX, anchorY, zoomFactor)
    ));
  };

  const resetCamera = () => {
    setCamera(initialCamera ?? { x: 0, y: 0, zoom: 1 });
  };

  return (
    <div
      ref={canvasPanelRef}
      className={`canvas-panel ${isPanning ? 'panning' : ''} ${docsOpen ? 'hidden' : ''}`}
      onPointerDown={beginCameraPan}
      style={{ position: 'relative', overflow: 'hidden' }}
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

            {sceneModel.scenarios.length > 0 && (
              <div className="scenario-area" style={{ top: `${sceneModel.worldHeight + 48}px` }}>
                {sceneModel.scenarios.map((scenario) => (
                  <section key={`${scenario.name}-${scenario.srcRange.from}`} className="scenario-box">
                    <h3 className="scenario-title">{scenario.name}</h3>
                    <div className="scenario-section">
                      <div className="scenario-section-label">Given</div>
                      {scenario.given.map((entry, index) => (
                        <div key={`${scenario.name}-given-${entry.key}-${index}`} className="scenario-entry">
                          {entry.prefix ? `${entry.prefix}:` : ''}{entry.title}
                        </div>
                      ))}
                    </div>
                    <div className="scenario-section">
                      <div className="scenario-section-label">When</div>
                      {scenario.when && (
                        <div className="scenario-entry">
                          {scenario.when.prefix ? `${scenario.when.prefix}:` : ''}{scenario.when.title}
                        </div>
                      )}
                    </div>
                    <div className="scenario-section">
                      <div className="scenario-section-label">Then</div>
                      {scenario.then.map((entry, index) => (
                        <div key={`${scenario.name}-then-${entry.key}-${index}`} className="scenario-entry">
                          {entry.prefix ? `${entry.prefix}:` : ''}{entry.title}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="canvas-ui-overlay">
        {cameraControlsEnabled && (
          <div className="camera-zoom-toolbar" onPointerDown={(event) => event.stopPropagation()}>
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
    </div>
  );
}
