import { useEffect, useMemo, useRef, useState } from 'react';
import { InfiniteCanvas, type InfiniteCanvasHandle } from '@slicr/react-ui';
import { layout, type EdgeInput, type LaneInput, type NodeInput } from 'layout-lib';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 86;

const ARROW_LENGTH = 18;
const ARROW_WIDTH = 16;

const laneIdForOrder = (order: number) => `lane-${order}`;

const initialLane: LaneInput = { id: laneIdForOrder(0), order: 0 };

type NodeType = 'ui' | 'cmd' | 'evt' | 'rm';

type GraphNode = Required<Pick<NodeInput, 'width' | 'height'>> &
  Pick<NodeInput, 'id' | 'laneId'> & {
    label: string;
    type: NodeType;
  };

type RenderNode = GraphNode & {
  x: number;
  y: number;
};

type AddDirection = 'top' | 'right' | 'bottom';

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

function getLaneOrder(lanes: LaneInput[], laneId: string) {
  return lanes.find((lane) => lane.id === laneId)?.order ?? 0;
}

function ensureLane(lanes: LaneInput[], order: number) {
  if (lanes.some((lane) => lane.order === order)) {
    return lanes;
  }

  return [...lanes, { id: laneIdForOrder(order), order }];
}

function getSuccessorNodeType(sourceType: NodeType, direction: AddDirection): NodeType {
  if (sourceType === 'ui' && direction === 'bottom') {
    return 'cmd';
  }
  if (sourceType === 'cmd' && direction === 'bottom') {
    return 'evt';
  }
  if (sourceType === 'evt' && direction === 'top') {
    return 'rm';
  }
  if (sourceType === 'rm' && direction === 'top') {
    return 'ui';
  }

  return sourceType;
}

function getKeyboardSuccessorDirection(sourceType: NodeType): AddDirection {
  return sourceType === 'ui' || sourceType === 'cmd' ? 'bottom' : 'top';
}

function getKeyboardSuccessorNodeType(sourceType: NodeType): NodeType {
  if (sourceType === 'ui') {
    return 'cmd';
  }
  if (sourceType === 'cmd') {
    return 'evt';
  }
  if (sourceType === 'evt') {
    return 'rm';
  }

  return 'ui';
}

