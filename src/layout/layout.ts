import type {
  AnchorPoint,
  AnchorSide,
  EdgeInput,
  EdgeLayout,
  GroupLayout,
  LayoutApi,
  LayoutFailure,
  LaneLayout,
  NodeInput,
  NodeLayout,
  Point,
} from "./types";

const EDGE_STUB = 20;
const COLUMN_GAP = EDGE_STUB * 2;
const VERTICAL_SOURCE_BIAS = 10;
const VERTICAL_TARGET_BIAS = -10;
const HORIZONTAL_SOURCE_BIAS = 5;
const HORIZONTAL_TARGET_BIAS = -5;
const VERTICAL_ANCHOR_SPACING = 10;
const HORIZONTAL_ANCHOR_SPACING = 10;

type EdgeOrientation = "side" | "up" | "down";
type AnchorRole = "source" | "target";

type EdgeSideAssignment = {
  source: AnchorSide;
  target: AnchorSide;
};

export const layout: LayoutApi = (request) => {
  const laneById = new Map(request.lanes.map((lane) => [lane.id, lane]));
  const laneOrderCounts = new Set<number>();
  for (const lane of request.lanes) {
    if (laneOrderCounts.has(lane.order)) {
      return failure("InvalidReference", `Duplicate lane order ${lane.order}.`, { laneId: lane.id });
    }
    laneOrderCounts.add(lane.order);
  }

  const nodeById = new Map(request.nodes.map((node) => [node.id, node]));
  const groupById = request.groups ? new Map(request.groups.map((group) => [group.id, group])) : null;
  for (const node of request.nodes) {
    if (!laneById.has(node.laneId)) {
      return failure("InvalidReference", `Node ${node.id} references missing lane ${node.laneId}.`, { nodeId: node.id, laneId: node.laneId });
    }
    if (groupById && !node.groupId) {
      return failure("MissingGroupAssignment", `Node ${node.id} is missing a group assignment.`, { nodeId: node.id });
    }
    if (node.groupId && !groupById?.has(node.groupId)) {
      return failure("InvalidReference", `Node ${node.id} references missing group ${node.groupId}.`, { nodeId: node.id, groupId: node.groupId });
    }
  }

  if (groupById) {
    const groupOrderCounts = new Set<number>();
    for (const group of request.groups ?? []) {
      if (groupOrderCounts.has(group.order)) {
        return failure("InvalidReference", `Duplicate group order ${group.order}.`, { groupId: group.id });
      }
      groupOrderCounts.add(group.order);
    }
  }

  for (const edge of request.edges) {
    if (!nodeById.has(edge.sourceId) || !nodeById.has(edge.targetId)) {
      return failure("InvalidReference", `Edge ${edge.id} references a missing node.`, { edgeId: edge.id });
    }
  }

  const { topoOrder, hasCycle } = topologicalSort(request.nodes, request.edges);
  if (hasCycle) {
    return failure("CycleDetected", "Cycles are not supported.");
  }

  const orderedLanes = [...request.lanes].sort((left, right) => left.order - right.order);
  const laneMargin = request.spacing?.laneMargin ?? 24;
  const laneGap = request.spacing?.laneGap ?? 44;
  const laneNodeHeightById = new Map<string, number>(
    orderedLanes.map((lane) => [
      lane.id,
      Math.max(
        request.defaults.nodeHeight,
        ...request.nodes.filter((node) => node.laneId === lane.id).map((node) => node.height ?? request.defaults.nodeHeight),
      ),
    ]),
  );
  let laneCursor = -laneMargin;
  const laneLayouts: LaneLayout[] = orderedLanes.map((lane) => {
    const laneHeight = (laneNodeHeightById.get(lane.id) ?? request.defaults.nodeHeight) + laneMargin * 2;
    const laneLayout = {
      id: lane.id,
      top: laneCursor,
      bottom: laneCursor + laneHeight,
    };
    laneCursor = laneLayout.bottom + laneGap;
    return laneLayout;
  });
  const laneTopById = new Map(laneLayouts.map((lane) => [lane.id, lane.top]));
  const laneOrderById = new Map(request.lanes.map((lane) => [lane.id, lane.order]));

  const widthByNode = new Map(
    request.nodes.map((node) => [node.id, node.width ?? request.defaults.nodeWidth]),
  );
  const heightByNode = new Map(
    request.nodes.map((node) => [node.id, node.height ?? request.defaults.nodeHeight]),
  );

  const predecessors = new Map<string, EdgeInput[]>();
  request.nodes.forEach((node) => predecessors.set(node.id, []));
  request.edges.forEach((edge) => predecessors.get(edge.targetId)?.push(edge));
  const incomingCountByNode = new Map<string, number>();
  request.nodes.forEach((node) => incomingCountByNode.set(node.id, 0));
  request.edges.forEach((edge) => {
    incomingCountByNode.set(edge.targetId, (incomingCountByNode.get(edge.targetId) ?? 0) + 1);
  });

  const minTargetShift = request.spacing?.minTargetShift ?? 20;
  const minNodeGap = request.spacing?.minNodeGap ?? 40;
  const groupGap = request.spacing?.groupGap ?? 80;
  const columnStep = minTargetShift + minNodeGap + COLUMN_GAP;

  const xByNode = new Map<string, number>(request.nodes.map((node) => [node.id, 0]));
  const rawBaseXByNode = new Map<string, number>();

  const nodesByLane = new Map<string, NodeInput[]>();
  for (const node of request.nodes) {
    const bucket = nodesByLane.get(node.laneId) ?? [];
    bucket.push(node);
    nodesByLane.set(node.laneId, bucket);
  }

  const topoIndexById = new Map(topoOrder.map((nodeId, index) => [nodeId, index]));

  for (const nodeId of topoOrder) {
    let nextX = 0;
    for (const edge of predecessors.get(nodeId) ?? []) {
      const sourceX = rawBaseXByNode.get(edge.sourceId) ?? 0;
      nextX = Math.max(nextX, sourceX + columnStep);
    }
    rawBaseXByNode.set(nodeId, nextX);
  }

  let changed = true;
  let iterations = 0;
  const maxIterations = request.nodes.length * request.nodes.length + request.edges.length + 1;
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations += 1;

    for (const nodeId of topoOrder) {
      let nextX = xByNode.get(nodeId) ?? 0;
      for (const edge of predecessors.get(nodeId) ?? []) {
        const sourceX = xByNode.get(edge.sourceId) ?? 0;
        nextX = Math.max(
          nextX,
          computeEdgeConstraintX({
            edge,
            sourceX,
            targetId: nodeId,
            laneOrderById,
            nodeById,
            widthByNode,
            incomingCountByNode,
            rawBaseXByNode,
            topoIndexById,
            minTargetShift,
            columnStep,
          }),
        );
      }
      if (nextX !== (xByNode.get(nodeId) ?? 0)) {
        xByNode.set(nodeId, nextX);
        changed = true;
      }
    }

    for (const laneNodes of nodesByLane.values()) {
      laneNodes.sort((left, right) => {
        const leftX = xByNode.get(left.id) ?? 0;
        const rightX = xByNode.get(right.id) ?? 0;
        if (leftX !== rightX) {
          return leftX - rightX;
        }
        return (topoIndexById.get(left.id) ?? 0) - (topoIndexById.get(right.id) ?? 0);
      });

      let cursor = 0;
      for (const node of laneNodes) {
        const resolvedX = Math.max(xByNode.get(node.id) ?? 0, cursor);
        if (resolvedX !== (xByNode.get(node.id) ?? 0)) {
          xByNode.set(node.id, resolvedX);
          changed = true;
        }
        cursor = resolvedX + (widthByNode.get(node.id) ?? request.defaults.nodeWidth) + minNodeGap;
      }
    }
  }

  let groupLayouts: GroupLayout[] | undefined;
  if (request.groups && request.groups.length > 0) {
    const orderedGroups = [...request.groups].sort((left, right) => left.order - right.order);
    const nodeIdsByGroup = new Map<string, string[]>();
    for (const node of request.nodes) {
      if (!node.groupId) {
        continue;
      }
      const bucket = nodeIdsByGroup.get(node.groupId) ?? [];
      bucket.push(node.id);
      nodeIdsByGroup.set(node.groupId, bucket);
    }

    const groupFlow = new Map<string, Set<string>>();
    for (const edge of request.edges) {
      const sourceGroupId = nodeById.get(edge.sourceId)?.groupId;
      const targetGroupId = nodeById.get(edge.targetId)?.groupId;
      if (!sourceGroupId || !targetGroupId || sourceGroupId === targetGroupId) {
        continue;
      }
      const outgoing = groupFlow.get(sourceGroupId) ?? new Set<string>();
      outgoing.add(targetGroupId);
      groupFlow.set(sourceGroupId, outgoing);
      if (groupFlow.get(targetGroupId)?.has(sourceGroupId)) {
        return failure("BidirectionalGroupFlow", `Groups ${sourceGroupId} and ${targetGroupId} have bidirectional flow.`, {
          leftGroupId: sourceGroupId,
          rightGroupId: targetGroupId,
        });
      }
    }

    let minGroupLeft = 0;
    for (const group of orderedGroups) {
      const nodeIds = nodeIdsByGroup.get(group.id) ?? [];
      if (nodeIds.length === 0) {
        continue;
      }
      const currentLeft = Math.min(...nodeIds.map((nodeId) => xByNode.get(nodeId) ?? 0));
      const shift = Math.max(0, minGroupLeft - currentLeft);
      if (shift > 0) {
        for (const nodeId of nodeIds) {
          xByNode.set(nodeId, (xByNode.get(nodeId) ?? 0) + shift);
        }
      }
      const resolvedRight = Math.max(
        ...nodeIds.map((nodeId) => (xByNode.get(nodeId) ?? 0) + (widthByNode.get(nodeId) ?? request.defaults.nodeWidth)),
      );
      minGroupLeft = resolvedRight + groupGap;
    }
  }

  const nodeLayouts: NodeLayout[] = request.nodes.map((node) => ({
    id: node.id,
    x: xByNode.get(node.id) ?? 0,
    y: (laneTopById.get(node.laneId) ?? 0) + laneMargin,
    width: widthByNode.get(node.id) ?? request.defaults.nodeWidth,
    height: heightByNode.get(node.id) ?? request.defaults.nodeHeight,
  }));
  if (request.groups && request.groups.length > 0) {
    const nodesByGroup = new Map<string, NodeLayout[]>();
    for (const node of nodeLayouts) {
      const groupId = nodeById.get(node.id)?.groupId;
      if (!groupId) {
        continue;
      }
      const bucket = nodesByGroup.get(groupId) ?? [];
      bucket.push(node);
      nodesByGroup.set(groupId, bucket);
    }
    groupLayouts = [...request.groups]
      .sort((left, right) => left.order - right.order)
      .flatMap((group) => {
        const groupNodes = nodesByGroup.get(group.id) ?? [];
        if (groupNodes.length === 0) {
          return [];
        }
        const left = Math.min(...groupNodes.map((node) => node.x));
        const top = Math.min(...groupNodes.map((node) => node.y));
        const right = Math.max(...groupNodes.map((node) => node.x + node.width));
        const bottom = Math.max(...groupNodes.map((node) => node.y + node.height));
        return [{ id: group.id, x: left, y: top, width: right - left, height: bottom - top }];
      });
  }
  const nodeLayoutById = new Map(nodeLayouts.map((node) => [node.id, node]));

  const sideAssignments = new Map<string, EdgeSideAssignment>();
  const sourceOrdinalByEdgeId = new Map<string, number>();
  const targetOrdinalByEdgeId = new Map<string, number>();
  const sourceCountByEdgeId = new Map<string, number>();
  const targetCountByEdgeId = new Map<string, number>();
  const anchorUsage = new Map<string, number>();
  const anchorTotals = new Map<string, number>();

  for (const edge of request.edges) {
    const sourceNode = nodeById.get(edge.sourceId);
    const targetNode = nodeById.get(edge.targetId);
    if (!sourceNode || !targetNode) {
      return failure("InvalidReference", `Edge ${edge.id} references a missing node.`, { edgeId: edge.id });
    }
    const orientation = deriveOrientation(
      laneOrderById.get(sourceNode.laneId) ?? 0,
      laneOrderById.get(targetNode.laneId) ?? 0,
    );
    const sides = sideAssignmentForOrientation(orientation);
    sideAssignments.set(edge.id, sides);
    incrementTotal(anchorTotals, edge.sourceId, sides.source, "source");
    incrementTotal(anchorTotals, edge.targetId, sides.target, "target");
    sourceOrdinalByEdgeId.set(edge.id, nextOrdinal(anchorUsage, edge.sourceId, sides.source, "source"));
    targetOrdinalByEdgeId.set(edge.id, nextOrdinal(anchorUsage, edge.targetId, sides.target, "target"));
  }

  for (const edge of request.edges) {
    const sides = sideAssignments.get(edge.id);
    if (!sides) {
      continue;
    }
    sourceCountByEdgeId.set(edge.id, getTotal(anchorTotals, edge.sourceId, sides.source, "source"));
    targetCountByEdgeId.set(edge.id, getTotal(anchorTotals, edge.targetId, sides.target, "target"));
  }

  const edges: EdgeLayout[] = request.edges.map((edge) => {
    const nodeSource = nodeLayoutById.get(edge.sourceId);
    const nodeTarget = nodeLayoutById.get(edge.targetId);
    const sides = sideAssignments.get(edge.id);
    if (!nodeSource || !nodeTarget || !sides) {
      throw new Error(`Incomplete edge state for ${edge.id}.`);
    }

    const sourceAnchor = createAnchor(nodeSource, sides.source, sourceOrdinalByEdgeId.get(edge.id) ?? 0, "source");
    const targetAnchor = createAnchor(nodeTarget, sides.target, targetOrdinalByEdgeId.get(edge.id) ?? 0, "target");

    return {
      id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        sourceAnchor,
        targetAnchor,
        points: routeOrthogonalEdge(
          sourceAnchor,
          targetAnchor,
          sourceCountByEdgeId.get(edge.id) ?? 1,
          targetCountByEdgeId.get(edge.id) ?? 1,
        ),
      };
  });

  return {
    ok: true,
    result: {
      lanes: laneLayouts,
      groups: groupLayouts,
      nodes: nodeLayouts,
      edges,
    },
  };
};

