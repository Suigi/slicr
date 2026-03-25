import type { Range } from '../useDslEditor';
import type { DiagramPoint as RoutingPoint } from '../domain/diagramRouting';
import type { VisualNode } from '../domain/types';

export const DIAGRAM_RENDERER_CONTRACT_INVARIANTS = [
  'Stable IDs: node keys and edge keys must be deterministic and remain stable across renders for identical diagram inputs.',
  'Coordinate Space: all scene coordinates are world-space values; renderer-specific viewport/camera transforms must be applied separately.',
  'Commit-on-end: drag interactions may update optimistic UI state while moving, but commit callbacks fire only at interaction end.'
] as const;

export type DiagramPoint = { x: number; y: number };

export type DiagramNode = {
  renderKey: string;
  key: string;
  interactionNodeKey?: string;
  backingNodeKeys?: string[];
  hidden?: boolean;
  node: VisualNode;
  nodePrefix: string;
  className: string;
  type: string;
  title: string;
  prefix: string;
  x: number;
  y: number;
  w: number;
  h: number;
  srcRange: Range;
  highlighted: boolean;
  selected: boolean;
  related: boolean;
};

export type DiagramEdge = {
  renderKey: string;
  key: string;
  edgeKey: string;
  from: string;
  to: string;
  path: string;
  d: string;
  label: string | null;
  points: RoutingPoint[];
  draggableSegmentIndices: number[];
  labelX: number;
  labelY: number;
  hovered: boolean;
  related: boolean;
};

export type DiagramLane = {
  key: string;
  row: number;
  bandTop: number;
  bandHeight: number;
  y: number;
  height: number;
  streamLabel: string;
  labelTop: number;
  labelLeft: number;
};

export type DiagramBoundary = {
  key: string;
  left: number;
  x: number;
  top: number;
  height: number;
};

export type DiagramTitle = {
  text: string;
  top: number;
  left: number;
};

export type DiagramSliceFrame = {
  key: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  labelLeft: number;
  labelTop: number;
};

export type DiagramViewport = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

export type DiagramScenarioNode = {
  key: string;
  node?: VisualNode;
  nodePrefix?: string;
  className?: string;
  type: string;
  title: string;
  prefix: string;
  srcRange: Range;
  highlighted?: boolean;
  selected?: boolean;
};

export type DiagramScenario = {
  name: string;
  srcRange: Range;
  given: DiagramScenarioNode[];
  when: DiagramScenarioNode | null;
  then: DiagramScenarioNode[];
};

export type DiagramScenarioGroup = {
  key: string;
  sliceId: string;
  sliceName: string;
  left: number;
  top: number;
  width: number;
  height: number;
  scenarios: DiagramScenario[];
};

export type DiagramCrossSliceLink = {
  key: string;
  logicalRef: string;
  renderMode: 'shared-node' | 'dashed-connector';
  fromNodeKey: string;
  toNodeKey: string;
  points?: RoutingPoint[];
};

export type DiagramSharedNodeAnchor = {
  key: string;
  logicalRef: string;
  leftSliceNodeKey: string;
  rightSliceNodeKey: string;
  x: number;
  y: number;
};

export type DiagramSceneModel = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  crossSliceLinks: DiagramCrossSliceLink[];
  sharedNodeAnchors: DiagramSharedNodeAnchor[];
  lanes: DiagramLane[];
  boundaries: DiagramBoundary[];
  scenarios: DiagramScenario[];
  scenarioGroups?: DiagramScenarioGroup[];
  worldWidth: number;
  worldHeight: number;
  title: DiagramTitle | null;
  sliceFrames: DiagramSliceFrame[];
  viewport: DiagramViewport | null;
};

export type DiagramRendererCallbacks = {
  onNodeHoverRange: (range: Range | null) => void;
  onNodeSelect: (nodeKey: string | null) => void;
  onEdgeHover: (edgeKey: string | null) => void;
  onNodeMoveCommit: (nodeKey: string, point: DiagramPoint) => void;
  onEdgePointsCommit: (edgeKey: string, points: DiagramPoint[]) => void;
  onCanvasPointerDown?: () => void;
  onViewportChange?: (view: { x: number; y: number; zoom: number }) => void;
};

