import { getArrowRenderPoints, getRoundedPath } from '../graph/graphUtils';

type ArrowRenderPoints = NonNullable<ReturnType<typeof getArrowRenderPoints>>;

type EdgeLayerProps = {
  edges: Array<{ id: string; points: ArrowRenderPoints; isConnectedToFocusedNode: boolean }>;
};

export function EdgeLayer({ edges }: EdgeLayerProps) {
  return (
    <svg className="edge-layer" aria-hidden="true">
      {edges.map(({ id, points, isConnectedToFocusedNode }) => (
        <g key={id} className={isConnectedToFocusedNode ? 'edge-connected-to-focused-node' : undefined}>
          <path className="edge-line" d={getRoundedPath(points.linePoints)} />
          <polygon className="edge-arrow" points={points.arrowPoints.map((point) => `${point.x},${point.y}`).join(' ')} />
        </g>
      ))}
    </svg>
  );
}
