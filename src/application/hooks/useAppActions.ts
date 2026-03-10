import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import { addNewSlice, loadSliceLibrary, selectSlice, updateSelectedSliceDsl, type SliceLibrary } from '../../sliceLibrary';
import { appendProjectCreatedEvent, appendProjectSelectedEvent, loadProjectIndex, selectProject, type ProjectIndex } from '../../projectLibrary';
import { DEFAULT_DSL } from '../../defaultDsl';
import type { Parsed, Position } from '../../domain/types';
import type { DiagramPoint } from '../../domain/diagramRouting';
import type { ActionsSection, DiagramMode, NodePanelTab } from '../appViewModel';
import type { Range } from '../../useDslEditor';
import { executeEventCompaction, type CompactionPlan } from '../../eventCompaction';
import type { DiagramSceneModel } from '../../diagram/rendererContract';

type RenderedEdge = { edgeKey: string; edge: { from: string; to: string }; geometry: { d: string; points?: DiagramPoint[] } };

type UseAppActionsArgs = {
  diagramMode: DiagramMode;
  layoutReady: boolean;
  parsed: Parsed | null;
  currentDsl: string;
  activeLayout: { pos: Record<string, Position> } | null;
  displayedPos: Record<string, Position>;
  renderedEdges: RenderedEdge[];
  selectedNode: { key: string } | null;
  showDataTraceTab: boolean;
  selectedNodeUsesKeys: string[];
  setCrossSliceTraceExpandedKeys: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSelectedNodePanelTab: Dispatch<SetStateAction<NodePanelTab>>;
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedNodeKey: Dispatch<SetStateAction<string | null>>;
  setSliceSelectedNodeKey: Dispatch<SetStateAction<string | null>>;
  setOverviewSelectedNodeKey: Dispatch<SetStateAction<string | null>>;
  setOverviewReturnState: Dispatch<SetStateAction<{ editorOpen: boolean; selectedNodeKey: string | null }>>;
  setHighlightRange: Dispatch<SetStateAction<Range | null>>;
  setLibrary: Dispatch<SetStateAction<SliceLibrary>>;
  projectIndex: ProjectIndex;
  setProjectIndex: Dispatch<SetStateAction<ProjectIndex>>;
  selectedProjectId: string;
  applySelectedSliceOverrides: (sliceId: string, projectId?: string) => void;
  pendingFocusNodeKeyRef: MutableRefObject<string | null>;
  setFocusRequestVersion: Dispatch<SetStateAction<number>>;
  editorOpenRef: RefObject<boolean>;
  sliceSelectedNodeKeyRef: RefObject<string | null>;
  overviewReturnState: { editorOpen: boolean; selectedNodeKey: string | null };
  setEditorOpen: Dispatch<SetStateAction<boolean>>;
  setDiagramMode: Dispatch<SetStateAction<DiagramMode>>;
  setOverviewNodeDataVisible: Dispatch<SetStateAction<boolean>>;
  focusRange: (range: Range) => void;
  setSliceMenuOpen: Dispatch<SetStateAction<boolean>>;
  setProjectRailOpen: Dispatch<SetStateAction<boolean>>;
  setMobileMenuOpen: Dispatch<SetStateAction<boolean>>;
  setCreateProjectDialogOpen: Dispatch<SetStateAction<boolean>>;
  setCompactEventsDialogOpen: Dispatch<SetStateAction<boolean>>;
  setCompactEventsSummary: Dispatch<SetStateAction<string | null>>;
  setAddNodeDialogOpen: Dispatch<SetStateAction<boolean>>;
  setImportNodeDialogOpen: Dispatch<SetStateAction<boolean>>;
  setCreateSliceTemplateDialogOpen: Dispatch<SetStateAction<boolean>>;
  hasFocusedCursor: () => boolean;
  insertAtCursorOrEnd: (block: string) => { from: number; to: number };
  setTheme: Dispatch<SetStateAction<'dark' | 'light'>>;
  setHoveredEdgeKey: Dispatch<SetStateAction<string | null>>;
  setHoveredTraceNodeKey: Dispatch<SetStateAction<string | null>>;
  setSourceOverrides: Dispatch<SetStateAction<Record<string, string>>>;
  setCrossSliceDataExpandedKeys: Dispatch<SetStateAction<Record<string, boolean>>>;
  resetManualLayout: () => void;
  toggleDocumentationPanel: () => void;
  currentDiagramSceneModel: DiagramSceneModel | null;
  setOverviewPlaceholderSceneModel: Dispatch<SetStateAction<DiagramSceneModel | null>>;
};

