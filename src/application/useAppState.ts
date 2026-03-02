import { Dispatch, SetStateAction, useMemo } from 'react';
import { MISSING_DATA_VALUE } from '../domain/dataMapping';
import { formatNodeData } from '../domain/formatNodeData';
import { parseDsl } from '../domain/parseDsl';
import { getAmbiguousSourceCandidates } from '../domain/dataIssues';
import { useParsedSliceProjection } from '../useParsedSliceProjection';
import {
  appendSliceLayoutResetEvent,
  getSliceNameFromDsl,
  loadSliceLayoutOverrides,
  updateSelectedSliceDsl
} from '../sliceLibrary';
import { EditorWarning, useDslEditor } from '../useDslEditor';
import { getDiagramRenderer } from '../diagram/rendererRegistry';
import type { UseAppStateResult } from './appViewModel';
import { useAppLocalState } from './hooks/useAppLocalState';
import { useAppActions } from './hooks/useAppActions';
import { useDiagramViewState } from './hooks/useDiagramViewState';
import { useNodeAnalysisState } from './hooks/useNodeAnalysisState';
import { useUiEffects } from './hooks/useUiEffects';
import { NODE_MEASURE_NODE_CLASS } from '../nodeMeasurement';
import { formatTraceSource, NODE_VERSION_SUFFIX, ParseResult, TYPE_LABEL } from './appConstants';

