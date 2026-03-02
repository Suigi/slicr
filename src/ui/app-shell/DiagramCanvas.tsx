import { useDiagramInteractionContext } from './contexts/DiagramInteractionContext';

export function DiagramCanvas() {
  const { diagram, docsOpen, routeMode, actions } = useDiagramInteractionContext();
  const {
    DiagramRenderer,
    rendererViewportKey,
    sceneModel,
    initialCamera,
    dragTooltip,
    dragAndDropEnabled,
    isPanning,
    canvasPanelRef,
    beginCanvasPan,
    beginNodeDrag,
    beginEdgeSegmentDrag
  } = diagram;

  return (
    <DiagramRenderer
      key={rendererViewportKey}
      sceneModel={sceneModel}
      canvasPanelRef={canvasPanelRef}
      isPanning={isPanning}
      docsOpen={docsOpen}
      dragTooltip={dragTooltip}
      dragAndDropEnabled={dragAndDropEnabled}
      routeMode={routeMode}
      beginCanvasPan={beginCanvasPan}
      beginNodeDrag={beginNodeDrag}
      beginEdgeSegmentDrag={beginEdgeSegmentDrag}
      onNodeHoverRange={actions.onNodeHoverRange}
      onNodeSelect={actions.onNodeSelect}
      onNodeOpenInEditor={actions.onNodeOpenInEditor}
      onEdgeHover={actions.onEdgeHover}
      initialCamera={initialCamera}
    />
  );
}
