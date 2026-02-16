export type NodeType = string;

export type NodeData = Record<string, unknown> | null;

export type VisualNode = {
  type: NodeType;
  name: string;
  key: string;
  data: NodeData;
  srcRange: { from: number; to: number };
};

export type Edge = {
  from: string;
  to: string;
  label: string | null;
};

export type Parsed = {
  sliceName: string;
  nodes: Map<string, VisualNode>;
  edges: Edge[];
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
