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
