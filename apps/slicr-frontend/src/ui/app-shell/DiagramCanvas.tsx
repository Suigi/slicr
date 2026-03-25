import { useDiagramInteractionContext } from './contexts/DiagramInteractionContext';

export function DiagramCanvas() {
  const { diagram, docsOpen, actions } = useDiagramInteractionContext();
  const {
    diagramMode,
    DiagramRenderer,
    rendererViewportKey,
    sceneModel,
    overviewNodeDataVisible,
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
      diagramMode={diagramMode}
      sceneModel={sceneModel}
      overviewNodeDataVisible={overviewNodeDataVisible}
      canvasPanelRef={canvasPanelRef}
      isPanning={isPanning}
      docsOpen={docsOpen}
      dragTooltip={dragTooltip}
      dragAndDropEnabled={dragAndDropEnabled}
      beginCanvasPan={beginCanvasPan}
      beginNodeDrag={beginNodeDrag}
      beginEdgeSegmentDrag={beginEdgeSegmentDrag}
      onNodeHoverRange={actions.onNodeHoverRange}
      onNodeSelect={actions.onNodeSelect}
      onNodeOpenInEditor={actions.onNodeOpenInEditor}
      onEdgeHover={actions.onEdgeHover}
      onToggleOverviewNodeDataVisibility={actions.onToggleOverviewNodeDataVisibility}
      initialCamera={initialCamera}
    />
  );
}