export type DiagramRendererProps = {
  scene: DiagramSceneModel;
  callbacks: DiagramRendererCallbacks;
  className?: string;
};

export function createNoopDiagramRendererCallbacks(
  overrides: Partial<DiagramRendererCallbacks> = {}
): DiagramRendererCallbacks {
  return {
    onNodeHoverRange: () => {},
    onNodeSelect: () => {},
    onEdgeHover: () => {},
    onNodeMoveCommit: () => {},
    onEdgePointsCommit: () => {},
    ...overrides
  };
}

export type SceneValidationResult = {
  ok: boolean;
  errors: string[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateDiagramSceneModel(scene: DiagramSceneModel): SceneValidationResult {
  const errors: string[] = [];

  const nodeKeys = new Set<string>();
  for (const node of scene.nodes) {
    if (nodeKeys.has(node.key)) {
      errors.push(`duplicate node key: ${node.key}`);
    }
    nodeKeys.add(node.key);

    if (![node.x, node.y, node.w, node.h].every(isFiniteNumber)) {
      errors.push(`non-finite node geometry: ${node.key}`);
    }
  }

  const edgeKeys = new Set<string>();
  for (const edge of scene.edges) {
    if (edgeKeys.has(edge.key)) {
      errors.push(`duplicate edge key: ${edge.key}`);
    }
    edgeKeys.add(edge.key);

    if (!nodeKeys.has(edge.from)) {
      errors.push(`unknown source node for edge ${edge.key}: ${edge.from}`);
    }
    if (!nodeKeys.has(edge.to)) {
      errors.push(`unknown target node for edge ${edge.key}: ${edge.to}`);
    }
  }

  const crossSliceLinkKeys = new Set<string>();
  for (const link of scene.crossSliceLinks) {
    if (crossSliceLinkKeys.has(link.key)) {
      errors.push(`duplicate cross-slice link key: ${link.key}`);
    }
    crossSliceLinkKeys.add(link.key);

    if (!nodeKeys.has(link.fromNodeKey)) {
      errors.push(`unknown source node for cross-slice link ${link.key}: ${link.fromNodeKey}`);
    }
    if (!nodeKeys.has(link.toNodeKey)) {
      errors.push(`unknown target node for cross-slice link ${link.key}: ${link.toNodeKey}`);
    }
  }

  const sharedNodeAnchorKeys = new Set<string>();
  for (const anchor of scene.sharedNodeAnchors) {
    if (sharedNodeAnchorKeys.has(anchor.key)) {
      errors.push(`duplicate shared-node anchor key: ${anchor.key}`);
    }
    sharedNodeAnchorKeys.add(anchor.key);

    if (!nodeKeys.has(anchor.leftSliceNodeKey)) {
      errors.push(`unknown left node for shared-node anchor ${anchor.key}: ${anchor.leftSliceNodeKey}`);
    }
    if (!nodeKeys.has(anchor.rightSliceNodeKey)) {
      errors.push(`unknown right node for shared-node anchor ${anchor.key}: ${anchor.rightSliceNodeKey}`);
    }

    if (![anchor.x, anchor.y].every(isFiniteNumber)) {
      errors.push(`non-finite shared-node anchor geometry: ${anchor.key}`);
    }
  }

  if (scene.viewport) {
    if (!isFiniteNumber(scene.viewport.width) || scene.viewport.width <= 0) {
      errors.push('viewport width must be > 0');
    }
    if (!isFiniteNumber(scene.viewport.height) || scene.viewport.height <= 0) {
      errors.push('viewport height must be > 0');
    }
    if (!isFiniteNumber(scene.viewport.offsetX) || !isFiniteNumber(scene.viewport.offsetY)) {
      errors.push('viewport offsets must be finite');
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