export function useAppActions(args: UseAppActionsArgs): ActionsSection {
  const {
    diagramMode,
    layoutReady,
    parsed,
    currentDsl,
    activeLayout,
    displayedPos,
    renderedEdges,
    selectedNode,
    showDataTraceTab,
    selectedNodeUsesKeys,
    setCrossSliceTraceExpandedKeys,
    setSelectedNodePanelTab,
    setCommandPaletteOpen,
    setSelectedNodeKey,
    setSliceSelectedNodeKey,
    setOverviewSelectedNodeKey,
    setOverviewReturnState,
    setHighlightRange,
    setLibrary,
    projectIndex,
    setProjectIndex,
    selectedProjectId,
    applySelectedSliceOverrides,
    pendingFocusNodeKeyRef,
    setFocusRequestVersion,
    editorOpenRef,
    sliceSelectedNodeKeyRef,
    overviewReturnState,
    setEditorOpen,
    setDiagramMode,
    setOverviewNodeDataVisible,
    focusRange,
    setSliceMenuOpen,
    setProjectRailOpen,
    setMobileMenuOpen,
    setCreateProjectDialogOpen,
    setCompactEventsDialogOpen,
    setCompactEventsSummary,
    setAddNodeDialogOpen,
    setImportNodeDialogOpen,
    setCreateSliceTemplateDialogOpen,
    hasFocusedCursor,
    insertAtCursorOrEnd,
    setTheme,
    setHoveredEdgeKey,
    setHoveredTraceNodeKey,
    setSourceOverrides,
    setCrossSliceDataExpandedKeys,
    resetManualLayout,
    toggleDocumentationPanel,
    currentDiagramSceneModel,
    setOverviewPlaceholderSceneModel
  } = args;

  const switchSliceWithOverrides = (
    currentLibrary: SliceLibrary,
    nextSliceId: string
  ) => {
    const nextLibrary = selectSlice(currentLibrary, nextSliceId);
    if (nextLibrary.selectedSliceId !== currentLibrary.selectedSliceId) {
      applySelectedSliceOverrides(nextLibrary.selectedSliceId);
    }
    return nextLibrary;
  };

  const onSwitchProject = (projectId: string) => {
    if (projectId === selectedProjectId) {
      setCommandPaletteOpen(false);
      return;
    }
    const nextProjectIndex = selectProject(projectIndex, projectId);
    if (nextProjectIndex.selectedProjectId === selectedProjectId) {
      setCommandPaletteOpen(false);
      return;
    }

    appendProjectSelectedEvent(nextProjectIndex.selectedProjectId);
    const projectedIndex = loadProjectIndex();

    const nextLibrary = loadSliceLibrary(DEFAULT_DSL, nextProjectIndex.selectedProjectId);
    setProjectIndex(projectedIndex);
    setLibrary(nextLibrary);
    setSelectedNodeKey(null);
    setHighlightRange(null);
    setHoveredEdgeKey(null);
    setHoveredTraceNodeKey(null);
    applySelectedSliceOverrides(nextLibrary.selectedSliceId, nextProjectIndex.selectedProjectId);
    setCommandPaletteOpen(false);
  };

  const onCreateProject = (name: string) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    const id = ('randomUUID' in crypto)
      ? crypto.randomUUID()
      : `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    appendProjectCreatedEvent(id, trimmed);
    appendProjectSelectedEvent(id);
    const projectedIndex = loadProjectIndex();
    const nextLibrary = loadSliceLibrary(DEFAULT_DSL, id);
    setProjectIndex(projectedIndex);
    setLibrary(nextLibrary);
    setSelectedNodeKey(null);
    setHighlightRange(null);
    setHoveredEdgeKey(null);
    setHoveredTraceNodeKey(null);
    applySelectedSliceOverrides(nextLibrary.selectedSliceId, id);
    setCreateProjectDialogOpen(false);
  };

  const onPrintGeometry = async () => {
    if (!parsed || !activeLayout) {
      return;
    }
    const snapshot = {
      nodes: [...parsed.nodes.values()]
        .map((node) => {
          const position = displayedPos[node.key];
          return position
            ? { key: node.key, x: Math.round(position.x), y: Math.round(position.y), w: Math.round(position.w), h: Math.round(position.h) }
            : null;
        })
        .filter((value): value is { key: string; x: number; y: number; w: number; h: number } => Boolean(value))
        .sort((a, b) => a.key.localeCompare(b.key)),
      edges: renderedEdges
        .map(({ edgeKey, edge, geometry }) => ({
          key: edgeKey,
          from: edge.from,
          to: edge.to,
          d: geometry.d,
          points: geometry.points?.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) })) ?? []
        }))
        .sort((a, b) => a.key.localeCompare(b.key))
    };

    const trimmedDslLines = currentDsl.split('\n');
    while (trimmedDslLines.length > 0 && trimmedDslLines[trimmedDslLines.length - 1].trim() === '') {
      trimmedDslLines.pop();
    }
    const escapedDsl = trimmedDslLines.join('\n').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

    const formatObjectArray = (items: unknown[], indent: string) => {
      if (items.length === 0) {
        return '';
      }
      return `\n${items.map((item) => `${indent}${JSON.stringify(item)}`).join(',\n')}\n`;
    };

    const expectedGeometryLiteral = `const expectedGeometry = {\n  "nodes": [${formatObjectArray(snapshot.nodes, '    ')}  ],\n  "edges": [${formatObjectArray(snapshot.edges, '    ')}  ]\n};`;
    const harnessArrange = `const dsl = \`\n${escapedDsl}\n\`;\n${expectedGeometryLiteral}\n\nawait assertGeometry(dsl, expectedGeometry);`;
    console.log('[slicr][diagram-geometry][arrange]', harnessArrange);
    try {
      await navigator.clipboard.writeText(harnessArrange);
      console.info('[slicr][diagram-geometry] arrange snippet copied to clipboard');
    } catch {
      // Clipboard may be unavailable in some contexts.
    }
  };

  const onSelectSlice = (sliceId: string) => {
    setSelectedNodeKey(null);
    setHighlightRange(null);
    setLibrary((currentLibrary) => switchSliceWithOverrides(currentLibrary, sliceId));
  };

  const onCreateSlice = () => {
    setSelectedNodeKey(null);
    setHighlightRange(null);
    setLibrary((currentLibrary) => {
      const nextLibrary = addNewSlice(currentLibrary);
      applySelectedSliceOverrides(nextLibrary.selectedSliceId);
      return nextLibrary;
    });
  };

  const onJumpToUsage = (sliceId: string, nodeKey: string) => {
    setSelectedNodeKey(nodeKey);
    pendingFocusNodeKeyRef.current = nodeKey;
    setFocusRequestVersion((version) => version + 1);
    setLibrary((currentLibrary) => switchSliceWithOverrides(currentLibrary, sliceId));
  };

  const onRunTraceCommand = () => {
    if (selectedNode && showDataTraceTab) {
      const firstKey = selectedNodeUsesKeys[0] ?? null;
      if (firstKey) {
        setCrossSliceTraceExpandedKeys({ [firstKey]: true });
      }
      setSelectedNodePanelTab('trace');
    }
    setCommandPaletteOpen(false);
  };

  const onShowUsageCommand = () => {
    setSelectedNodePanelTab('usage');
    setCommandPaletteOpen(false);
  };

  return {
    onToggleSliceMenu: () => setSliceMenuOpen((current) => !current),
    onToggleProjectRail: () => setProjectRailOpen((current) => !current),
    onToggleMobileMenu: () => setMobileMenuOpen((current) => !current),
    onCloseMobileMenu: () => setMobileMenuOpen(false),
    onToggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    onToggleEditor: () => setEditorOpen((value) => !value),
    onToggleDocs: toggleDocumentationPanel,
    onSelectSlice,
    onCreateSlice,
    onSwitchProject,
    onCreateProject,
    onResetManualLayout: resetManualLayout,
    onPrintGeometry,
    onNodeOpenInEditor: (nodeKey, range) => {
      setSelectedNodeKey(nodeKey);
      setEditorOpen(true);
      focusRange(range);
    },
    onNodeSelect: (nodeKeyOrUpdater) => {
      if (diagramMode === 'slice' && !layoutReady) {
        return;
      }
      setSelectedNodeKey(nodeKeyOrUpdater);
    },
    onNodeHoverRange: (range) => {
      if (diagramMode === 'overview') {
        setHighlightRange(null);
        return;
      }
      if (!layoutReady) {
        return;
      }
      setHighlightRange(range);
    },
    onEdgeHover: (edgeKeyOrUpdater) => setHoveredEdgeKey(edgeKeyOrUpdater),
    onSelectedNodePanelTabChange: (tab) => setSelectedNodePanelTab(tab),
    onToggleCrossSliceDataExpanded: (key) =>
      setCrossSliceDataExpandedKeys((current) => ({ ...current, [key]: !current[key] })),
    onToggleCrossSliceTraceExpanded: (key) =>
      setCrossSliceTraceExpandedKeys((current) => ({ ...current, [key]: !current[key] })),
    onTraceNodeHover: (nodeKeyOrUpdater) => setHoveredTraceNodeKey(nodeKeyOrUpdater),
    onSetSourceOverride: (issueNodeKey, issueKey, candidate) =>
      setSourceOverrides((current) => ({
        ...current,
        [`${issueNodeKey}:${issueKey}`]: candidate
      })),
    onJumpToUsage,
    onCloseCommandPalette: () => setCommandPaletteOpen(false),
    onOpenCreateProjectDialog: () => {
      setCommandPaletteOpen(false);
      setCreateProjectDialogOpen(true);
    },
    onCloseCreateProjectDialog: () => setCreateProjectDialogOpen(false),
    onOpenCompactEventsDialog: () => {
      setCommandPaletteOpen(false);
      setCompactEventsSummary(null);
      setCompactEventsDialogOpen(true);
    },
    onCloseCompactEventsDialog: () => setCompactEventsDialogOpen(false),
    onRunEventCompaction: (plan: CompactionPlan) => {
      const result = executeEventCompaction(localStorage, plan);
      const projectedIndex = loadProjectIndex();
      const nextProjectId = projectedIndex.selectedProjectId;
      const nextLibrary = loadSliceLibrary(DEFAULT_DSL, nextProjectId);

      setProjectIndex(projectedIndex);
      setLibrary(nextLibrary);
      setSelectedNodeKey(null);
      setHighlightRange(null);
      setHoveredEdgeKey(null);
      setHoveredTraceNodeKey(null);
      applySelectedSliceOverrides(nextLibrary.selectedSliceId, nextProjectId);
      setCompactEventsDialogOpen(false);
      setCompactEventsSummary(`Reclaimed ${result.reclaimedBytes} bytes.`);
    },
    onOpenAddNodeDialog: () => {
      setCommandPaletteOpen(false);
      setAddNodeDialogOpen(true);
    },
    onCloseAddNodeDialog: () => setAddNodeDialogOpen(false),
    onCreateNodeFromDialog: ({ dslBlock }) => {
      const shouldOpenEditor = !hasFocusedCursor();
      if (shouldOpenEditor) {
        setEditorOpen(true);
      }
      const inserted = insertAtCursorOrEnd(dslBlock);
      if (inserted.to > inserted.from) {
        focusRange(inserted);
      }
      setAddNodeDialogOpen(false);
      setCommandPaletteOpen(false);
    },
    onOpenImportNodeDialog: () => {
      setCommandPaletteOpen(false);
      setImportNodeDialogOpen(true);
    },
    onCloseImportNodeDialog: () => setImportNodeDialogOpen(false),
    onCreateImportedNodeFromDialog: ({ dslBlock }) => {
      const shouldOpenEditor = !hasFocusedCursor();
      if (shouldOpenEditor) {
        setEditorOpen(true);
      }
      const inserted = insertAtCursorOrEnd(dslBlock);
      if (inserted.to > inserted.from) {
        focusRange(inserted);
      }
      setImportNodeDialogOpen(false);
      setCommandPaletteOpen(false);
    },
    onOpenCreateSliceTemplateDialog: () => {
      setCommandPaletteOpen(false);
      setCreateSliceTemplateDialogOpen(true);
    },
    onCloseCreateSliceTemplateDialog: () => setCreateSliceTemplateDialogOpen(false),
    onApplySliceTemplateFromDialog: ({ targetMode, text }) => {
      if (targetMode === 'create-new') {
        let nextSelectedSliceId: string | null = null;
        setLibrary((currentLibrary) => {
          const withNewSlice = addNewSlice(currentLibrary);
          const updated = updateSelectedSliceDsl(withNewSlice, text);
          nextSelectedSliceId = updated.selectedSliceId;
          return updated;
        });
        if (nextSelectedSliceId) {
          applySelectedSliceOverrides(nextSelectedSliceId);
        }
      } else {
        const shouldOpenEditor = !hasFocusedCursor();
        if (shouldOpenEditor) {
          setEditorOpen(true);
        }
        const inserted = insertAtCursorOrEnd(text);
        if (inserted.to > inserted.from) {
          focusRange(inserted);
        }
      }
      setCreateSliceTemplateDialogOpen(false);
      setCommandPaletteOpen(false);
    },
    onRunTraceCommand,
    onShowUsageCommand,
    onShowProjectOverview: () => {
      if (diagramMode === 'overview') {
        setCommandPaletteOpen(false);
        return;
      }
      setOverviewReturnState({
        editorOpen: editorOpenRef.current ?? false,
        selectedNodeKey: sliceSelectedNodeKeyRef.current ?? null
      });
      setSliceSelectedNodeKey(null);
      setOverviewSelectedNodeKey(null);
      setHighlightRange(null);
      setHoveredEdgeKey(null);
      setHoveredTraceNodeKey(null);
      setEditorOpen(false);
      setOverviewPlaceholderSceneModel(currentDiagramSceneModel);
      setDiagramMode('overview');
      setCommandPaletteOpen(false);
    },
    onHideProjectOverview: () => {
      setOverviewSelectedNodeKey(null);
      setEditorOpen(overviewReturnState.editorOpen);
      setSliceSelectedNodeKey(overviewReturnState.selectedNodeKey);
      setOverviewPlaceholderSceneModel(null);
      setDiagramMode('slice');
      setCommandPaletteOpen(false);
    },
    onToggleOverviewNodeDataVisibility: () => setOverviewNodeDataVisible((current) => !current)
  };
}
