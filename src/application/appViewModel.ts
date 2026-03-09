import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { DiagramPoint } from '../domain/diagramRouting';
import type { DiagramRendererComponent } from '../diagram/rendererRegistry';
import type { DiagramSceneModel } from '../diagram/rendererContract';
import type { DiagramRendererId } from '../domain/runtimeFlags';
import type { DragTooltipState } from '../useDiagramInteractions';
import type { Range } from '../useDslEditor';
import type { SliceLibrary } from '../sliceLibrary';
import type { ProjectIndex } from '../projectLibrary';
import type { Parsed, VisualNode } from '../domain/types';
import type { ParsedSliceProjection } from '../domain/parsedSliceProjection';
import type { FormattedNodeField } from '../domain/formatNodeData';
import type { DataIssue } from '../domain/dataIssues';
import type { CrossSliceUsageRef } from '../domain/crossSliceUsage';
import type { CompactionPlan } from '../eventCompaction';

export type ThemeMode = 'dark' | 'light';
export type NodePanelTab = 'usage' | 'crossSliceData' | 'trace';

export type CrossSliceUsageEntry = {
  usage: CrossSliceUsageRef;
  sliceName: string;
  node: VisualNode | null;
};

export type CrossSliceUsageGroup = {
  sliceId: string;
  sliceName: string;
  entries: CrossSliceUsageEntry[];
};

export type TraceResult = {
  nodeKey: string;
  result: NonNullable<{
    source: unknown;
    hops: Array<{ nodeKey: string; key: string }>;
    contributors?: Array<{ label: string; hops: Array<{ nodeKey: string; key: string }> }>;
  }>;
};

export type ValueChangeHandler<T> = (value: T | ((current: T) => T)) => void;
export type NodeSelectionHandler = ValueChangeHandler<string | null>;
export type EdgeHoverHandler = ValueChangeHandler<string | null>;
export type RangeHoverHandler = (range: Range | null) => void;
export type TraceNodeHoverHandler = ValueChangeHandler<string | null>;

export type HeaderSection = {
  projectIndex: ProjectIndex;
  selectedProjectId: string;
  currentProjectName: string;
  currentSliceName: string;
  library: SliceLibrary;
  getSliceNameFromDsl: (dsl: string) => string;
  theme: ThemeMode;
  docsOpen: boolean;
  showDevDiagramControls: boolean;
  hasManualLayoutOverrides: boolean;
  sliceMenuOpen: boolean;
  mobileMenuOpen: boolean;
  projectRailOpen: boolean;
  sliceMenuRef: RefObject<HTMLDivElement | null>;
  mobileMenuRef: RefObject<HTMLDivElement | null>;
  toggleRef: RefObject<HTMLButtonElement | null>;
};

export type EditorSection = {
  editorOpen: boolean;
  errorText: string;
  editorRef: RefObject<HTMLDivElement | null>;
  editorMountRef: RefObject<HTMLDivElement | null>;
  collapseAllDataRegions: () => void;
  collapseAllRegions: () => void;
  expandAllRegions: () => void;
};

export type DiagramSection = {
  parsed: Parsed | null;
  parsedSliceProjectionList: ParsedSliceProjection<Parsed>[];
  currentDsl: string;
  sceneModel: DiagramSceneModel | null;
  DiagramRenderer: DiagramRendererComponent;
  diagramRendererId: DiagramRendererId;
  rendererViewportKey: string;
  initialCamera?: { x: number; y: number; zoom: number };
  dragTooltip: DragTooltipState | null;
  dragAndDropEnabled: boolean;
  isPanning: boolean;
  canvasPanelRef: RefObject<HTMLDivElement | null>;
  beginCanvasPan: (event: ReactPointerEvent<HTMLDivElement>) => void;
  beginNodeDrag: (event: ReactPointerEvent, nodeKey: string) => void;
  beginEdgeSegmentDrag: (event: ReactPointerEvent, edgeKey: string, segmentIndex: number, points: DiagramPoint[]) => void;
};