export function useAppState(): UseAppStateResult {
  const local = useAppLocalState();
  const {
    projectIndex,
    setProjectIndex,
    selectedProjectId,
    currentProjectName,
    library,
    setLibrary,
    theme,
    setTheme,
    editorOpen,
    setEditorOpen,
    toggleRef,
    sliceMenuRef,
    routeMenuRef,
    mobileMenuRef,
    skipNextLayoutSaveRef,
    editorRef,
    editorMountRef,
    highlightRange,
    setHighlightRange,
    hoveredEditorRange,
    setHoveredEditorRange,
    selectedNodeKey,
    setSelectedNodeKey,
    hoveredEdgeKey,
    setHoveredEdgeKey,
    diagramRendererId,
    routeMode,
    setRouteMode,
    docsOpen,
    setDocsOpen,
    hasOpenedDocs,
    setHasOpenedDocs,
    sliceMenuOpen,
    setSliceMenuOpen,
    routeMenuOpen,
    setRouteMenuOpen,
    projectRailOpen,
    setProjectRailOpen,
    mobileMenuOpen,
    setMobileMenuOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    createProjectDialogOpen,
    setCreateProjectDialogOpen,
    manualNodePositions,
    setManualNodePositions,
    manualEdgePoints,
    setManualEdgePoints,
    focusRequestVersion,
    setFocusRequestVersion,
    pendingFocusNodeKeyRef,
    hasManualLayoutOverrides,
    showDevDiagramControls,
    dragAndDropEnabled,
    crossSliceDataEnabled,
    currentSlice,
    currentDsl,
    currentSliceName,
    ROUTE_MODE_STORAGE_KEY,
    THEME_STORAGE_KEY
  } = local;

  const sliceDocuments = useMemo(
    () => library.slices.map((slice) => ({ id: slice.id, dsl: slice.dsl })),
    [library.slices]
  );
  const { bySliceId: parsedSliceProjections, list: parsedSliceProjectionList } = useParsedSliceProjection(sliceDocuments);
  const currentSliceProjection = useMemo(
    () => (currentSlice ? parsedSliceProjections.get(currentSlice.id) ?? null : null),
    [currentSlice, parsedSliceProjections]
  );

  const setCurrentDsl: Dispatch<SetStateAction<string>> = (updater) => {
    setLibrary((currentLibrary) => {
      const selected =
        currentLibrary.slices.find((slice) => slice.id === currentLibrary.selectedSliceId) ?? currentLibrary.slices[0];
      if (!selected) {
        return currentLibrary;
      }

      const nextDsl = typeof updater === 'function' ? updater(selected.dsl) : updater;
      if (nextDsl === selected.dsl) {
        return currentLibrary;
      }
      return updateSelectedSliceDsl(currentLibrary, nextDsl);
    });
  };

  const parseResult = useMemo<ParseResult>(() => {
    if (currentSliceProjection && currentSliceProjection.dsl === currentDsl) {
      return { parsed: currentSliceProjection.parsed, error: '', warnings: currentSliceProjection.parsed.warnings };
    }
    try {
      const parsed = parseDsl(currentDsl);
      return { parsed, error: '', warnings: parsed.warnings };
    } catch (error) {
      return { parsed: null, error: `⚠ ${(error as Error).message}`, warnings: [] };
    }
  }, [currentDsl, currentSliceProjection]);

  const parsed = parseResult.parsed;
  const errorText = parseResult.error;

  const { collapseAllDataRegions, collapseAllRegions, expandAllRegions, focusRange } = useDslEditor({
    dsl: currentDsl,
    onDslChange: setCurrentDsl,
    onRangeHover: setHoveredEditorRange,
    editorMountRef,
    highlightRange,
    warnings: parseResult.warnings.map<EditorWarning>((warning) => ({
      range: warning.range,
      message: warning.message,
      level: warning.level
    }))
  });

  const analysis = useNodeAnalysisState({
    parsed,
    currentDsl,
    selectedSliceId: library.selectedSliceId,
    selectedNodeKey,
    parsedSliceProjectionList,
    parsedSliceProjections,
    crossSliceDataEnabled
  });

  const diagramView = useDiagramViewState({
    parsed,
    currentDsl,
    theme,
    routeMode,
    diagramRendererId,
    selectedSliceId: library.selectedSliceId,
    dragAndDropEnabled,
    manualNodePositions,
    manualEdgePoints,
    setManualNodePositions,
    setManualEdgePoints,
    hoveredEditorRange,
    selectedNodeKey,
    hoveredEdgeKey,
    hoveredTraceNodeKey: analysis.hoveredTraceNodeKey,
    focusRequestVersion,
    pendingFocusNodeKeyRef
  });

  const DiagramRenderer = useMemo(() => getDiagramRenderer(diagramRendererId), [diagramRendererId]);

  const applySelectedSliceOverrides = (sliceId: string, projectId = selectedProjectId) => {
    const overrides = loadSliceLayoutOverrides(sliceId, projectId);
    skipNextLayoutSaveRef.current = true;
    setManualNodePositions(overrides.nodes);
    setManualEdgePoints(overrides.edges);
  };

  const toggleDocumentationPanel = () => {
    setDocsOpen((value) => {
      const next = !value;
      if (next) {
        setHasOpenedDocs(true);
      }
      return next;
    });
  };

  const resetManualLayout = () => {
    setManualNodePositions({});
    setManualEdgePoints({});
    appendSliceLayoutResetEvent(library.selectedSliceId, selectedProjectId);
  };

  useUiEffects({
    projectIndex,
    selectedProjectId,
    library,
    manualNodePositions,
    manualEdgePoints,
    skipNextLayoutSaveRef,
    editorOpen,
    editorRef,
    toggleRef,
    sliceMenuOpen,
    routeMenuOpen,
    mobileMenuOpen,
    createProjectDialogOpen,
    sliceMenuRef,
    routeMenuRef,
    mobileMenuRef,
    currentSliceName,
    theme,
    themeStorageKey: THEME_STORAGE_KEY,
    routeMode,
    routeStorageKey: ROUTE_MODE_STORAGE_KEY,
    selectedNode: analysis.selectedNode,
    showDataTraceTab: analysis.showDataTraceTab,
    selectedNodeUsesKeys: analysis.selectedNodeUsesKeys,
    setSelectedNodeKey,
    setHighlightRange,
    setLibrary,
    setEditorOpen,
    setSliceMenuOpen,
    setRouteMenuOpen,
    setMobileMenuOpen,
    setCommandPaletteOpen,
    setCreateProjectDialogOpen,
    setCrossSliceTraceExpandedKeys: analysis.setCrossSliceTraceExpandedKeys,
    setSelectedNodePanelTab: analysis.setSelectedNodePanelTab,
    applySelectedSliceOverrides
  });

  const actions = useAppActions({
    parsed,
    currentDsl,
    activeLayout: diagramView.activeLayout,
    displayedPos: diagramView.displayedPos,
    renderedEdges: diagramView.renderedEdges,
    selectedNode: analysis.selectedNode,
    showDataTraceTab: analysis.showDataTraceTab,
    selectedNodeUsesKeys: analysis.selectedNodeUsesKeys,
    setCrossSliceTraceExpandedKeys: analysis.setCrossSliceTraceExpandedKeys,
    setSelectedNodePanelTab: analysis.setSelectedNodePanelTab,
    setCommandPaletteOpen,
    setSelectedNodeKey,
    setHighlightRange,
    setLibrary,
    projectIndex,
    setProjectIndex,
    selectedProjectId,
    applySelectedSliceOverrides,
    pendingFocusNodeKeyRef,
    setFocusRequestVersion,
    setEditorOpen,
    focusRange,
    setSliceMenuOpen,
    setRouteMenuOpen,
    setProjectRailOpen,
    setMobileMenuOpen,
    setTheme,
    setRouteMode,
    setCreateProjectDialogOpen,
    setHoveredEdgeKey,
    setHoveredTraceNodeKey: analysis.setHoveredTraceNodeKey,
    setSourceOverrides: analysis.setSourceOverrides,
    setCrossSliceDataExpandedKeys: analysis.setCrossSliceDataExpandedKeys,
    resetManualLayout,
    toggleDocumentationPanel
  });

  return {
    header: {
      projectIndex,
      selectedProjectId,
      currentProjectName,
      currentSliceName,
      library,
      getSliceNameFromDsl,
      theme,
      docsOpen,
      routeMode,
      showDevDiagramControls,
      hasManualLayoutOverrides,
      sliceMenuOpen,
      routeMenuOpen,
      mobileMenuOpen,
      projectRailOpen,
      sliceMenuRef,
      routeMenuRef,
      mobileMenuRef,
      toggleRef
    },
    editor: {
      editorOpen,
      errorText,
      editorRef,
      editorMountRef,
      collapseAllDataRegions,
      collapseAllRegions,
      expandAllRegions
    },
    diagram: {
      parsed,
      currentDsl,
      sceneModel: diagramView.sceneModel,
      DiagramRenderer,
      diagramRendererId,
      rendererViewportKey: diagramView.rendererViewportKey,
      initialCamera: diagramView.initialCamera,
      dragTooltip: diagramView.dragTooltip,
      dragAndDropEnabled,
      isPanning: diagramView.isPanning,
      canvasPanelRef: diagramView.canvasPanelRef,
      beginCanvasPan: diagramView.beginCanvasPan,
      beginNodeDrag: diagramView.beginNodeDrag,
      beginEdgeSegmentDrag: diagramView.beginEdgeSegmentDrag
    },
    analysisPanel: {
      selectedNode: analysis.selectedNode,
      selectedSliceId: library.selectedSliceId,
      selectedNodePanelTab: analysis.selectedNodePanelTab,
      selectedNodeAnalysisRef: analysis.selectedNodeAnalysisRef,
      selectedNodeAnalysisHeader: analysis.selectedNodeAnalysisHeader,
      selectedNodeCrossSliceData: analysis.selectedNodeCrossSliceData,
      selectedNodeIssues: analysis.selectedNodeIssues,
      selectedNodeIssuesByKey: analysis.selectedNodeIssuesByKey,
      selectedNodeTraceResultsByKey: analysis.selectedNodeTraceResultsByKey,
      selectedNodeUsesKeys: analysis.selectedNodeUsesKeys,
      missingSourceIssueKeys: analysis.missingSourceIssueKeys,
      crossSliceUsageGroups: analysis.crossSliceUsageGroups,
      crossSliceDataEnabled,
      showDataTraceTab: analysis.showDataTraceTab,
      crossSliceDataExpandedKeys: analysis.crossSliceDataExpandedKeys,
      crossSliceTraceExpandedKeys: analysis.crossSliceTraceExpandedKeys,
      sourceOverrides: analysis.sourceOverrides
    },
    auxPanels: {
      docsOpen,
      hasOpenedDocs,
      commandPaletteOpen,
      createProjectDialogOpen
    },
    constants: {
      TYPE_LABEL,
      NODE_VERSION_SUFFIX,
      NODE_MEASURE_NODE_CLASS,
      MISSING_DATA_VALUE,
      formatNodeData,
      formatTraceSource,
      getAmbiguousSourceCandidates
    },
    actions
  };
}
