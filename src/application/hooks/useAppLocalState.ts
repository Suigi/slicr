import { useRef, useState } from 'react';
import { DEFAULT_DSL } from '../../defaultDsl';
import type { DiagramPoint } from '../../domain/diagramRouting';
import type { DiagramEngineId } from '../../domain/diagramEngine';
import { getDiagramRendererId, isCrossSliceDataEnabled, isDragAndDropEnabled, shouldShowDevDiagramControls } from '../../domain/runtimeFlags';
import { getSliceNameFromDsl, loadSliceLayoutOverrides, loadSliceLibrary, type SliceLibrary } from '../../sliceLibrary';
import { loadProjectIndex } from '../../projectLibrary';
import type { Range } from '../../useDslEditor';

const THEME_STORAGE_KEY = 'slicr.theme';
const ROUTE_MODE_STORAGE_KEY = 'slicr.routeMode';

export type ThemeMode = 'dark' | 'light';
export type RouteMode = DiagramEngineId;

export function useAppLocalState() {
  const [initialSnapshot] = useState<{
    projectIndex: ReturnType<typeof loadProjectIndex>;
    library: SliceLibrary;
    overrides: ReturnType<typeof loadSliceLayoutOverrides>;
  }>(() => {
    const projectIndex = loadProjectIndex();
    const initialLibrary = loadSliceLibrary(DEFAULT_DSL, projectIndex.selectedProjectId);
    return {
      projectIndex,
      library: initialLibrary,
      overrides: loadSliceLayoutOverrides(initialLibrary.selectedSliceId, projectIndex.selectedProjectId)
    };
  });

  const [projectIndex, setProjectIndex] = useState(initialSnapshot.projectIndex);
  const [library, setLibrary] = useState(initialSnapshot.library);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sliceMenuRef = useRef<HTMLDivElement>(null);
  const routeMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const skipNextLayoutSaveRef = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorMountRef = useRef<HTMLDivElement>(null);
  const [highlightRange, setHighlightRange] = useState<Range | null>(null);
  const [hoveredEditorRange, setHoveredEditorRange] = useState<Range | null>(null);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);
  const [diagramRendererId] = useState(() => getDiagramRendererId(window.location.hostname));
  const [routeMode, setRouteMode] = useState<RouteMode>(() => {
    try {
      const saved = localStorage.getItem(ROUTE_MODE_STORAGE_KEY);
      return saved === 'classic' ? 'classic' : 'elk';
    } catch {
      return 'elk';
    }
  });
  const [docsOpen, setDocsOpen] = useState(false);
  const [hasOpenedDocs, setHasOpenedDocs] = useState(false);
  const [sliceMenuOpen, setSliceMenuOpen] = useState(false);
  const [routeMenuOpen, setRouteMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [manualNodePositions, setManualNodePositions] = useState<Record<string, { x: number; y: number }>>(
    initialSnapshot.overrides.nodes
  );
  const [manualEdgePoints, setManualEdgePoints] = useState<Record<string, DiagramPoint[]>>(
    initialSnapshot.overrides.edges
  );
  const [focusRequestVersion, setFocusRequestVersion] = useState(0);
  const pendingFocusNodeKeyRef = useRef<string | null>(null);

  const hasManualLayoutOverrides =
    Object.keys(manualNodePositions).length > 0 || Object.keys(manualEdgePoints).length > 0;
  const showDevDiagramControls = shouldShowDevDiagramControls(window.location.hostname);
  const dragAndDropEnabled = isDragAndDropEnabled(window.location.hostname);
  const crossSliceDataEnabled = isCrossSliceDataEnabled(window.location.hostname);

  const selectedProjectId = projectIndex.selectedProjectId;
  const currentProject = projectIndex.projects.find((project) => project.id === selectedProjectId) ?? projectIndex.projects[0];
  const currentProjectName = currentProject?.name ?? 'Default';
  const currentSlice = library.slices.find((slice) => slice.id === library.selectedSliceId) ?? library.slices[0];
  const currentDsl = currentSlice?.dsl ?? DEFAULT_DSL;
  const currentSliceName = getSliceNameFromDsl(currentDsl);

  return {
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
    mobileMenuOpen,
    setMobileMenuOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
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
  };
}