function failure(type: LayoutFailure["type"], message: string, details?: unknown) {
  return {
    ok: false as const,
    error: {
      type,
      message,
      details,
    },
  };
}

function topologicalSort(nodes: NodeInput[], edges: EdgeInput[]) {
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));

  for (const edge of edges) {
    outgoing.get(edge.sourceId)?.push(edge.targetId);
    indegree.set(edge.targetId, (indegree.get(edge.targetId) ?? 0) + 1);
  }

  const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const topoOrder: string[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) {
      break;
    }
    topoOrder.push(nodeId);
    for (const nextId of outgoing.get(nodeId) ?? []) {
      const nextIndegree = (indegree.get(nextId) ?? 0) - 1;
      indegree.set(nextId, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(nextId);
      }
    }
  }

  return { topoOrder, hasCycle: topoOrder.length !== nodes.length };
}

function deriveOrientation(sourceLaneOrder: number, targetLaneOrder: number): EdgeOrientation {
  if (targetLaneOrder === sourceLaneOrder) {
    return "side";
  }
  return targetLaneOrder < sourceLaneOrder ? "up" : "down";
}

function sideAssignmentForOrientation(orientation: EdgeOrientation): EdgeSideAssignment {
  if (orientation === "side") {
    return { source: "right", target: "left" };
  }
  if (orientation === "up") {
    return { source: "top", target: "left" };
  }
  return { source: "bottom", target: "top" };
}

