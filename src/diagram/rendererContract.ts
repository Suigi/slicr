import type { Range } from '../useDslEditor';

export type DiagramPoint = { x: number; y: number };

export type DiagramNode = {
  key: string;
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
  key: string;
  from: string;
  to: string;
  d: string;
  label: string | null;
  points: DiagramPoint[];
  labelX: number;
  labelY: number;
  hovered: boolean;
  related: boolean;
};

export type DiagramLane = {
  row: number;
  y: number;
  height: number;
  streamLabel: string;
};

export type DiagramBoundary = {
  key: string;
  x: number;
  top: number;
  height: number;
};

export type DiagramViewport = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

export type DiagramSceneModel = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  lanes: DiagramLane[];
  boundaries: DiagramBoundary[];
  title: string;
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
