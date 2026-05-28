import type {
  AnchorPoint,
  AnchorSide,
  EdgeInput,
  EdgeLayout,
  GroupLayout,
  LaneLayout,
  LayoutApi,
  LayoutFailure,
  NodeInput,
  NodeLayout,
  Point,
} from "./types";

const EDGE_STUB = 20;
const COLUMN_GAP = EDGE_STUB * 2;
const VERTICAL_SOURCE_BIAS = 10;
const VERTICAL_TARGET_BIAS = -10;
const VERTICAL_ANCHOR_SPACING = 10;
const HORIZONTAL_ANCHOR_SPACING = 10;
const UPWARD_REROUTE_ENTRY_OFFSET = 2;
const UPWARD_REROUTE_SPACING = 10;

type EdgeOrientation = "side" | "up" | "down";
type AnchorRole = "source" | "target";

type EdgeSideAssignment = {
  source: AnchorSide;
  target: AnchorSide;
};

type UpwardDetourPlan = {
  targetAnchorY?: number;
  detourRowY?: number;
  downRowY?: number;
  upRowY?: number;
};

type NeighborPosition = {
  nodeId: string;
  position: number;
};

type LaneOrderEntry = {
  node: NodeInput;
  originalIndex: number;
  barycenter: number | null;
};

