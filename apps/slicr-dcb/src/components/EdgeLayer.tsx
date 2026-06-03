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
            strokeDasharray={role === 'back-reference' ? '10,5' : undefined}
          />
          <polygon className="edge-arrow" points={points.arrowPoints.map((point) => `${point.x},${point.y}`).join(' ')} />
        </g>
      ))}
    </svg>
  );
}
