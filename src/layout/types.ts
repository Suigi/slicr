export interface LayoutRequest {
  nodes: NodeInput[];
  edges: EdgeInput[];
  lanes: LaneInput[];
  groups?: GroupInput[];
  defaults: DefaultSizeOptions;
  spacing?: SpacingOptions;
}

export interface NodeInput {
  id: string;
  laneId: string;
  groupId?: string;
  width?: number;
  height?: number;
}

export interface EdgeInput {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface LaneInput {
  id: string;
  order: number;
}

export interface GroupInput {
  id: string;
  order: number;
}

export interface DefaultSizeOptions {
  nodeWidth: number;
  nodeHeight: number;
}

export interface SpacingOptions {
  laneMargin?: number;
  laneGap?: number;
  groupGap?: number;
  minTargetShift?: number;
  minNodeGap?: number;
}

export interface LayoutResult {
  nodes: NodeLayout[];
  lanes: LaneLayout[];
  groups?: GroupLayout[];
  edges: EdgeLayout[];
}

export interface NodeLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LaneLayout {
  id: string;
  top: number;
  bottom: number;
}

export interface GroupLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EdgeLayout {
  id: string;
  sourceId: string;
  targetId: string;
  sourceAnchor: AnchorPoint;
  targetAnchor: AnchorPoint;
  points: Point[];
}

export interface Point {
  x: number;
  y: number;
}

export type AnchorSide = "top" | "right" | "bottom" | "left";

export interface AnchorPoint extends Point {
  side: AnchorSide;
  ordinal: number;
}

export type LayoutFailureType =
  | "InvalidReference"
  | "MissingGroupAssignment"
  | "CycleDetected"
  | "BackEdgeDetected"
  | "BidirectionalGroupFlow"
  | "UnsatisfiableConstraints";

export interface LayoutFailure {
  type: LayoutFailureType;
  message: string;
  details?: unknown;
}

export type LayoutResponse =
  | { ok: true; result: LayoutResult }
  | { ok: false; error: LayoutFailure };

export type LayoutApi = (request: LayoutRequest) => LayoutResponse;
