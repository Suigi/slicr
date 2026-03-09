import { describe, expect, it, vi } from 'vitest';
import { useAppActions } from './useAppActions';

describe('useAppActions', () => {
  it('clears hover highlight instead of forwarding overview ranges to the editor', () => {
    const setHighlightRange = vi.fn();
    const actions = useAppActions({
      diagramMode: 'overview',
      parsed: null,
      currentDsl: '',
      activeLayout: null,
      displayedPos: {},
      renderedEdges: [],
      selectedNode: null,
      showDataTraceTab: false,
      selectedNodeUsesKeys: [],
      setCrossSliceTraceExpandedKeys: vi.fn(),
      setSelectedNodePanelTab: vi.fn(),
      setCommandPaletteOpen: vi.fn(),
      setSelectedNodeKey: vi.fn(),
      setSliceSelectedNodeKey: vi.fn(),
      setOverviewSelectedNodeKey: vi.fn(),
      setOverviewReturnState: vi.fn(),
      setHighlightRange,
      setLibrary: vi.fn(),
      projectIndex: { projects: [], selectedProjectId: 'project-1' },
      setProjectIndex: vi.fn(),
      selectedProjectId: 'project-1',
      applySelectedSliceOverrides: vi.fn(),
      pendingFocusNodeKeyRef: { current: null },
      setFocusRequestVersion: vi.fn(),
      editorOpenRef: { current: false },
      sliceSelectedNodeKeyRef: { current: null },
      overviewReturnState: { editorOpen: false, selectedNodeKey: null },
      setEditorOpen: vi.fn(),
      setDiagramMode: vi.fn(),
      focusRange: vi.fn(),
      setSliceMenuOpen: vi.fn(),
      setProjectRailOpen: vi.fn(),
      setMobileMenuOpen: vi.fn(),
      setCreateProjectDialogOpen: vi.fn(),
      setCompactEventsDialogOpen: vi.fn(),
      setCompactEventsSummary: vi.fn(),
      setAddNodeDialogOpen: vi.fn(),
      setImportNodeDialogOpen: vi.fn(),
      setCreateSliceTemplateDialogOpen: vi.fn(),
      hasFocusedCursor: () => false,
      insertAtCursorOrEnd: () => ({ from: 0, to: 0 }),
      setTheme: vi.fn(),
      setHoveredEdgeKey: vi.fn(),
      setHoveredTraceNodeKey: vi.fn(),
      setSourceOverrides: vi.fn(),
      setCrossSliceDataExpandedKeys: vi.fn(),
      resetManualLayout: vi.fn(),
      toggleDocumentationPanel: vi.fn(),
      currentDiagramSceneModel: null,
      setOverviewPlaceholderSceneModel: vi.fn()
    });

    actions.onNodeHoverRange({ from: 640, to: 640 });

    expect(setHighlightRange).toHaveBeenCalledWith(null);
  });
});