function nextOrdinal(
  usage: Map<string, number>,
  nodeId: string,
  side: AnchorSide,
  role: AnchorRole,
) {
  const key = `${nodeId}:${side}:${role}`;
  const ordinal = usage.get(key) ?? 0;
  usage.set(key, ordinal + 1);
  return ordinal;
}

function incrementTotal(
  totals: Map<string, number>,
  nodeId: string,
  side: AnchorSide,
  role: AnchorRole,
) {
  const key = `${nodeId}:${side}:${role}`;
  totals.set(key, (totals.get(key) ?? 0) + 1);
}

function getTotal(
  totals: Map<string, number>,
  nodeId: string,
  side: AnchorSide,
  role: AnchorRole,
) {
  return totals.get(`${nodeId}:${side}:${role}`) ?? 0;
}

function createAnchor(node: NodeLayout, side: AnchorSide, ordinal: number, role: AnchorRole): AnchorPoint {
  if (side === "top" || side === "bottom") {
    const bias = role === "source" ? VERTICAL_SOURCE_BIAS : VERTICAL_TARGET_BIAS;
    return {
      x: node.x + node.width / 2 + bias + ordinal * VERTICAL_ANCHOR_SPACING,
      y: side === "top" ? node.y : node.y + node.height,
      side,
      ordinal,
    };
  }

  const bias = role === "source" ? HORIZONTAL_SOURCE_BIAS : HORIZONTAL_TARGET_BIAS;
  return {
    x: side === "left" ? node.x : node.x + node.width,
    y: node.y + node.height / 2 + bias + ordinal * HORIZONTAL_ANCHOR_SPACING,
    side,
    ordinal,
  };
}

