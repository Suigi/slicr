import type { AnchorPoint, Point } from "../layout/types";

export type EdgeOverride = {
  sourceAnchor?: AnchorPoint;
  targetAnchor?: AnchorPoint;
  points?: Point[];
};

type EdgeGeometry = {
  sourceAnchor: AnchorPoint;
  targetAnchor: AnchorPoint;
  points: Point[];
};

export function createBaseEdgeOverride(edge: EdgeGeometry, sourceDelta: Point, targetDelta: Point): Required<EdgeOverride> {
  return {
    sourceAnchor: translatePoint(edge.sourceAnchor, { x: -sourceDelta.x, y: -sourceDelta.y }),
    targetAnchor: translatePoint(edge.targetAnchor, { x: -targetDelta.x, y: -targetDelta.y }),
    points: edge.points.map((point, index, allPoints) => {
      if (index <= 1) {
        return translatePoint(point, { x: -sourceDelta.x, y: -sourceDelta.y });
      }
      if (index >= allPoints.length - 2) {
        return translatePoint(point, { x: -targetDelta.x, y: -targetDelta.y });
      }
      return { ...point };
    }),
  };
}

function translatePoint<T extends Point>(point: T, delta: Point): T {
  return { ...point, x: point.x + delta.x, y: point.y + delta.y };
}