export type AnalysisPanelSection = {
  selectedNode: VisualNode | null;
  selectedSliceId: string;
  selectedNodePanelTab: NodePanelTab;
  selectedNodeAnalysisRef: string | null;
  selectedNodeAnalysisHeader: { type: string; key: string };
  selectedNodeCrossSliceData: { keys: string[]; byKey: Record<string, Array<{ sliceId: string; sliceName: string; value: unknown }>> };
  selectedNodeIssues: DataIssue[];
  selectedNodeIssuesByKey: Record<string, DataIssue[]>;
  selectedNodeTraceResultsByKey: Record<string, TraceResult[]>;
  selectedNodeUsesKeys: string[];
  missingSourceIssueKeys: Set<string>;
  crossSliceUsageGroups: CrossSliceUsageGroup[];
  crossSliceDataEnabled: boolean;
  showDataTraceTab: boolean;
  crossSliceDataExpandedKeys: Record<string, boolean>;
  crossSliceTraceExpandedKeys: Record<string, boolean>;
  sourceOverrides: Record<string, string>;
};

export type AuxPanelsSection = {
  docsOpen: boolean;
  hasOpenedDocs: boolean;
  commandPaletteOpen: boolean;
  createProjectDialogOpen: boolean;
  compactEventsDialogOpen: boolean;
  compactEventsSummary: string | null;
  addNodeDialogOpen: boolean;
  importNodeDialogOpen: boolean;
  createSliceTemplateDialogOpen: boolean;
};

export type ConstantsSection = {
  TYPE_LABEL: Record<string, string>;
  NODE_VERSION_SUFFIX: RegExp;
  NODE_MEASURE_NODE_CLASS: string;
  MISSING_DATA_VALUE: string;
  formatNodeData: (data: Record<string, unknown> | null) => FormattedNodeField[];
  formatTraceSource: (source: unknown) => string;
  getAmbiguousSourceCandidates: typeof import('../domain/dataIssues').getAmbiguousSourceCandidates;
};

export type ActionsSection = {
  onToggleSliceMenu: () => void;
  onToggleProjectRail: () => void;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
  onToggleTheme: () => void;
  onToggleEditor: () => void;
  onToggleDocs: () => void;
  onSelectSlice: (sliceId: string) => void;
  onCreateSlice: () => void;
  onSwitchProject: (projectId: string) => void;
  onCreateProject: (name: string) => void;
  onResetManualLayout: () => void;
  onPrintGeometry: () => Promise<void>;
  onNodeOpenInEditor: (nodeKey: string, range: Range) => void;
  onNodeSelect: NodeSelectionHandler;
  onNodeHoverRange: RangeHoverHandler;
  onEdgeHover: EdgeHoverHandler;
  onSelectedNodePanelTabChange: (tab: NodePanelTab) => void;
  onToggleCrossSliceDataExpanded: (key: string) => void;
  onToggleCrossSliceTraceExpanded: (key: string) => void;
  onTraceNodeHover: TraceNodeHoverHandler;
  onSetSourceOverride: (issueNodeKey: string, issueKey: string, candidate: string) => void;
  onJumpToUsage: (sliceId: string, nodeKey: string) => void;
  onCloseCommandPalette: () => void;
  onOpenCreateProjectDialog: () => void;
  onCloseCreateProjectDialog: () => void;
  onOpenCompactEventsDialog: () => void;
  onCloseCompactEventsDialog: () => void;
  onRunEventCompaction: (plan: CompactionPlan) => void;
  onOpenAddNodeDialog: () => void;
  onCloseAddNodeDialog: () => void;
  onCreateNodeFromDialog: (args: { dslBlock: string; insertionHint?: { preferCursor: boolean } }) => void;
  onOpenImportNodeDialog: () => void;
  onCloseImportNodeDialog: () => void;
  onCreateImportedNodeFromDialog: (args: { dslBlock: string; insertionHint?: { preferCursor: boolean } }) => void;
  onOpenCreateSliceTemplateDialog: () => void;
  onCloseCreateSliceTemplateDialog: () => void;
  onApplySliceTemplateFromDialog: (args: { targetMode: 'create-new' | 'add-current'; text: string }) => void;
  onRunTraceCommand: () => void;
  onShowUsageCommand: () => void;
};

export type AppShellProps = {
  header: HeaderSection;
  editor: EditorSection;
  diagram: DiagramSection;
  analysisPanel: AnalysisPanelSection;
  auxPanels: AuxPanelsSection;
  constants: ConstantsSection;
  actions: ActionsSection;
};

export type UseAppStateResult = AppShellProps;