function computeEdgeConstraintX(params: {
  edge: EdgeInput;
  sourceX: number;
  targetId: string;
  laneOrderById: Map<string, number>;
  nodeById: Map<string, NodeInput>;
  widthByNode: Map<string, number>;
  incomingCountByNode: Map<string, number>;
  rawBaseXByNode: Map<string, number>;
  topoIndexById: Map<string, number>;
  minTargetShift: number;
  columnStep: number;
}) {
  const {
    edge,
    sourceX,
    targetId,
    laneOrderById,
    nodeById,
    widthByNode,
    incomingCountByNode,
    rawBaseXByNode,
    topoIndexById,
    minTargetShift,
    columnStep,
  } = params;

  const sourceNode = nodeById.get(edge.sourceId);
  const targetNode = nodeById.get(targetId);
  if (!sourceNode || !targetNode) {
    return sourceX + columnStep;
  }

  const orientation = deriveOrientation(
    laneOrderById.get(sourceNode.laneId) ?? 0,
    laneOrderById.get(targetNode.laneId) ?? 0,
  );

  if (orientation === "down") {
    const targetTopOffset = (widthByNode.get(targetId) ?? 0) / 2 + VERTICAL_TARGET_BIAS;
    const entryPadding = (incomingCountByNode.get(edge.sourceId) ?? 0) === 0 ? 10 : 0;
    return sourceX + (widthByNode.get(edge.sourceId) ?? 0) + minTargetShift - targetTopOffset + entryPadding;
  }

  if (orientation === "up") {
    let nextX = sourceX + columnStep;
    const sourceWasShifted = sourceX > (rawBaseXByNode.get(edge.sourceId) ?? 0);
    const sourceHasIncoming = (incomingCountByNode.get(edge.sourceId) ?? 0) > 0;
    const staysWithinExplicitGroup =
      sourceNode.groupId !== undefined &&
      sourceNode.groupId === targetNode.groupId;
    const targetHasEarlierLanePeer =
      sourceNode.laneId !== targetNode.laneId &&
      [...topoIndexById.entries()].some(([nodeId, index]) => {
        const candidate = nodeById.get(nodeId);
        return (
          candidate?.laneId === targetNode.laneId &&
          index < (topoIndexById.get(targetId) ?? 0)
        );
      });
    if (!staysWithinExplicitGroup && sourceHasIncoming && sourceWasShifted && targetHasEarlierLanePeer) {
      nextX = Math.max(nextX, sourceX + (widthByNode.get(edge.sourceId) ?? 0) + 10);
    }
    return nextX;
  }

  return sourceX + columnStep;
}

