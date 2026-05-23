import { useRef, useState, type PointerEvent } from 'react';
import { InfiniteCanvas, type InfiniteCanvasHandle } from '@slicr/react-ui';
import { routeEdges } from 'layout-lib';

const NODE_X = 120;
const NODE_A_Y = 96;
const NODE_WIDTH = 140;
const NODE_HEIGHT = 62;
const NODE_GAP = 100;
const NODE_B_Y = NODE_A_Y + NODE_HEIGHT + NODE_GAP;
const NODE_C_X = NODE_X + 40;
const NODE_C_Y = NODE_B_Y + NODE_HEIGHT + NODE_GAP;

const initialNodes = [
  {
    id: 'node-a',
    label: 'Node A',
    laneId: 'main',
    x: NODE_X,
    y: NODE_A_Y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  },
  {
    id: 'node-b',
    label: 'Node B',
    laneId: 'main',
    x: NODE_X,
    y: NODE_B_Y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  },
  {
    id: 'node-c',
    label: 'Node C',
    laneId: 'main',
    x: NODE_C_X,
    y: NODE_C_Y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  },
];

const edgeInputs = [
  { id: 'edge-a-b', sourceId: 'node-a', targetId: 'node-b' },
  { id: 'edge-b-c', sourceId: 'node-b', targetId: 'node-c' },
];

type Node = (typeof initialNodes)[number];

type DragState = {
  pointerId: number;
  nodeId: string;
  startClientX: number;
  startClientY: number;
  startNodeX: number;
  startNodeY: number;
};
const ARROW_LENGTH = 18;
const ARROW_WIDTH = 16;

function getRoundedPath(points: Array<{ x: number; y: number }>, radius = 6) {
  const first = points[0];
  if (!first) {
    return '';
  }

  let path = `M ${first.x} ${first.y}`;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];

    if (!previous || !current) {
      continue;
    }

    if (!next || (previous.x === next.x && previous.y === next.y)) {
      path += ` L ${current.x} ${current.y}`;
      continue;
    }

    const incomingLength = Math.hypot(current.x - previous.x, current.y - previous.y);
    const outgoingLength = Math.hypot(next.x - current.x, next.y - current.y);
    const cornerRadius = Math.min(radius, incomingLength / 2, outgoingLength / 2);
    const incomingUnit = {
      x: (current.x - previous.x) / incomingLength,
      y: (current.y - previous.y) / incomingLength,
    };
    const outgoingUnit = {
      x: (next.x - current.x) / outgoingLength,
      y: (next.y - current.y) / outgoingLength,
    };
    const beforeCorner = {
      x: current.x - incomingUnit.x * cornerRadius,
      y: current.y - incomingUnit.y * cornerRadius,
    };
    const afterCorner = {
      x: current.x + outgoingUnit.x * cornerRadius,
      y: current.y + outgoingUnit.y * cornerRadius,
    };

    path += ` L ${beforeCorner.x} ${beforeCorner.y} Q ${current.x} ${current.y} ${afterCorner.x} ${afterCorner.y}`;
  }

  return path;
}

function getArrowRenderPoints(points: Array<{ x: number; y: number }>) {
  const tip = points[points.length - 1];
  const previous = points[points.length - 2];
  if (!tip || !previous) {
    return undefined;
  }

  const dx = tip.x - previous.x;
  const dy = tip.y - previous.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return undefined;
  }

  const unitX = dx / length;
  const unitY = dy / length;
  const base = {
    x: tip.x - unitX * ARROW_LENGTH,
    y: tip.y - unitY * ARROW_LENGTH,
  };
  const perpendicularX = -unitY;
  const perpendicularY = unitX;
  const halfWidth = ARROW_WIDTH / 2;

  return {
    linePoints: [...points.slice(0, -1), base],
    arrowPoints: [
      tip,
      {
        x: base.x + perpendicularX * halfWidth,
        y: base.y + perpendicularY * halfWidth,
      },
      {
        x: base.x - perpendicularX * halfWidth,
        y: base.y - perpendicularY * halfWidth,
      },
    ],
  };
}

export function App() {
  const canvasRef = useRef<InfiniteCanvasHandle>(null);
  const dragRef = useRef<DragState | null>(null);
  const [nodes, setNodes] = useState<Node[]>(initialNodes);

  const edgeRoute = routeEdges({
    nodes,
    edges: edgeInputs,
    lanes: [{ id: 'main', order: 0 }],
  });
  const routedEdges = edgeRoute.ok ? edgeRoute.result.edges : [];
  const arrowRenderPoints = routedEdges
    .map((edge) => ({ id: edge.id, points: getArrowRenderPoints(edge.points) }))
    .filter((edge): edge is { id: string; points: NonNullable<ReturnType<typeof getArrowRenderPoints>> } =>
      Boolean(edge.points),
    );

  const handleNodePointerDown = (event: PointerEvent<HTMLDivElement>, node: Node) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      nodeId: node.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startNodeX: node.x,
      startNodeY: node.y,
    };
  };

  const handleNodePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const zoom = canvasRef.current?.getCamera().zoom ?? 1;
    const nextX = drag.startNodeX + (event.clientX - drag.startClientX) / zoom;
    const nextY = drag.startNodeY + (event.clientY - drag.startClientY) / zoom;

    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === drag.nodeId ? { ...node, x: nextX, y: nextY } : node,
      ),
    );
  };

  const handleNodePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <InfiniteCanvas
      ref={canvasRef}
      className="canvas"
      controls={{ toolbar: true }}
      ignorePanSelector=".node-box"
    >
      <svg className="edge-layer" aria-hidden="true">
        {arrowRenderPoints.map(({ id, points }) => (
          <g key={id}>
            <path className="edge-line" d={getRoundedPath(points.linePoints)} />
            <polygon
              className="edge-arrow"
              points={points.arrowPoints.map((point) => `${point.x},${point.y}`).join(' ')}
            />
          </g>
        ))}
      </svg>
      {nodes.map((node) => (
        <div
          key={node.id}
          className="node-box"
          style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
          onPointerDown={(event) => handleNodePointerDown(event, node)}
          onPointerMove={handleNodePointerMove}
          onPointerUp={handleNodePointerUp}
          onPointerCancel={handleNodePointerUp}
        >
          {node.label}
        </div>
      ))}
    </InfiniteCanvas>
  );
}