export const compactLayout: LayoutApi = (request) => {
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

  const dependencyEdges = request.edges.filter((edge) => !isBackReferenceEdge(edge));
  const { topoOrder, hasCycle } = topologicalSort(request.nodes, dependencyEdges);
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
  const successors = new Map<string, EdgeInput[]>();
  request.nodes.forEach((node) => {
    predecessors.set(node.id, []);
    successors.set(node.id, []);
  });
  dependencyEdges.forEach((edge) => {
    predecessors.get(edge.targetId)?.push(edge);
    successors.get(edge.sourceId)?.push(edge);
  });
  const incomingCountByNode = new Map<string, number>();
  request.nodes.forEach((node) => incomingCountByNode.set(node.id, 0));
  dependencyEdges.forEach((edge) => {
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
  for (const laneNodes of nodesByLane.values()) {
    laneNodes.sort((left, right) => (topoIndexById.get(left.id) ?? 0) - (topoIndexById.get(right.id) ?? 0));
  }
  const laneIndexById = new Map(orderedLanes.map((lane, index) => [lane.id, index]));
  const adjacentNeighborsByNode = buildAdjacentNeighborsByNode(request.nodes, request.edges, nodeById, laneIndexById);
  const sameLanePredecessorsByNode = buildSameLanePredecessorsByNode(request.nodes, dependencyEdges, nodeById, topoOrder);

  for (const nodeId of topoOrder) {
    let nextX = 0;
    for (const edge of predecessors.get(nodeId) ?? []) {
      const sourceX = rawBaseXByNode.get(edge.sourceId) ?? 0;
      nextX = Math.max(nextX, sourceX + columnStep);
    }
    rawBaseXByNode.set(nodeId, nextX);
  }

  const maxReorderIterations = request.nodes.length * request.nodes.length + request.edges.length + 1;
  for (let iterations = 0; iterations < maxReorderIterations; iterations += 1) {
    let reordered = false;

    for (let laneIndex = orderedLanes.length - 2; laneIndex >= 0; laneIndex -= 1) {
      reordered =
        reorderLaneByBarycenter(
          nodesByLane.get(orderedLanes[laneIndex]?.id ?? ""),
          orderedLanes[laneIndex + 1]?.id ?? "",
          buildLanePositions(nodesByLane),
          adjacentNeighborsByNode,
          sameLanePredecessorsByNode,
        ) || reordered;
    }

    for (let laneIndex = 1; laneIndex < orderedLanes.length; laneIndex += 1) {
      reordered =
        reorderLaneByBarycenter(
          nodesByLane.get(orderedLanes[laneIndex]?.id ?? ""),
          orderedLanes[laneIndex - 1]?.id ?? "",
          buildLanePositions(nodesByLane),
          adjacentNeighborsByNode,
          sameLanePredecessorsByNode,
        ) || reordered;
    }

    if (!reordered) {
      break;
    }
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
            minNodeGap,
            columnStep,
          }),
        );
      }
      if (nextX !== (xByNode.get(nodeId) ?? 0)) {
        xByNode.set(nodeId, nextX);
        changed = true;
      }
    }

    for (let topoIndex = topoOrder.length - 1; topoIndex >= 0; topoIndex -= 1) {
      const nodeId = topoOrder[topoIndex];
      if (!nodeId) {
        continue;
      }
      let nextX = xByNode.get(nodeId) ?? 0;
      for (const edge of successors.get(nodeId) ?? []) {
        const targetX = xByNode.get(edge.targetId) ?? 0;
        nextX = Math.max(
          nextX,
          computeDownEdgeSourceConstraintX({
            edge,
            targetX,
            laneOrderById,
            nodeById,
            widthByNode,
            incomingCountByNode,
            minTargetShift,
          }),
        );
      }
      if (nextX !== (xByNode.get(nodeId) ?? 0)) {
        xByNode.set(nodeId, nextX);
        changed = true;
      }
    }

    for (const laneNodes of nodesByLane.values()) {
      let cursor = 0;
      for (const node of laneNodes) {
        const resolvedX = Math.max(xByNode.get(node.id) ?? 0, cursor);
        if (resolvedX !== (xByNode.get(node.id) ?? 0)) {
          xByNode.set(node.id, resolvedX);
          changed = true;
        }
        cursor = resolvedX + (widthByNode.get(node.id) ?? request.defaults.nodeWidth) + compactNodeGap(minNodeGap);
      }
    }
  }

  if (changed) {
    return failure("UnsatisfiableConstraints", "Compact layout did not converge.", { iterations });
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
    for (const edge of dependencyEdges) {
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
      const resolvedLeft = Math.min(...nodeIds.map((nodeId) => xByNode.get(nodeId) ?? 0));
      const actualWidth = resolvedRight - resolvedLeft;
      const footprintWidth = Math.max(actualWidth, group.footprintWidth ?? 0);
      minGroupLeft = resolvedLeft + footprintWidth + groupGap;
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
  const targetRequestSlotByEdgeId = new Map<string, number>();
  const sourceCountByEdgeId = new Map<string, number>();
  const targetCountByEdgeId = new Map<string, number>();
  const upwardDetourPlanByEdgeId = new Map<string, UpwardDetourPlan>();
  const edgeIndexById = new Map(request.edges.map((edge, index) => [edge.id, index]));
  const sourceEdgesByKey = new Map<string, string[]>();
  const targetEdgesByKey = new Map<string, string[]>();

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
    addEdgeToAnchorBucket(sourceEdgesByKey, edge.sourceId, sides.source, edge.id);
    addEdgeToAnchorBucket(targetEdgesByKey, edge.targetId, sides.target, edge.id);
  }

  assignTargetAnchorSlots({
    edgeIdsByBucket: targetEdgesByKey,
    edges: request.edges,
    edgeIndexById,
    nodeLayoutById,
    sideAssignments,
    laneOrderById,
    nodeById,
    targetRequestSlotByEdgeId,
  });

  assignAnchorOrdinals({
    edgeIdsByBucket: sourceEdgesByKey,
    edges: request.edges,
    edgeIndexById,
    nodeById,
    nodeLayoutById,
    laneOrderById,
    sideAssignments,
    role: "source",
    ordinalByEdgeId: sourceOrdinalByEdgeId,
    countByEdgeId: sourceCountByEdgeId,
  });
  assignAnchorOrdinals({
    edgeIdsByBucket: targetEdgesByKey,
    edges: request.edges,
    edgeIndexById,
    nodeById,
    nodeLayoutById,
    laneOrderById,
    sideAssignments,
    role: "target",
    ordinalByEdgeId: targetOrdinalByEdgeId,
    countByEdgeId: targetCountByEdgeId,
  });

  const assignedUpwardRows: Array<{ rowY: number; minX: number; maxX: number }> = [];
  const assignedDownwardRows: Array<{ rowY: number; minX: number; maxX: number; targetX: number; targetY: number }> = [];
  for (const edge of request.edges) {
    const nodeSource = nodeLayoutById.get(edge.sourceId);
    const nodeTarget = nodeLayoutById.get(edge.targetId);
    const sides = sideAssignments.get(edge.id);
    if (!nodeSource || !nodeTarget || !sides) {
      continue;
    }

    const orientation = deriveOrientation(
      laneOrderById.get(nodeById.get(edge.sourceId)?.laneId ?? "") ?? 0,
      laneOrderById.get(nodeById.get(edge.targetId)?.laneId ?? "") ?? 0,
    );
    const sourceAnchor = createEdgeAnchor(edge, nodeSource, sides.source, sourceOrdinalByEdgeId.get(edge.id) ?? 0, "source");
    const targetAnchor = resolveTargetAnchorBase(
      edge,
      createEdgeAnchor(edge, nodeTarget, sides.target, targetOrdinalByEdgeId.get(edge.id) ?? 0, "target"),
      targetOrdinalByEdgeId,
      targetRequestSlotByEdgeId,
      orientation,
    );
    const sourceStub = offsetFromAnchor(sourceAnchor, getSourceStubDistance(sourceAnchor, sourceCountByEdgeId.get(edge.id) ?? 1));
    if (orientation !== "up") {
      continue;
    }

    const overlapsExistingUpwardRow = (candidateRowY: number, minX: number, maxX: number) =>
      assignedUpwardRows.find(
        (assigned) =>
          Math.abs(assigned.rowY - candidateRowY) < UPWARD_REROUTE_SPACING &&
          horizontalRangesOverlap(minX, maxX, assigned.minX, assigned.maxX),
      );

    if (shouldDetourUpEdge(edge, sourceStub, targetAnchor, nodeLayouts, laneOrderById, nodeById)) {
      const targetApproach = offsetFromAnchor(targetAnchor, EDGE_STUB);
      const minX = Math.min(sourceStub.x, targetApproach.x);
      const maxX = Math.max(sourceStub.x, targetApproach.x);
      let detourRowY = highestObstacleBottom(edge, sourceStub, targetAnchor, nodeLayouts, nodeById) + UPWARD_REROUTE_SPACING;
      while (true) {
        const blockingRow = overlapsExistingUpwardRow(detourRowY, minX, maxX);
        if (!blockingRow) {
          break;
        }
        detourRowY = blockingRow.rowY + UPWARD_REROUTE_SPACING;
      }

      upwardDetourPlanByEdgeId.set(edge.id, { detourRowY });
      assignedUpwardRows.push({ rowY: detourRowY, minX, maxX });
      continue;
    }

    const minX = Math.min(sourceStub.x, targetAnchor.x);
    const maxX = Math.max(sourceStub.x, targetAnchor.x);
    let targetAnchorY = targetAnchor.y;
    while (true) {
      const blockingRow = overlapsExistingUpwardRow(targetAnchorY, minX, maxX);
      if (!blockingRow) {
        break;
      }
      targetAnchorY = blockingRow.rowY + UPWARD_REROUTE_SPACING;
    }

    if (Math.abs(targetAnchorY - targetAnchor.y) > Number.EPSILON) {
      upwardDetourPlanByEdgeId.set(edge.id, { targetAnchorY });
    }
    assignedUpwardRows.push({ rowY: targetAnchorY, minX, maxX });
  }

  const downEdgeCandidates = request.edges
    .map((edge, index) => {
      const nodeSource = nodeLayoutById.get(edge.sourceId);
      const nodeTarget = nodeLayoutById.get(edge.targetId);
      const sides = sideAssignments.get(edge.id);
      if (!nodeSource || !nodeTarget || !sides) {
        return null;
      }

      const sourceAnchor = createEdgeAnchor(edge, nodeSource, sides.source, sourceOrdinalByEdgeId.get(edge.id) ?? 0, "source");
      const targetAnchor = createEdgeAnchor(edge, nodeTarget, sides.target, targetOrdinalByEdgeId.get(edge.id) ?? 0, "target");
      const orientation = deriveOrientation(
        laneOrderById.get(nodeById.get(edge.sourceId)?.laneId ?? "") ?? 0,
        laneOrderById.get(nodeById.get(edge.targetId)?.laneId ?? "") ?? 0,
      );
      if (orientation !== "down") {
        return null;
      }

      const sourceStub = offsetFromAnchor(sourceAnchor, getSourceStubDistance(sourceAnchor, sourceCountByEdgeId.get(edge.id) ?? 1));
      const minX = Math.min(sourceAnchor.x, targetAnchor.x);
      const maxX = Math.max(sourceAnchor.x, targetAnchor.x);
      const baseRowY = resolveDownwardBaseRow(edge, sourceStub, targetAnchor, nodeLayouts);
      return {
        edge,
        index,
        sourceAnchor,
        sourceStub,
        targetAnchor,
        minX,
        maxX,
        baseRowY,
        targetOrdinal: targetOrdinalByEdgeId.get(edge.id) ?? 0,
        targetCount: targetCountByEdgeId.get(edge.id) ?? 1,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((left, right) => {
      if (left.baseRowY !== right.baseRowY) {
        return right.baseRowY - left.baseRowY;
      }
      return left.index - right.index;
    });

  for (const candidate of downEdgeCandidates) {
    let downRowY = candidate.baseRowY;
    if (candidate.targetCount > 1) {
      const snappedBaseRowY = Math.ceil(candidate.baseRowY / UPWARD_REROUTE_SPACING) * UPWARD_REROUTE_SPACING;
      const ordinalOffset = (candidate.targetCount - 1 - candidate.targetOrdinal) * UPWARD_REROUTE_SPACING;
      downRowY = Math.max(candidate.sourceStub.y, snappedBaseRowY + ordinalOffset);
    }
    for (let attempts = 0; attempts < 10; attempts += 1) {
      const blockingRow = assignedDownwardRows.find((assigned) => {
        const horizontalTrackOverlap =
          Math.abs(assigned.rowY - downRowY) < UPWARD_REROUTE_SPACING &&
          horizontalRangesOverlap(candidate.minX, candidate.maxX, assigned.minX, assigned.maxX);
        if (horizontalTrackOverlap) {
          return true;
        }

        const targetVerticalCrossesAssignedHorizontal =
          assigned.rowY >= downRowY &&
          assigned.rowY <= candidate.targetAnchor.y &&
          candidate.targetAnchor.x > assigned.minX &&
          candidate.targetAnchor.x < assigned.maxX;
        if (targetVerticalCrossesAssignedHorizontal) {
          return true;
        }

        return downRowY >= assigned.rowY &&
            downRowY <= assigned.targetY &&
            assigned.targetX > candidate.minX &&
            assigned.targetX < candidate.maxX;
      });
      if (!blockingRow) {
        break;
      }
      downRowY = blockingRow.rowY + UPWARD_REROUTE_SPACING;
    }

    upwardDetourPlanByEdgeId.set(candidate.edge.id, { downRowY });
    assignedDownwardRows.push({
      rowY: downRowY,
      minX: candidate.minX,
      maxX: candidate.maxX,
      targetX: candidate.targetAnchor.x,
      targetY: candidate.targetAnchor.y,
    });
  }

  const edges: EdgeLayout[] = request.edges.map((edge) => {
    const nodeSource = nodeLayoutById.get(edge.sourceId);
    const nodeTarget = nodeLayoutById.get(edge.targetId);
    const sides = sideAssignments.get(edge.id);
    if (!nodeSource || !nodeTarget || !sides) {
      throw new Error(`Incomplete edge state for ${edge.id}.`);
    }

    const sourceAnchor = createEdgeAnchor(edge, nodeSource, sides.source, sourceOrdinalByEdgeId.get(edge.id) ?? 0, "source");
    const targetAnchorBase = resolveTargetAnchorBase(
      edge,
      createEdgeAnchor(edge, nodeTarget, sides.target, targetOrdinalByEdgeId.get(edge.id) ?? 0, "target"),
      targetOrdinalByEdgeId,
      targetRequestSlotByEdgeId,
      deriveOrientation(
        laneOrderById.get(nodeById.get(edge.sourceId)?.laneId ?? "") ?? 0,
        laneOrderById.get(nodeById.get(edge.targetId)?.laneId ?? "") ?? 0,
      ),
    );
    const orientation = deriveOrientation(
      laneOrderById.get(nodeById.get(edge.sourceId)?.laneId ?? "") ?? 0,
      laneOrderById.get(nodeById.get(edge.targetId)?.laneId ?? "") ?? 0,
    );
    const targetRequestSlot = targetRequestSlotByEdgeId.get(edge.id) ?? 0;
    const upwardPlan = {
      ...upwardDetourPlanByEdgeId.get(edge.id),
      ...(orientation === "up" && sourceAnchor.side === "top" && targetAnchorBase.side === "bottom" && targetRequestSlot > 0
        ? {
            upRowY:
              sourceAnchor.y -
              getCompactTopStubDistance(sourceAnchor, sourceCountByEdgeId.get(edge.id) ?? 1, nodeSource.height) -
              targetRequestSlot * UPWARD_REROUTE_SPACING,
          }
        : {}),
    };
    const targetAnchor = adjustCompactTargetAnchor(
      nodeSource,
      sourceAnchor,
      upwardPlan?.targetAnchorY === undefined
        ? targetAnchorBase
        : { ...targetAnchorBase, y: upwardPlan.targetAnchorY },
    );
    const points = routeOrthogonalEdge(
      edge,
      sourceAnchor,
      targetAnchor,
      sourceCountByEdgeId.get(edge.id) ?? 1,
      upwardPlan,
      nodeLayouts,
      laneOrderById,
      nodeById,
    );

    return {
      id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        sourceAnchor: normalizeCompactAnchorOrdinal(sourceAnchor),
        targetAnchor: normalizeCompactAnchorOrdinal(targetAnchor),
        points,
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

function isBackReferenceEdge(edge: EdgeInput) {
  return edge.role === "back-reference";
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
    return { source: "top", target: "bottom" };
  }
  return { source: "bottom", target: "top" };
}

function createEdgeAnchor(edge: EdgeInput, node: NodeLayout, side: AnchorSide, ordinal: number, role: AnchorRole): AnchorPoint {
  if (isBackReferenceEdge(edge) && (side === "top" || side === "bottom")) {
    const bias = role === "source" ? VERTICAL_TARGET_BIAS - VERTICAL_ANCHOR_SPACING : VERTICAL_SOURCE_BIAS;
    return {
      x: node.x + node.width / 2 + bias + ordinal * VERTICAL_ANCHOR_SPACING,
      y: side === "top" ? node.y : node.y + node.height,
      side,
      ordinal,
    };
  }

  return createAnchor(node, side, ordinal, role);
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

  return {
    x: side === "left" ? node.x : node.x + node.width,
    y: node.y + compactSideAnchorOffset(node.height),
    side,
    ordinal,
  };
}

function adjustCompactTargetAnchor(sourceNode: NodeLayout, sourceAnchor: AnchorPoint, targetAnchor: AnchorPoint): AnchorPoint {
  if (sourceAnchor.side === "top" && targetAnchor.side === "bottom") {
    const ordinalOffset = sourceNode.height > 56 ? 0 : sourceAnchor.ordinal * VERTICAL_ANCHOR_SPACING;
    return { ...targetAnchor, x: targetAnchor.x - ordinalOffset };
  }
  return targetAnchor;
}

function compactSideAnchorOffset(nodeHeight: number) {
  return nodeHeight / 2 - 4 + Math.max(0, nodeHeight - 48) * (7 / 22);
}

function normalizeCompactAnchorOrdinal(anchor: AnchorPoint): AnchorPoint {
  if (anchor.side === "top" || anchor.side === "bottom") {
    return { ...anchor, ordinal: 0 };
  }
  return anchor;
}

function buildAdjacentNeighborsByNode(
  nodes: NodeInput[],
  edges: EdgeInput[],
  nodeById: Map<string, NodeInput>,
  laneIndexById: Map<string, number>,
) {
  const neighborsByNode = new Map<string, Map<string, string[]>>(nodes.map((node) => [node.id, new Map<string, string[]>()]));

  for (const edge of edges) {
    const sourceNode = nodeById.get(edge.sourceId);
    const targetNode = nodeById.get(edge.targetId);
    if (!sourceNode || !targetNode) {
      continue;
    }
    const sourceLaneIndex = laneIndexById.get(sourceNode.laneId);
    const targetLaneIndex = laneIndexById.get(targetNode.laneId);
    if (sourceLaneIndex === undefined || targetLaneIndex === undefined) {
      continue;
    }
    if (Math.abs(sourceLaneIndex - targetLaneIndex) !== 1) {
      continue;
    }
    addNeighbor(neighborsByNode, sourceNode.id, targetNode.laneId, targetNode.id);
    addNeighbor(neighborsByNode, targetNode.id, sourceNode.laneId, sourceNode.id);
  }

  return neighborsByNode;
}

function addNeighbor(
  neighborsByNode: Map<string, Map<string, string[]>>,
  nodeId: string,
  laneId: string,
  neighborId: string,
) {
  const laneNeighbors = neighborsByNode.get(nodeId);
  if (!laneNeighbors) {
    return;
  }
  const neighborIds = laneNeighbors.get(laneId) ?? [];
  neighborIds.push(neighborId);
  laneNeighbors.set(laneId, neighborIds);
}

function buildSameLanePredecessorsByNode(
  nodes: NodeInput[],
  edges: EdgeInput[],
  nodeById: Map<string, NodeInput>,
  topoOrder: string[],
) {
  const predecessorsByNode = new Map<string, Set<string>>(nodes.map((node) => [node.id, new Set<string>()]));
  const reachablePredecessorsByNode = new Map<string, Set<string>>(nodes.map((node) => [node.id, new Set<string>()]));
  const outgoing = new Map<string, EdgeInput[]>(nodes.map((node) => [node.id, []]));

  for (const edge of edges) {
    outgoing.get(edge.sourceId)?.push(edge);
  }

  for (const nodeId of topoOrder) {
    const sourceReachablePredecessors = reachablePredecessorsByNode.get(nodeId) ?? new Set<string>();
    for (const edge of outgoing.get(nodeId) ?? []) {
      const targetReachablePredecessors = reachablePredecessorsByNode.get(edge.targetId);
      if (!targetReachablePredecessors) {
        continue;
      }
      for (const predecessorId of sourceReachablePredecessors) {
        targetReachablePredecessors.add(predecessorId);
      }
      targetReachablePredecessors.add(nodeId);
    }
  }

  for (const node of nodes) {
    const sameLanePredecessors = predecessorsByNode.get(node.id);
    if (!sameLanePredecessors) {
      continue;
    }
    for (const predecessorId of reachablePredecessorsByNode.get(node.id) ?? []) {
      if (nodeById.get(predecessorId)?.laneId === node.laneId) {
        sameLanePredecessors.add(predecessorId);
      }
    }
  }

  return predecessorsByNode;
}

function buildLanePositions(nodesByLane: Map<string, NodeInput[]>) {
  const lanePositions = new Map<string, Map<string, number>>();
  for (const [laneId, laneNodes] of nodesByLane.entries()) {
    lanePositions.set(
      laneId,
      new Map(laneNodes.map((node, index) => [node.id, index])),
    );
  }
  return lanePositions;
}

function reorderLaneByBarycenter(
  laneNodes: NodeInput[] | undefined,
  referenceLaneId: string,
  lanePositions: Map<string, Map<string, number>>,
  adjacentNeighborsByNode: Map<string, Map<string, string[]>>,
  sameLanePredecessorsByNode: Map<string, Set<string>>,
) {
  if (!laneNodes || laneNodes.length < 2) {
    return false;
  }

  const referencePositions = lanePositions.get(referenceLaneId);
  if (!referencePositions) {
    return false;
  }

  const originalOrder = laneNodes.map((node) => node.id);
  const nextOrder: NodeInput[] = [];
  let index = 0;
  while (index < laneNodes.length) {
    const startNode = laneNodes[index];
    if (!startNode) {
      break;
    }
    const blockGroupId = startNode.groupId;
    const block: NodeInput[] = [];
    while (index < laneNodes.length && laneNodes[index]?.groupId === blockGroupId) {
      const laneNode = laneNodes[index];
      if (laneNode) {
        block.push(laneNode);
      }
      index += 1;
    }
    const reorderedBlock = reorderBlockByBarycenter(
      block,
      referenceLaneId,
      referencePositions,
      adjacentNeighborsByNode,
      sameLanePredecessorsByNode,
    );
    nextOrder.push(...reorderedBlock);
  }

  let reordered = false;
  for (let currentIndex = 0; currentIndex < laneNodes.length; currentIndex += 1) {
    const nextNode = nextOrder[currentIndex];
    if (!nextNode) {
      continue;
    }
    laneNodes[currentIndex] = nextNode;
    if (nextNode.id !== originalOrder[currentIndex]) {
      reordered = true;
    }
  }

  return reordered;
}

function resolveTargetAnchorBase(
  edge: EdgeInput,
  targetAnchor: AnchorPoint,
  targetOrdinalByEdgeId: Map<string, number>,
  targetRequestSlotByEdgeId: Map<string, number>,
  orientation: EdgeOrientation,
) {
  if (orientation !== "up") {
    return targetAnchor;
  }
  if (isBackReferenceEdge(edge) && (targetAnchor.side === "top" || targetAnchor.side === "bottom")) {
    return targetAnchor;
  }

  const semanticOrdinal = targetOrdinalByEdgeId.get(edge.id) ?? targetAnchor.ordinal;
  const requestSlot = targetRequestSlotByEdgeId.get(edge.id) ?? semanticOrdinal;
  if (targetAnchor.side === "top" || targetAnchor.side === "bottom") {
    return {
      ...targetAnchor,
      x: targetAnchor.x - semanticOrdinal * VERTICAL_ANCHOR_SPACING - requestSlot * VERTICAL_ANCHOR_SPACING,
    };
  }

  if (targetAnchor.side !== "left" && targetAnchor.side !== "right") {
    return targetAnchor;
  }
  if (requestSlot === semanticOrdinal) {
    return targetAnchor;
  }
  return {
    ...targetAnchor,
    y: targetAnchor.y + (requestSlot - semanticOrdinal) * HORIZONTAL_ANCHOR_SPACING,
  };
}

function assignTargetAnchorSlots(params: {
  edgeIdsByBucket: Map<string, string[]>;
  edges: EdgeInput[];
  edgeIndexById: Map<string, number>;
  nodeLayoutById: Map<string, NodeLayout>;
  sideAssignments: Map<string, EdgeSideAssignment>;
  laneOrderById: Map<string, number>;
  nodeById: Map<string, NodeInput>;
  targetRequestSlotByEdgeId: Map<string, number>;
}) {
  const {
    edgeIdsByBucket,
    edges,
    edgeIndexById,
    nodeLayoutById,
    sideAssignments,
    laneOrderById,
    nodeById,
    targetRequestSlotByEdgeId,
  } = params;
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));

  for (const edgeIds of edgeIdsByBucket.values()) {
    const sortedEdgeIds = [...edgeIds].sort((leftId, rightId) => {
      const leftEdge = edgeById.get(leftId);
      const rightEdge = edgeById.get(rightId);
      if (!leftEdge || !rightEdge) {
        return (edgeIndexById.get(leftId) ?? 0) - (edgeIndexById.get(rightId) ?? 0);
      }

      const leftSide = sideAssignments.get(leftId)?.target;
      const rightSide = sideAssignments.get(rightId)?.target;
      const leftOrientation = deriveOrientation(
        laneOrderById.get(nodeById.get(leftEdge.sourceId)?.laneId ?? "") ?? 0,
        laneOrderById.get(nodeById.get(leftEdge.targetId)?.laneId ?? "") ?? 0,
      );
      const rightOrientation = deriveOrientation(
        laneOrderById.get(nodeById.get(rightEdge.sourceId)?.laneId ?? "") ?? 0,
        laneOrderById.get(nodeById.get(rightEdge.targetId)?.laneId ?? "") ?? 0,
      );

      if (
        leftOrientation === "up" &&
        rightOrientation === "up" &&
        (leftSide === "left" || leftSide === "right") &&
        leftSide === rightSide
      ) {
        const leftSource = nodeLayoutById.get(leftEdge.sourceId);
        const rightSource = nodeLayoutById.get(rightEdge.sourceId);
        if (leftSource && rightSource) {
          const leftPosition = leftSource.x + leftSource.width / 2;
          const rightPosition = rightSource.x + rightSource.width / 2;
          if (leftPosition !== rightPosition) {
            return leftPosition - rightPosition;
          }
        }
      }

      return (edgeIndexById.get(leftId) ?? 0) - (edgeIndexById.get(rightId) ?? 0);
    });

    sortedEdgeIds.forEach((edgeId, index) => {
      targetRequestSlotByEdgeId.set(edgeId, index);
    });
  }
}

function addEdgeToAnchorBucket(
  edgeIdsByBucket: Map<string, string[]>,
  nodeId: string,
  side: AnchorSide,
  edgeId: string,
) {
  const bucketKey = `${nodeId}:${side}`;
  const bucket = edgeIdsByBucket.get(bucketKey) ?? [];
  bucket.push(edgeId);
  edgeIdsByBucket.set(bucketKey, bucket);
}

function assignAnchorOrdinals(params: {
  edgeIdsByBucket: Map<string, string[]>;
  edges: EdgeInput[];
  edgeIndexById: Map<string, number>;
  nodeById: Map<string, NodeInput>;
  nodeLayoutById: Map<string, NodeLayout>;
  laneOrderById: Map<string, number>;
  sideAssignments: Map<string, EdgeSideAssignment>;
  role: AnchorRole;
  ordinalByEdgeId: Map<string, number>;
  countByEdgeId: Map<string, number>;
}) {
  const {
    edgeIdsByBucket,
    edges,
    edgeIndexById,
    nodeById,
    nodeLayoutById,
    laneOrderById,
    sideAssignments,
    role,
    ordinalByEdgeId,
    countByEdgeId,
  } = params;
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));

  for (const edgeIds of edgeIdsByBucket.values()) {
    const sortedEdgeIds = [...edgeIds].sort((leftId, rightId) => {
      const leftEdge = edgeById.get(leftId);
      const rightEdge = edgeById.get(rightId);
      if (!leftEdge || !rightEdge) {
        return (edgeIndexById.get(leftId) ?? 0) - (edgeIndexById.get(rightId) ?? 0);
      }
      const side = sideAssignments.get(leftId)?.[role];
      if (!side || side !== sideAssignments.get(rightId)?.[role]) {
        return (edgeIndexById.get(leftId) ?? 0) - (edgeIndexById.get(rightId) ?? 0);
      }

      const leftOppositeNode = nodeLayoutById.get(role === "source" ? leftEdge.targetId : leftEdge.sourceId);
      const rightOppositeNode = nodeLayoutById.get(role === "source" ? rightEdge.targetId : rightEdge.sourceId);
      if (!leftOppositeNode || !rightOppositeNode) {
        return (edgeIndexById.get(leftId) ?? 0) - (edgeIndexById.get(rightId) ?? 0);
      }

      if (role === "source" && side === "bottom") {
        const leftLaneOrder = laneOrderById.get(nodeById.get(leftEdge.targetId)?.laneId ?? "") ?? 0;
        const rightLaneOrder = laneOrderById.get(nodeById.get(rightEdge.targetId)?.laneId ?? "") ?? 0;
        if (leftLaneOrder !== rightLaneOrder) {
          return rightLaneOrder - leftLaneOrder;
        }
      }

      if (role === "target" && side === "bottom") {
        const leftOrientation = deriveOrientation(
          laneOrderById.get(nodeById.get(leftEdge.sourceId)?.laneId ?? "") ?? 0,
          laneOrderById.get(nodeById.get(leftEdge.targetId)?.laneId ?? "") ?? 0,
        );
        const rightOrientation = deriveOrientation(
          laneOrderById.get(nodeById.get(rightEdge.sourceId)?.laneId ?? "") ?? 0,
          laneOrderById.get(nodeById.get(rightEdge.targetId)?.laneId ?? "") ?? 0,
        );
        if (leftOrientation === "up" && rightOrientation === "up") {
          return (edgeIndexById.get(leftId) ?? 0) - (edgeIndexById.get(rightId) ?? 0);
        }
      }

      const leftPosition = anchorOrderingPosition(side, leftOppositeNode);
      const rightPosition = anchorOrderingPosition(side, rightOppositeNode);
      if (leftPosition !== rightPosition) {
        return leftPosition - rightPosition;
      }
      return (edgeIndexById.get(leftId) ?? 0) - (edgeIndexById.get(rightId) ?? 0);
    });

    sortedEdgeIds.forEach((edgeId, ordinal) => {
      ordinalByEdgeId.set(edgeId, ordinal);
      countByEdgeId.set(edgeId, sortedEdgeIds.length);
    });
  }
}

function anchorOrderingPosition(side: AnchorSide, oppositeNode: NodeLayout) {
  if (side === "top" || side === "bottom") {
    return oppositeNode.x + oppositeNode.width / 2;
  }
  return oppositeNode.y + oppositeNode.height / 2;
}

function reorderBlockByBarycenter(
  nodes: NodeInput[],
  referenceLaneId: string,
  referencePositions: Map<string, number>,
  adjacentNeighborsByNode: Map<string, Map<string, string[]>>,
  sameLanePredecessorsByNode: Map<string, Set<string>>,
) {
  const entries: LaneOrderEntry[] = nodes.map((node, originalIndex) => ({
    node,
    originalIndex,
    barycenter: computeBarycenter(node.id, referenceLaneId, referencePositions, adjacentNeighborsByNode),
  }));

  const entryByNodeId = new Map(entries.map((entry) => [entry.node.id, entry]));
  const remaining = new Set(entries.map((entry) => entry.node.id));
  const orderedEntries: LaneOrderEntry[] = [];

  while (remaining.size > 0) {
    const availableEntries = [...remaining]
      .map((nodeId) => entryByNodeId.get(nodeId))
      .filter((entry): entry is LaneOrderEntry => entry !== undefined)
      .filter((entry) => {
        const sameLanePredecessors = sameLanePredecessorsByNode.get(entry.node.id) ?? new Set<string>();
        return [...sameLanePredecessors].every((predecessorId) => !remaining.has(predecessorId) || !entryByNodeId.has(predecessorId));
      });

    const candidates = availableEntries.length > 0
      ? availableEntries
      : [...remaining].map((nodeId) => entryByNodeId.get(nodeId)).filter((entry): entry is LaneOrderEntry => entry !== undefined);
    candidates.sort(compareLaneOrderEntries);

    const nextEntry = candidates[0];
    if (!nextEntry) {
      break;
    }
    orderedEntries.push(nextEntry);
    remaining.delete(nextEntry.node.id);
  }

  return orderedEntries.map((entry) => entry.node);
}

function compareLaneOrderEntries(left: LaneOrderEntry, right: LaneOrderEntry) {
  if (left.barycenter !== null && right.barycenter !== null && left.barycenter !== right.barycenter) {
    return left.barycenter - right.barycenter;
  }
  if (left.barycenter !== null && right.barycenter === null) {
    return -1;
  }
  if (left.barycenter === null && right.barycenter !== null) {
    return 1;
  }
  return left.originalIndex - right.originalIndex;
}

function computeBarycenter(
  nodeId: string,
  referenceLaneId: string,
  referencePositions: Map<string, number>,
  adjacentNeighborsByNode: Map<string, Map<string, string[]>>,
) {
  const neighbors = adjacentNeighborsByNode.get(nodeId)?.get(referenceLaneId) ?? [];
  const positions: NeighborPosition[] = neighbors
    .map((neighborId) => ({ nodeId: neighborId, position: referencePositions.get(neighborId) ?? -1 }))
    .filter((neighbor) => neighbor.position >= 0);
  if (positions.length === 0) {
    return null;
  }
  const total = positions.reduce((sum, neighbor) => sum + neighbor.position, 0);
  return total / positions.length;
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
  minNodeGap: number;
  columnStep: number;
}) {
  const {
    edge,
    sourceX,
    targetId,
    laneOrderById,
    nodeById,
    widthByNode,
    minTargetShift,
    minNodeGap,
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
    const sourceWidth = widthByNode.get(edge.sourceId) ?? 0;
    const targetWidth = widthByNode.get(targetId) ?? 0;
    return sourceX + Math.max(minTargetShift, (sourceWidth - targetWidth) / 2 + minTargetShift);
  }

  if (orientation === "up") {
    return sourceX + minTargetShift;
  }

  return sourceX + (widthByNode.get(edge.sourceId) ?? 0) + minNodeGap + EDGE_STUB;
}

function computeDownEdgeSourceConstraintX(params: {
  edge: EdgeInput;
  targetX: number;
  laneOrderById: Map<string, number>;
  nodeById: Map<string, NodeInput>;
  widthByNode: Map<string, number>;
  incomingCountByNode: Map<string, number>;
  minTargetShift: number;
}) {
  const { edge, targetX, laneOrderById, nodeById, widthByNode, incomingCountByNode, minTargetShift } = params;
  const sourceNode = nodeById.get(edge.sourceId);
  const targetNode = nodeById.get(edge.targetId);
  if (!sourceNode || !targetNode) {
    return Number.NEGATIVE_INFINITY;
  }

  const orientation = deriveOrientation(
    laneOrderById.get(sourceNode.laneId) ?? 0,
    laneOrderById.get(targetNode.laneId) ?? 0,
  );
  if (orientation !== "down" || (incomingCountByNode.get(edge.sourceId) ?? 0) > 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const sourceWidth = widthByNode.get(edge.sourceId) ?? 0;
  const targetWidth = widthByNode.get(edge.targetId) ?? 0;
  const targetShift = Math.max(minTargetShift, (sourceWidth - targetWidth) / 2 + minTargetShift);
  return targetX - targetShift;
}

function compactNodeGap(minNodeGap: number) {
  return Math.max(0, minNodeGap - EDGE_STUB / 2);
}

function routeOrthogonalEdge(
  edge: EdgeInput,
  sourceAnchor: AnchorPoint,
  targetAnchor: AnchorPoint,
  sourceSideCount: number,
  upwardDetourPlan: UpwardDetourPlan | undefined,
  nodeLayouts: NodeLayout[],
  laneOrderById: Map<string, number>,
  nodeById: Map<string, NodeInput>,
): Point[] {
  const sourceStub = offsetFromAnchor(sourceAnchor, getSourceStubDistance(sourceAnchor, sourceSideCount));
  if (sourceAnchor.side === "bottom" && upwardDetourPlan?.downRowY !== undefined) {
    return [
      { x: sourceAnchor.x, y: sourceAnchor.y },
      { x: sourceAnchor.x, y: upwardDetourPlan.downRowY },
      { x: targetAnchor.x, y: upwardDetourPlan.downRowY },
      { x: targetAnchor.x, y: targetAnchor.y },
    ];
  }
  if (sourceAnchor.side === "top" && targetAnchor.side === "bottom") {
    const sourceNode = nodeLayouts.find((node) => node.id === edge.sourceId);
    const rowY = upwardDetourPlan?.upRowY ?? (sourceAnchor.x === targetAnchor.x
      ? Math.max(90, targetAnchor.y + EDGE_STUB)
      : sourceAnchor.y - getCompactTopStubDistance(sourceAnchor, sourceSideCount, sourceNode?.height ?? 48));
    return [
      { x: sourceAnchor.x, y: sourceAnchor.y },
      { x: sourceAnchor.x, y: rowY },
      { x: targetAnchor.x, y: rowY },
      { x: targetAnchor.x, y: targetAnchor.y },
    ];
  }

  const targetApproach = getTargetApproachPoint(sourceStub, targetAnchor);
  if (shouldDetourUpEdge(edge, sourceStub, targetAnchor, nodeLayouts, laneOrderById, nodeById)) {
    const detourSourceStub = { x: sourceStub.x, y: sourceStub.y - UPWARD_REROUTE_ENTRY_OFFSET };
    const detourY =
      upwardDetourPlan?.detourRowY ??
      highestObstacleBottom(edge, sourceStub, targetAnchor, nodeLayouts, nodeById) + UPWARD_REROUTE_SPACING;
    const detourApproach = offsetFromAnchor(targetAnchor, EDGE_STUB);
    return [
      { x: sourceAnchor.x, y: sourceAnchor.y },
      detourSourceStub,
      { x: detourSourceStub.x, y: detourY },
      { x: detourApproach.x, y: detourY },
      { x: detourApproach.x, y: targetAnchor.y },
      { x: targetAnchor.x, y: targetAnchor.y },
    ];
  }
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

function getCompactTopStubDistance(sourceAnchor: AnchorPoint, sourceSideCount: number, sourceHeight: number) {
  const heightAdjustment = Math.max(0, sourceHeight - 56);
  if (sourceSideCount > 1) {
    return EDGE_STUB + (sourceSideCount - sourceAnchor.ordinal) * 10 + heightAdjustment;
  }
  return EDGE_STUB + heightAdjustment;
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

function shouldDetourUpEdge(
  edge: EdgeInput,
  sourceStub: Point,
  targetAnchor: AnchorPoint,
  nodeLayouts: NodeLayout[],
  laneOrderById: Map<string, number>,
  nodeById: Map<string, NodeInput>,
) {
  const sourceNode = nodeById.get(edge.sourceId);
  const targetNode = nodeById.get(edge.targetId);
  if (!sourceNode || !targetNode) {
    return false;
  }

  const orientation = deriveOrientation(
    laneOrderById.get(sourceNode.laneId) ?? 0,
    laneOrderById.get(targetNode.laneId) ?? 0,
  );
  if (orientation !== "up") {
    return false;
  }

  const overlappingNodes = findHorizontalSegmentObstacles(edge, sourceStub, targetAnchor, nodeLayouts, nodeById);
  return overlappingNodes.length > 0;
}

function highestObstacleBottom(
  edge: EdgeInput,
  sourceStub: Point,
  targetAnchor: AnchorPoint,
  nodeLayouts: NodeLayout[],
  nodeById: Map<string, NodeInput>,
) {
  const overlappingNodes = findHorizontalSegmentObstacles(edge, sourceStub, targetAnchor, nodeLayouts, nodeById);
  if (overlappingNodes.length === 0) {
    return targetAnchor.y;
  }
  return Math.max(...overlappingNodes.map((node) => node.y + node.height));
}

function resolveDownwardBaseRow(
  edge: EdgeInput,
  sourceStub: Point,
  targetAnchor: AnchorPoint,
  nodeLayouts: NodeLayout[],
) {
  let rowY = sourceStub.y;
  while (true) {
    const overlappingHorizontalNodes = findDownwardSegmentObstacles(edge, sourceStub.x, targetAnchor.x, rowY, nodeLayouts);
    const overlappingVerticalNodes = findDownwardVerticalObstacles(edge, targetAnchor.x, rowY, targetAnchor.y, nodeLayouts);
    const overlappingNodes = [...overlappingHorizontalNodes, ...overlappingVerticalNodes];
    if (overlappingNodes.length === 0) {
      return rowY;
    }
    rowY = Math.max(...overlappingNodes.map((node) => node.y + node.height)) + UPWARD_REROUTE_SPACING;
  }
}

function findHorizontalSegmentObstacles(
  edge: EdgeInput,
  sourceStub: Point,
  targetAnchor: AnchorPoint,
  nodeLayouts: NodeLayout[],
  nodeById: Map<string, NodeInput>,
) {
  const targetNode = nodeById.get(edge.targetId);
  if (!targetNode) {
    return [];
  }

  const minX = Math.min(sourceStub.x, targetAnchor.x);
  const maxX = Math.max(sourceStub.x, targetAnchor.x);

  return nodeLayouts.filter((node) => {
    if (node.id === edge.sourceId || node.id === edge.targetId) {
      return false;
    }
    const candidate = nodeById.get(node.id);
    if (!candidate || candidate.laneId !== targetNode.laneId) {
      return false;
    }
    const overlapsY = targetAnchor.y >= node.y && targetAnchor.y <= node.y + node.height;
    const overlapsX = maxX > node.x && minX < node.x + node.width;
    return overlapsX && overlapsY;
  });
}

function findDownwardSegmentObstacles(
  edge: EdgeInput,
  sourceX: number,
  targetX: number,
  rowY: number,
  nodeLayouts: NodeLayout[],
) {
  const minX = Math.min(sourceX, targetX);
  const maxX = Math.max(sourceX, targetX);

  return nodeLayouts.filter((node) => {
    if (node.id === edge.sourceId || node.id === edge.targetId) {
      return false;
    }
    const overlapsX = maxX > node.x && minX < node.x + node.width;
    const overlapsY = rowY >= node.y && rowY <= node.y + node.height;
    return overlapsX && overlapsY;
  });
}

function findDownwardVerticalObstacles(
  edge: EdgeInput,
  targetX: number,
  rowY: number,
  targetY: number,
  nodeLayouts: NodeLayout[],
) {
  const minY = Math.min(rowY, targetY);
  const maxY = Math.max(rowY, targetY);

  return nodeLayouts.filter((node) => {
    if (node.id === edge.sourceId || node.id === edge.targetId) {
      return false;
    }
    const overlapsX = targetX > node.x && targetX < node.x + node.width;
    const overlapsY = maxY > node.y && minY < node.y + node.height;
    return overlapsX && overlapsY;
  });
}

function horizontalRangesOverlap(leftMinX: number, leftMaxX: number, rightMinX: number, rightMaxX: number) {
  return leftMaxX > rightMinX && leftMinX < rightMaxX;
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