export function App() {
  const canvasRef = useRef<InfiniteCanvasHandle>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const skipBlurSaveRef = useRef(false);
  const cancelEditRef = useRef(false);
  const [nodes, setNodes] = useState<GraphNode[]>([
    {
      id: 'node-1',
      label: 'Node 1',
      type: 'ui',
      laneId: initialLane.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    },
  ]);
  const [edges, setEdges] = useState<EdgeInput[]>([]);
  const [lanes, setLanes] = useState<LaneInput[]>([initialLane]);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>('node-1');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [originalLabel, setOriginalLabel] = useState('');
  const [openNodeMenuId, setOpenNodeMenuId] = useState<string | null>(null);

  const layoutResult = useMemo(
    () =>
      layout({
        nodes,
        edges,
        lanes,
        defaults: { nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT },
        spacing: { laneMargin: 0, laneGap: 100, minTargetShift: 15, minNodeGap: 10 },
      }),
    [edges, lanes, nodes],
  );

  const renderedNodes: RenderNode[] = useMemo(() => {
    if (!layoutResult.ok) {
      return [];
    }

    const inputNodeById = new Map(nodes.map((node) => [node.id, node]));
    return layoutResult.result.nodes.flatMap((nodeLayout) => {
      const node = inputNodeById.get(nodeLayout.id);
      if (!node) {
        return [];
      }

      return [{ ...node, ...nodeLayout }];
    });
  }, [layoutResult, nodes]);

  const arrowRenderPoints = layoutResult.ok
    ? layoutResult.result.edges
        .map((edge) => ({ id: edge.id, points: getArrowRenderPoints(edge.points) }))
        .filter((edge): edge is { id: string; points: NonNullable<ReturnType<typeof getArrowRenderPoints>> } =>
          Boolean(edge.points),
        )
    : [];

  useEffect(() => {
    const positionCameraAtInitialMargin = () => {
      canvasRef.current?.setCamera({
        x: 100,
        y: 100,
        zoom: 1,
      });
    };

    positionCameraAtInitialMargin();
  }, []);

  const addConnectedNode = (sourceNode: GraphNode, direction: AddDirection, typeOverride?: NodeType) => {
    const sourceLaneOrder = getLaneOrder(lanes, sourceNode.laneId);
    const targetLaneOrder =
      direction === 'top' ? sourceLaneOrder - 1 : direction === 'bottom' ? sourceLaneOrder + 1 : sourceLaneOrder;
    const targetLaneId = laneIdForOrder(targetLaneOrder);
    const targetType = typeOverride ?? getSuccessorNodeType(sourceNode.type, direction);
    const newNodeNumber = Math.max(0, ...nodes.map((node) => Number(node.id.replace('node-', '')) || 0)) + 1;
    const newNodeId = `node-${newNodeNumber}`;

    setLanes((currentLanes) => ensureLane(currentLanes, targetLaneOrder));
    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id: newNodeId,
        label: `Node ${newNodeNumber}`,
        type: targetType,
        laneId: targetLaneId,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      },
    ]);
    setEdges((currentEdges) => [
      ...currentEdges,
      { id: `edge-${sourceNode.id}-${newNodeId}`, sourceId: sourceNode.id, targetId: newNodeId },
    ]);
    setFocusedNodeId(newNodeId);
    skipBlurSaveRef.current = false;
    cancelEditRef.current = false;
    setEditingNodeId(newNodeId);
    setDraftLabel(`Node ${newNodeNumber}`);
    setOriginalLabel(`Node ${newNodeNumber}`);
  };

  const deleteNode = (nodeId: string) => {
    const predecessorNodeId = edges.find((edge) => edge.targetId === nodeId)?.sourceId ?? null;

    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
    setEdges((currentEdges) =>
      currentEdges.filter((edge) => edge.sourceId !== nodeId && edge.targetId !== nodeId),
    );
    if (editingNodeId === nodeId) {
      setEditingNodeId(null);
      setDraftLabel('');
      setOriginalLabel('');
    }
    if (openNodeMenuId === nodeId) {
      setOpenNodeMenuId(null);
    }
    if (focusedNodeId === nodeId) {
      setFocusedNodeId(predecessorNodeId);
    }
  };

  const setNodeType = (nodeId: string, type: NodeType) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => (node.id === nodeId ? { ...node, type } : node)),
    );
    setOpenNodeMenuId(null);
  };

  const startEditingNode = (node: GraphNode) => {
    skipBlurSaveRef.current = false;
    cancelEditRef.current = false;
    setFocusedNodeId(node.id);
    setEditingNodeId(node.id);
    setDraftLabel(node.label);
    setOriginalLabel(node.label);
  };

  const saveEditingNode = () => {
    if (!editingNodeId || cancelEditRef.current) {
      return;
    }

    const nextLabel = draftLabel.trim() || 'Untitled';
    setNodes((currentNodes) =>
      currentNodes.map((node) => (node.id === editingNodeId ? { ...node, label: nextLabel } : node)),
    );
    cancelEditRef.current = false;
    setEditingNodeId(null);
    setDraftLabel('');
    setOriginalLabel('');
  };

  const cancelEditingNode = () => {
    cancelEditRef.current = true;
    if (editingNodeId) {
      setNodes((currentNodes) =>
        currentNodes.map((node) => (node.id === editingNodeId ? { ...node, label: originalLabel } : node)),
      );
    }
    setEditingNodeId(null);
    setDraftLabel('');
    setOriginalLabel('');
  };

  useEffect(() => {
    if (!editingNodeId) {
      return;
    }

    const saveWhenClickingOutsideTextBox = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.node-label-input')) {
        return;
      }

      skipBlurSaveRef.current = true;
      saveEditingNode();
    };

    document.addEventListener('pointerdown', saveWhenClickingOutsideTextBox, { capture: true });
    return () => document.removeEventListener('pointerdown', saveWhenClickingOutsideTextBox, { capture: true });
  }, [draftLabel, editingNodeId]);

  useEffect(() => {
    const navigateFocusedNode = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest('.node-label-input')) {
        return;
      }
      if (!focusedNodeId) {
        return;
      }

      if (event.key === 'Enter') {
        const focusedNode = nodes.find((node) => node.id === focusedNodeId);
        if (focusedNode) {
          event.preventDefault();
          setOpenNodeMenuId(null);
          if (event.ctrlKey || event.metaKey) {
            addConnectedNode(
              focusedNode,
              getKeyboardSuccessorDirection(focusedNode.type),
              getKeyboardSuccessorNodeType(focusedNode.type),
            );
          } else {
            startEditingNode(focusedNode);
          }
        }
        return;
      }

      if (event.key === 'Backspace' && event.metaKey) {
        event.preventDefault();
        deleteNode(focusedNodeId);
        return;
      }

      if (event.key === 'ArrowLeft') {
        const predecessorEdge = edges.find((edge) => edge.targetId === focusedNodeId);
        if (predecessorEdge) {
          event.preventDefault();
          setFocusedNodeId(predecessorEdge.sourceId);
          setOpenNodeMenuId(null);
        }
      }

      if (event.key === 'ArrowRight') {
        const successorEdge = edges.find((edge) => edge.sourceId === focusedNodeId);
        if (successorEdge) {
          event.preventDefault();
          setFocusedNodeId(successorEdge.targetId);
          setOpenNodeMenuId(null);
        }
      }
    };

    window.addEventListener('keydown', navigateFocusedNode);
    return () => window.removeEventListener('keydown', navigateFocusedNode);
  }, [edges, focusedNodeId, lanes, nodes]);

  return (
    <InfiniteCanvas
      ref={canvasRef}
      className="canvas"
      controls={{ toolbar: true }}
      viewportRef={viewportRef}
      ignorePanSelector=".node-box, .node-add-button, .node-menu-button, .node-menu, .node-label-input"
      onCanvasPointerDown={(event) => {
        if (event.target instanceof Element && !event.target.closest('.node-box')) {
          setFocusedNodeId(null);
          setOpenNodeMenuId(null);
        }
      }}
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
      {renderedNodes.map((node) => {
        const isFocused = focusedNodeId === node.id;

        return (
        <div
          key={node.id}
          className={`node-box node-type-${node.type}${isFocused ? ' node-focused' : ''}`}
          style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
          onClick={() => {
            setFocusedNodeId(node.id);
            if (openNodeMenuId !== node.id) {
              setOpenNodeMenuId(null);
            }
          }}
        >
          {isFocused ? (
            <button
              type="button"
              className={`node-add-button node-add-button-top node-add-button-${getSuccessorNodeType(node.type, 'top')}`}
              aria-label={`Add node above ${node.label}`}
              onClick={(event) => {
                event.stopPropagation();
                addConnectedNode(node, 'top');
              }}
            >
              +
            </button>
          ) : null}
          {editingNodeId === node.id ? (
            <input
              className="node-label-input"
              value={draftLabel}
              autoFocus
              aria-label={`Edit ${node.label} label`}
              onChange={(event) => setDraftLabel(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={() => {
                if (skipBlurSaveRef.current) {
                  skipBlurSaveRef.current = false;
                  cancelEditRef.current = false;
                  return;
                }

                if (document.activeElement === document.body) {
                  cancelEditingNode();
                  return;
                }

                saveEditingNode();
              }}
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  saveEditingNode();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  skipBlurSaveRef.current = true;
                  cancelEditingNode();
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="node-label-button"
              title="Double-click to edit"
              onDoubleClick={(event) => {
                event.stopPropagation();
                startEditingNode(node);
              }}
            >
              {node.label}
            </button>
          )}
          {isFocused ? (
            <button
              type="button"
              className="node-menu-button"
              aria-label={`Open ${node.label} options`}
              aria-expanded={openNodeMenuId === node.id}
              onClick={(event) => {
                event.stopPropagation();
                setOpenNodeMenuId((currentId) => (currentId === node.id ? null : node.id));
              }}
            >
              ⚙️
            </button>
          ) : null}
          {isFocused && openNodeMenuId === node.id ? (
            <div className="node-menu" role="menu" aria-label={`${node.label} options`}>
              <button type="button" role="menuitem" onClick={() => setNodeType(node.id, 'ui')}>
                To UI
              </button>
              <button type="button" role="menuitem" onClick={() => setNodeType(node.id, 'cmd')}>
                To Command
              </button>
              <button type="button" role="menuitem" onClick={() => setNodeType(node.id, 'evt')}>
                To Event
              </button>
              <button type="button" role="menuitem" onClick={() => setNodeType(node.id, 'rm')}>
                To Read Model
              </button>
              <button
                type="button"
                role="menuitem"
                className="node-menu-delete"
                onClick={() => deleteNode(node.id)}
              >
                🗑️ Delete
              </button>
            </div>
          ) : null}
          {isFocused ? (
            <button
              type="button"
              className={`node-add-button node-add-button-right node-add-button-${getSuccessorNodeType(node.type, 'right')}`}
              aria-label={`Add node to the right of ${node.label}`}
              onClick={(event) => {
                event.stopPropagation();
                addConnectedNode(node, 'right');
              }}
            >
              +
            </button>
          ) : null}
          {isFocused ? (
            <button
              type="button"
              className={`node-add-button node-add-button-bottom node-add-button-${getSuccessorNodeType(node.type, 'bottom')}`}
              aria-label={`Add node below ${node.label}`}
              onClick={(event) => {
                event.stopPropagation();
                addConnectedNode(node, 'bottom');
              }}
            >
              +
            </button>
          ) : null}
        </div>
        );
      })}
      {!layoutResult.ok ? <div className="layout-error">{layoutResult.error.message}</div> : null}
    </InfiniteCanvas>
  );
}
