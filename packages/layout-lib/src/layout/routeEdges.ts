import type { RouteEdgesApi } from "./types";

export const routeEdges: RouteEdgesApi = (request) => {
  return {
    ok: true,
    result: {
      edges: request.edges.map((edge) => {
        const source = request.nodes.find((node) => node.id === edge.sourceId)!;
        const target = request.nodes.find((node) => node.id === edge.targetId)!;
        const isUpward = target.y < source.y;
        const sourceAnchor = isUpward
          ? {
              x: source.x + source.width / 2,
              y: source.y,
              side: "top" as const,
              ordinal: 0,
            }
          : {
              x: source.x + source.width / 2,
              y: source.y + source.height,
              side: "bottom" as const,
              ordinal: 0,
            };
        const targetAnchor = isUpward
          ? {
              x: target.x,
              y: target.y + target.height / 2,
              side: "left" as const,
              ordinal: 0,
            }
          : {
              x: target.x + target.width / 2,
              y: target.y,
              side: "top" as const,
              ordinal: 0,
            };

        const points = isUpward
          ? [
              { x: sourceAnchor.x, y: sourceAnchor.y },
              { x: sourceAnchor.x, y: targetAnchor.y },
              { x: targetAnchor.x, y: targetAnchor.y },
            ]
          : sourceAnchor.x === targetAnchor.x
            ? [
                { x: sourceAnchor.x, y: sourceAnchor.y },
                { x: targetAnchor.x, y: targetAnchor.y },
              ]
            : [
                { x: sourceAnchor.x, y: sourceAnchor.y },
                { x: sourceAnchor.x, y: sourceAnchor.y + 20 },
                { x: targetAnchor.x, y: sourceAnchor.y + 20 },
                { x: targetAnchor.x, y: targetAnchor.y },
              ];

        return {
          id: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          sourceAnchor,
          targetAnchor,
          points,
        };
      }),
    },
  };
};