function routeOrthogonalEdge(
  sourceAnchor: AnchorPoint,
  targetAnchor: AnchorPoint,
  sourceSideCount: number,
  _targetSideCount: number,
): Point[] {
  const sourceStub = offsetFromAnchor(sourceAnchor, getSourceStubDistance(sourceAnchor, sourceSideCount));
  const targetApproach = getTargetApproachPoint(sourceStub, targetAnchor);
  return [
    { x: sourceAnchor.x, y: sourceAnchor.y },
    sourceStub,
    targetApproach,
    { x: targetAnchor.x, y: targetAnchor.y },
  ];
}

function getSourceStubDistance(sourceAnchor: AnchorPoint, sourceSideCount: number) {
  if (sourceAnchor.side === "bottom" && sourceSideCount > 1) {
    return EDGE_STUB + (sourceSideCount - 1 - sourceAnchor.ordinal) * 10;
  }
  return EDGE_STUB;
}

function offsetFromAnchor(anchor: AnchorPoint, distance: number): Point {
  const vector = anchorSideVector(anchor.side);
  return {
    x: anchor.x + vector.x * distance,
    y: anchor.y + vector.y * distance,
  };
}

function getTargetApproachPoint(referencePoint: Point, targetAnchor: AnchorPoint): Point {
  if (targetAnchor.side === "left" || targetAnchor.side === "right") {
    return { x: referencePoint.x, y: targetAnchor.y };
  }
  return { x: targetAnchor.x, y: referencePoint.y };
}

function anchorSideVector(side: AnchorSide): Point {
  if (side === "top") {
    return { x: 0, y: -1 };
  }
  if (side === "right") {
    return { x: 1, y: 0 };
  }
  if (side === "bottom") {
    return { x: 0, y: 1 };
  }
  return { x: -1, y: 0 };
}
