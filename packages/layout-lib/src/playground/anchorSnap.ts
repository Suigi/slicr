import type { AnchorPoint, NodeLayout } from "../layout/types";

const GRID_SIZE = 10;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function snapToGrid(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function snapNodeHorizontalAnchorX(node: Pick<NodeLayout, "x" | "width">, value: number) {
  const centerX = node.x + node.width / 2;
  const snapped = centerX + Math.round((value - centerX) / GRID_SIZE) * GRID_SIZE;
  return clamp(snapped, node.x, node.x + node.width);
}

export function snapAnchorToNode(anchor: AnchorPoint, node: Pick<NodeLayout, "x" | "y" | "width" | "height">): AnchorPoint {
  if (anchor.side === "top" || anchor.side === "bottom") {
    return { ...anchor, x: snapNodeHorizontalAnchorX(node, anchor.x), y: anchor.side === "top" ? node.y : node.y + node.height };
  }
  return {
    ...anchor,
    x: anchor.side === "left" ? node.x : node.x + node.width,
    y: clamp(snapToGrid(anchor.y), node.y, node.y + node.height),
  };
}
