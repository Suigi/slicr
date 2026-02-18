export type NodeType = string;

export type NodeData = Record<string, unknown> | null;

export type VisualNode = {
  type: NodeType;
  name: string;
  alias: string | null;
  key: string;
  data: NodeData;
  srcRange: { from: number; to: number };
};

export type Edge = {
  from: string;
  to: string;
  label: string | null;
};

export type ParseWarning = {
  message: string;
  range: { from: number; to: number };
};

export type SliceBoundary = {
  after: string;
};

export type Parsed = {
  sliceName: string;
  nodes: Map<string, VisualNode>;
  edges: Edge[];
  warnings: ParseWarning[];
  boundaries: SliceBoundary[];
};

export type Position = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type LayoutResult = {
  pos: Record<string, Position>;
  rowY: Record<number, number>;
  usedRows: number[];
  w: number;
  h: number;
};
