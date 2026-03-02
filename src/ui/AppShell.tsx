import { DocumentationPanel } from '../DocumentationPanel';
import type { AppShellProps } from '../application/appViewModel';
import { AppHeader } from './app-shell/AppHeader';
import { CommandPalette } from './app-shell/CommandPalette';
import { NodeAnalysisPanel } from './app-shell/NodeAnalysisPanel';
import { NodeMeasureLayer } from './app-shell/NodeMeasureLayer';

export function AppShell(props: AppShellProps) {
  const { header, editor, diagram, analysisPanel, auxPanels, constants, actions } = props;
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
  const {
    editorOpen,
    editorRef,
    editorMountRef,
    errorText,
    collapseAllDataRegions,
    collapseAllRegions,
    expandAllRegions
  } = editor;

  return (
    <>
      <AppHeader
        header={header}
        actions={actions}
        editorOpen={editor.editorOpen}
      />

      <div className="main">
        <div ref={editorRef} className={`editor-panel ${editorOpen ? 'open' : ''}`}>
          <div className="panel-label">
            <div className="panel-handle" />
            <span>DSL</span>
            <button type="button" className="panel-action" onClick={collapseAllDataRegions} aria-label="Collapse all data regions" title="Collapse data regions">
              <svg className="panel-action-icon" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2.5 2.5 5 5M5 5V3.6M5 5H3.6M9.5 9.5 7 7M7 7V8.4M7 7H8.4M4.2 7.8 7.8 4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              data
            </button>
            <button type="button" className="panel-action" onClick={collapseAllRegions} aria-label="Collapse all regions" title="Collapse all regions">
              <svg className="panel-action-icon" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2.5 2.5 5 5M5 5V3.6M5 5H3.6M9.5 9.5 7 7M7 7V8.4M7 7H8.4M4.2 7.8 7.8 4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              all
            </button>
            <button type="button" className="panel-action" onClick={expandAllRegions} aria-label="Expand all regions" title="Expand all regions">
              <svg className="panel-action-icon" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M5 5 2.5 2.5M2.5 2.5V3.9M2.5 2.5H3.9M7 7 9.5 9.5M9.5 9.5V8.1M9.5 9.5H8.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              all
            </button>
          </div>
          <div ref={editorMountRef} className="dsl-editor" />
          {errorText && <div className="error-bar">{errorText}</div>}
        </div>

        <DiagramRenderer
          key={rendererViewportKey}
          sceneModel={sceneModel}
          canvasPanelRef={canvasPanelRef}
          isPanning={isPanning}
          docsOpen={auxPanels.docsOpen}
          dragTooltip={dragTooltip}
          dragAndDropEnabled={dragAndDropEnabled}
          routeMode={header.routeMode}
          beginCanvasPan={beginCanvasPan}
          beginNodeDrag={beginNodeDrag}
          beginEdgeSegmentDrag={beginEdgeSegmentDrag}
          onNodeHoverRange={actions.onNodeHoverRange}
          onNodeSelect={actions.onNodeSelect}
          onNodeOpenInEditor={actions.onNodeOpenInEditor}
          onEdgeHover={actions.onEdgeHover}
          initialCamera={initialCamera}
        />

        <NodeAnalysisPanel
          analysisPanel={analysisPanel}
          diagram={diagram}
          constants={constants}
          actions={actions}
        />

        <CommandPalette auxPanels={auxPanels} actions={actions} />

        {(auxPanels.hasOpenedDocs || auxPanels.docsOpen) && (
          <div className={`docs-panel-shell ${auxPanels.docsOpen ? '' : 'hidden'}`} aria-hidden={!auxPanels.docsOpen}>
            <DocumentationPanel diagramRendererId={diagram.diagramRendererId} />
          </div>
        )}
      </div>

      <NodeMeasureLayer diagram={diagram} constants={constants} />
    </>
  );
}
