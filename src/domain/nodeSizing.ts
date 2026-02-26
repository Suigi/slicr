export type NodeDimensions = {
  width: number;
  height: number;
};

export const DEFAULT_NODE_WIDTH = 180;

export function projectNodeHeights(
  nodeDimensions?: Record<string, NodeDimensions>
): Record<string, number> | undefined {
  if (!nodeDimensions) {
    return undefined;
  }
  const heights: Record<string, number> = {};
  Object.entries(nodeDimensions).forEach(([key, dimensions]) => {
    if (Number.isFinite(dimensions.height) && dimensions.height > 0) {
      heights[key] = Math.round(dimensions.height);
    }
  });
  return heights;
}
