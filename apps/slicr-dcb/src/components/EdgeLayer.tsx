import { getArrowRenderPoints, getRoundedPath } from '../graph/graphUtils';

type ArrowRenderPoints = NonNullable<ReturnType<typeof getArrowRenderPoints>>;

type EdgeRole = 'flow' | 'back-reference';

type EdgeLayerProps = {
  edges: Array<{ id: string; role?: EdgeRole; points: ArrowRenderPoints; isConnectedToFocusedNode: boolean }>;
};

export function EdgeLayer({ edges }: EdgeLayerProps) {
  return (
    <svg className="edge-layer" aria-hidden="true">
      {edges.map(({ id, role, points, isConnectedToFocusedNode }) => (
        <g key={id} className={isConnectedToFocusedNode ? 'edge-connected-to-focused-node' : undefined}>
          <path
            className="edge-line"
            d={getRoundedPath(points.linePoints)}
            strokeDasharray={role === 'back-reference' ? '2,3' : undefined}
          />
          <polyline
            className="edge-arrow"
            points={[points.arrowPoints[1], points.arrowPoints[0], points.arrowPoints[2]]
              .map((point) => `${point.x},${point.y}`)
              .join(' ')}
          />
        </g>
      ))}
    </svg>
  );
}
