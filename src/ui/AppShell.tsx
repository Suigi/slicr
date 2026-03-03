import { DocumentationPanel } from '../DocumentationPanel';
import type { AppShellProps } from '../application/appViewModel';
import { AppHeader } from './app-shell/AppHeader';
import { CommandPalette } from './app-shell/CommandPalette';
import { DiagramCanvas } from './app-shell/DiagramCanvas';
import { NodeAnalysisPanel } from './app-shell/NodeAnalysisPanel';
import { NodeMeasureLayer } from './app-shell/NodeMeasureLayer';
import { ProjectRail } from './app-shell/ProjectRail';
import { AddNodeDialog } from './app-shell/AddNodeDialog';
import { ImportNodeDialog } from './app-shell/ImportNodeDialog';
import { CompactEventsDialog } from './app-shell/CompactEventsDialog';
import { AnalysisProvider } from './app-shell/contexts/AnalysisContext';
import { DiagramInteractionProvider } from './app-shell/contexts/DiagramInteractionContext';
import { HeaderUiProvider } from './app-shell/contexts/HeaderUiContext';

export function AppShell(props: AppShellProps) {
  const { header, editor, diagram, analysisPanel, auxPanels, constants, actions } = props;
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
      <HeaderUiProvider value={{ header, actions, editorOpen: editor.editorOpen }}>
        <AppHeader />
      </HeaderUiProvider>

      <div className="main">
        <ProjectRail header={header} actions={actions} auxPanels={auxPanels} visible={header.projectRailOpen} />

        <div ref={editorRef} className={`editor-panel ${editorOpen ? 'open' : ''}`}>
          <div className="panel-label">
            <div className="panel-handle" />
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

        <DiagramInteractionProvider
          value={{
            diagram: {
              DiagramRenderer: diagram.DiagramRenderer,
              rendererViewportKey: diagram.rendererViewportKey,
              sceneModel: diagram.sceneModel,
              initialCamera: diagram.initialCamera,
              dragTooltip: diagram.dragTooltip,
              dragAndDropEnabled: diagram.dragAndDropEnabled,
              isPanning: diagram.isPanning,
              canvasPanelRef: diagram.canvasPanelRef,
              beginCanvasPan: diagram.beginCanvasPan,
              beginNodeDrag: diagram.beginNodeDrag,
              beginEdgeSegmentDrag: diagram.beginEdgeSegmentDrag
            },
            docsOpen: auxPanels.docsOpen,
            routeMode: header.routeMode,
            actions: {
              onNodeHoverRange: actions.onNodeHoverRange,
              onNodeSelect: actions.onNodeSelect,
              onNodeOpenInEditor: actions.onNodeOpenInEditor,
              onEdgeHover: actions.onEdgeHover
            }
          }}
        >
          <DiagramCanvas />
        </DiagramInteractionProvider>

        <AnalysisProvider
          value={{
            analysisPanel,
            diagram: { parsed: diagram.parsed, currentDsl: diagram.currentDsl },
            constants: {
              TYPE_LABEL: constants.TYPE_LABEL,
              formatTraceSource: constants.formatTraceSource,
              getAmbiguousSourceCandidates: constants.getAmbiguousSourceCandidates
            },
            actions: {
              onSelectedNodePanelTabChange: actions.onSelectedNodePanelTabChange,
              onToggleCrossSliceDataExpanded: actions.onToggleCrossSliceDataExpanded,
              onToggleCrossSliceTraceExpanded: actions.onToggleCrossSliceTraceExpanded,
              onTraceNodeHover: actions.onTraceNodeHover,
              onSetSourceOverride: actions.onSetSourceOverride,
              onJumpToUsage: actions.onJumpToUsage
            }
          }}
        >
          <NodeAnalysisPanel />
        </AnalysisProvider>

        <CommandPalette auxPanels={auxPanels} actions={actions} header={header} />
        {auxPanels.compactEventsSummary ? (
          <div className="compact-events-summary" role="status">{auxPanels.compactEventsSummary}</div>
        ) : null}
        {auxPanels.addNodeDialogOpen && (
          <AddNodeDialog
            parsed={diagram.parsed}
            onCancel={actions.onCloseAddNodeDialog}
            onSubmit={actions.onCreateNodeFromDialog}
          />
        )}
        {auxPanels.importNodeDialogOpen && (
          <ImportNodeDialog
            parsedSliceProjectionList={diagram.parsedSliceProjectionList}
            targetSliceId={analysisPanel.selectedSliceId}
            onCancel={actions.onCloseImportNodeDialog}
            onSubmit={actions.onCreateImportedNodeFromDialog}
          />
        )}
        {auxPanels.compactEventsDialogOpen && (
          <CompactEventsDialog
            onCancel={actions.onCloseCompactEventsDialog}
            onCompact={actions.onRunEventCompaction}
          />
        )}

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
