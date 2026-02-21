import type { Position } from './types';

export type DiagramPoint = { x: number; y: number };

export type DiagramEdgeGeometry = {
  d: string;
  labelX: number;
  labelY: number;
  points?: DiagramPoint[];
};

export type RoutedEdgeInput = {
  key: string;
  from: string;
  to: string;
};

type RoutedEdgeDescriptor = {
  key: string;
  sourceKey: string;
  targetKey: string;
  source: Position;
  target: Position;
  sourceMidX: number;
  sourceMidY: number;
  targetMidX: number;
  targetMidY: number;
  startX: number;
  endX: number;
  startY: number;
  endY: number;
  sameRow: boolean;
  goDown: boolean;
  trackY: number;
  minTrackY: number;
  maxTrackY: number;
  bendX: number;
};

const SOURCE_ANCHOR_OFFSET = 20;
const TARGET_ANCHOR_OFFSET = 20;
const EDGE_EDGE_TRACK_SPACING = 10;
const EDGE_NODE_CLEARANCE = 6;
const SAME_ROW_BEND_OFFSET = 20;
const SAME_ROW_BEND_SPACING = 12;

function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    return (min + max) / 2;
  }
  return Math.max(min, Math.min(max, value));
}

function distributeSlots(center: number, count: number, spacing: number, min: number, max: number): number[] {
  if (count <= 0) {
    return [];
  }
  if (count === 1) {
    return [clamp(center, min, max)];
  }

  const half = (count - 1) / 2;
  const start = center - half * spacing;
  const raw = Array.from({ length: count }, (_, index) => start + index * spacing);
  const rawMin = raw[0];
  const rawMax = raw[raw.length - 1];
  let shift = 0;
  if (rawMin < min) {
    shift = min - rawMin;
  } else if (rawMax > max) {
    shift = max - rawMax;
  }
  const shifted = raw.map((value) => value + shift);
  return shifted.map((value) => clamp(value, min, max));
}

function baseDescriptor(
  edge: RoutedEdgeInput,
  pos: Record<string, Position>,
  sourceX: number,
  targetX: number,
  density: number
): RoutedEdgeDescriptor | null {
  const source = pos[edge.from];
  const target = pos[edge.to];
  if (!source || !target) {
    return null;
  }

  const sourceMidX = source.x + source.w / 2;
  const sourceMidY = source.y + source.h / 2;
  const targetMidX = target.x + target.w / 2;
  const targetMidY = target.y + target.h / 2;
  const sameRow = Math.abs(sourceMidY - targetMidY) < 4;
  const goDown = targetMidY > sourceMidY;
  const startY = sameRow ? sourceMidY : (goDown ? source.y + source.h : source.y);
  const endY = sameRow ? targetMidY : (goDown ? target.y : target.y + target.h);
  const deltaY = Math.abs(endY - startY);
  const baseFirstLeg = Math.min(14, Math.max(10, deltaY * 0.06 + 8));
  const densityBias = Math.min(2, Math.max(0, density - 1) * 0.5);
  const firstLeg = Math.min(Math.max(8, deltaY - 8), baseFirstLeg + densityBias);
  const baseTrackY = goDown ? startY + firstLeg : startY - firstLeg;
  const minTrackY = goDown ? startY + 6 : endY + 6;
  const maxTrackY = goDown ? endY - 6 : startY - 6;
  const baseBendX = Math.max(source.x + source.w + SAME_ROW_BEND_OFFSET, (source.x + source.w + target.x) / 2);

  return {
    key: edge.key,
    sourceKey: edge.from,
    targetKey: edge.to,
    source,
    target,
    sourceMidX,
    sourceMidY,
    targetMidX,
    targetMidY,
    startX: sourceX,
    endX: targetX,
    startY,
    endY,
    sameRow,
    goDown,
    trackY: clamp(baseTrackY, Math.min(minTrackY, maxTrackY), Math.max(minTrackY, maxTrackY)),
    minTrackY,
    maxTrackY,
    bendX: baseBendX
  };
}

function sharedSegmentComparator(left: RoutedEdgeDescriptor, right: RoutedEdgeDescriptor): number {
  if (left.targetKey === right.targetKey && left.goDown === right.goDown) {
    const leftSpan = Math.abs(left.endX - left.startX);
    const rightSpan = Math.abs(right.endX - right.startX);
    if (leftSpan !== rightSpan) {
      return left.goDown ? leftSpan - rightSpan : rightSpan - leftSpan;
    }
  }
  const leftLeft = Math.min(left.startX, left.endX);
  const rightLeft = Math.min(right.startX, right.endX);
  if (leftLeft !== rightLeft) {
    return leftLeft - rightLeft;
  }
  const leftRight = Math.max(left.startX, left.endX);
  const rightRight = Math.max(right.startX, right.endX);
  if (leftRight !== rightRight) {
    return leftRight - rightRight;
  }
  const leftDiag = left.startX + left.endX;
  const rightDiag = right.startX + right.endX;
  if (leftDiag !== rightDiag) {
    return leftDiag - rightDiag;
  }
  return left.key.localeCompare(right.key);
}

function rangesOverlap(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number): boolean {
  const leftMin = Math.min(leftStart, leftEnd);
  const leftMax = Math.max(leftStart, leftEnd);
  const rightMin = Math.min(rightStart, rightEnd);
  const rightMax = Math.max(rightStart, rightEnd);
  return leftMax >= rightMin && rightMax >= leftMin;
}

function segmentIntersectsNode(
  y: number,
  segmentStartX: number,
  segmentEndX: number,
  node: Position,
  clearance: number
): boolean {
  const nodeLeft = node.x - clearance;
  const nodeRight = node.x + node.w + clearance;
  const nodeTop = node.y - clearance;
  const nodeBottom = node.y + node.h + clearance;
  return rangesOverlap(segmentStartX, segmentEndX, nodeLeft, nodeRight) && y >= nodeTop && y <= nodeBottom;
}

function findNonOverlappingTrackY(
  descriptor: RoutedEdgeDescriptor,
  pos: Record<string, Position>,
  minAllowedY?: number,
  maxAllowedY?: number
): number {
  const minY = Math.max(Math.min(descriptor.minTrackY, descriptor.maxTrackY), minAllowedY ?? Number.NEGATIVE_INFINITY);
  const maxY = Math.min(Math.max(descriptor.minTrackY, descriptor.maxTrackY), maxAllowedY ?? Number.POSITIVE_INFINITY);
  if (maxY <= minY) {
    return clamp(descriptor.trackY, minY, maxY);
  }

  const step = EDGE_EDGE_TRACK_SPACING;
  const searchRadius = Math.max(1, Math.ceil((maxY - minY) / step) + 2);
  const blockedNodes = Object.entries(pos).filter(([key]) => key !== descriptor.sourceKey && key !== descriptor.targetKey);
  const preferred = clamp(descriptor.trackY, minY, maxY);

  const isCandidateFree = (candidateY: number): boolean => {
    if (candidateY < minY || candidateY > maxY) {
      return false;
    }
    for (const [, node] of blockedNodes) {
      if (segmentIntersectsNode(candidateY, descriptor.startX, descriptor.endX, node, EDGE_NODE_CLEARANCE)) {
        return false;
      }
    }
    return true;
  };

  if (isCandidateFree(preferred)) {
    return preferred;
  }

  for (let radius = 1; radius <= searchRadius; radius += 1) {
    const upward = preferred - radius * step;
    if (isCandidateFree(upward)) {
      return upward;
    }
    const downward = preferred + radius * step;
    if (isCandidateFree(downward)) {
      return downward;
    }
  }

  return preferred;
}

export function routeElkEdges(edges: RoutedEdgeInput[], pos: Record<string, Position>): Record<string, DiagramEdgeGeometry> {
  const edgesByKey = new Map<string, RoutedEdgeInput>();
  const outgoingByNode = new Map<string, string[]>();
  const incomingByNode = new Map<string, string[]>();
  const attachmentCountByNode = new Map<string, number>();

  for (const edge of edges) {
    const source = pos[edge.from];
    const target = pos[edge.to];
    if (!source || !target) {
      continue;
    }
    edgesByKey.set(edge.key, edge);
    attachmentCountByNode.set(edge.from, (attachmentCountByNode.get(edge.from) ?? 0) + 1);
    attachmentCountByNode.set(edge.to, (attachmentCountByNode.get(edge.to) ?? 0) + 1);
    const outgoing = outgoingByNode.get(edge.from) ?? [];
    outgoing.push(edge.key);
    outgoingByNode.set(edge.from, outgoing);
    const incoming = incomingByNode.get(edge.to) ?? [];
    incoming.push(edge.key);
    incomingByNode.set(edge.to, incoming);
  }

  const sourceXByEdge = new Map<string, number>();
  for (const [nodeKey, edgeKeys] of outgoingByNode.entries()) {
    const node = pos[nodeKey];
    if (!node) {
      continue;
    }
    const sorted = [...edgeKeys].sort((leftKey, rightKey) => {
      const left = edgesByKey.get(leftKey);
      const right = edgesByKey.get(rightKey);
      if (!left || !right) {
        return leftKey.localeCompare(rightKey);
      }
      const leftTarget = pos[left.to];
      const rightTarget = pos[right.to];
      const leftX = (leftTarget?.x ?? 0) + (leftTarget?.w ?? 0) / 2;
      const rightX = (rightTarget?.x ?? 0) + (rightTarget?.w ?? 0) / 2;
      if (leftX !== rightX) {
        return leftX - rightX;
      }
      const leftY = (leftTarget?.y ?? 0) + (leftTarget?.h ?? 0) / 2;
      const rightY = (rightTarget?.y ?? 0) + (rightTarget?.h ?? 0) / 2;
      if (leftY !== rightY) {
        return leftY - rightY;
      }
      return leftKey.localeCompare(rightKey);
    });
    const center = node.x + node.w / 2 + SOURCE_ANCHOR_OFFSET;
    const min = node.x + node.w / 2 + 8;
    const max = node.x + node.w - 8;
    const slots = distributeSlots(center, sorted.length, 10, min, max);
    sorted.forEach((edgeKey, index) => {
      sourceXByEdge.set(edgeKey, slots[index]);
    });
  }

  const targetXByEdge = new Map<string, number>();
  for (const [nodeKey, edgeKeys] of incomingByNode.entries()) {
    const node = pos[nodeKey];
    if (!node) {
      continue;
    }
    const sorted = [...edgeKeys].sort((leftKey, rightKey) => {
      const left = edgesByKey.get(leftKey);
      const right = edgesByKey.get(rightKey);
      if (!left || !right) {
        return leftKey.localeCompare(rightKey);
      }
      const leftSource = pos[left.from];
      const rightSource = pos[right.from];
      const leftX = (leftSource?.x ?? 0) + (leftSource?.w ?? 0) / 2;
      const rightX = (rightSource?.x ?? 0) + (rightSource?.w ?? 0) / 2;
      if (leftX !== rightX) {
        return leftX - rightX;
      }
      const leftY = (leftSource?.y ?? 0) + (leftSource?.h ?? 0) / 2;
      const rightY = (rightSource?.y ?? 0) + (rightSource?.h ?? 0) / 2;
      if (leftY !== rightY) {
        return leftY - rightY;
      }
      return leftKey.localeCompare(rightKey);
    });
    const center = node.x + node.w / 2 - TARGET_ANCHOR_OFFSET;
    const min = node.x + 8;
    const max = node.x + node.w / 2 - 8;
    const slots = distributeSlots(center, sorted.length, 10, min, max);
    sorted.forEach((edgeKey, index) => {
      targetXByEdge.set(edgeKey, slots[index]);
    });
  }

  const descriptors: RoutedEdgeDescriptor[] = [];
  for (const edge of edgesByKey.values()) {
    const source = pos[edge.from];
    const target = pos[edge.to];
    if (!source || !target) {
      continue;
    }
    const sourceDefault = clamp(source.x + source.w / 2 + SOURCE_ANCHOR_OFFSET, source.x + source.w / 2 + 8, source.x + source.w - 8);
    const targetDefault = clamp(target.x + target.w / 2 - TARGET_ANCHOR_OFFSET, target.x + 8, target.x + target.w / 2 - 8);
    const descriptor = baseDescriptor(
      edge,
      pos,
      sourceXByEdge.get(edge.key) ?? sourceDefault,
      targetXByEdge.get(edge.key) ?? targetDefault,
      Math.max(attachmentCountByNode.get(edge.from) ?? 1, attachmentCountByNode.get(edge.to) ?? 1)
    );
    if (descriptor) {
      descriptors.push(descriptor);
    }
  }

  const verticalGroups = new Map<string, RoutedEdgeDescriptor[]>();
  const incomingVerticalCountByTarget = new Map<string, number>();
  const outgoingVerticalCountBySource = new Map<string, number>();
  for (const descriptor of descriptors) {
    if (!descriptor.sameRow) {
      incomingVerticalCountByTarget.set(
        descriptor.targetKey,
        (incomingVerticalCountByTarget.get(descriptor.targetKey) ?? 0) + 1
      );
      outgoingVerticalCountBySource.set(
        descriptor.sourceKey,
        (outgoingVerticalCountBySource.get(descriptor.sourceKey) ?? 0) + 1
      );
    }
  }
  for (const descriptor of descriptors) {
    if (descriptor.sameRow) {
      continue;
    }
    const fanInCount = incomingVerticalCountByTarget.get(descriptor.targetKey) ?? 0;
    const fanOutCount = outgoingVerticalCountBySource.get(descriptor.sourceKey) ?? 0;
    const key = fanInCount > 1
      ? `${descriptor.goDown ? 'd' : 'u'}:target:${descriptor.targetKey}`
      : fanOutCount > 1
        ? `${descriptor.goDown ? 'd' : 'u'}:source:${descriptor.sourceKey}`
        : `${descriptor.goDown ? 'd' : 'u'}:start:${Math.round(descriptor.startY)}`;
    const list = verticalGroups.get(key) ?? [];
    list.push(descriptor);
    verticalGroups.set(key, list);
  }
  for (const list of verticalGroups.values()) {
    list.sort(sharedSegmentComparator);
    const half = (list.length - 1) / 2;
    const snapDirection = list[0]?.goDown ? 'ceil' : 'floor';
    list.forEach((descriptor, index) => {
      const raw = descriptor.trackY + (index - half) * EDGE_EDGE_TRACK_SPACING;
      const min = Math.min(descriptor.minTrackY, descriptor.maxTrackY);
      const max = Math.max(descriptor.minTrackY, descriptor.maxTrackY);
      const adjusted = list.length > 1
        ? (snapDirection === 'ceil' ? Math.ceil(raw / 10) * 10 : Math.floor(raw / 10) * 10)
        : raw;
      descriptor.trackY = clamp(adjusted, min, max);
    });
  }

  const orderedVerticalGroups = [...verticalGroups.entries()].sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  for (const [, descriptorsInGroup] of orderedVerticalGroups) {
    const ordered = [...descriptorsInGroup].sort(sharedSegmentComparator);
    let previousTrackY = Number.NEGATIVE_INFINITY;
    for (const descriptor of ordered) {
      const minTrackY = Math.max(
        Math.min(descriptor.minTrackY, descriptor.maxTrackY),
        previousTrackY + EDGE_EDGE_TRACK_SPACING
      );
      const maxTrackY = Math.max(descriptor.minTrackY, descriptor.maxTrackY);
      descriptor.trackY = findNonOverlappingTrackY(descriptor, pos, minTrackY, maxTrackY);
      previousTrackY = descriptor.trackY;
    }
  }

  const sourceVerticalGroups = new Map<string, RoutedEdgeDescriptor[]>();
  for (const descriptor of descriptors) {
    if (descriptor.sameRow) {
      continue;
    }
    const key = `${descriptor.goDown ? 'd' : 'u'}:${descriptor.sourceKey}:${Math.round(descriptor.startY)}`;
    const list = sourceVerticalGroups.get(key) ?? [];
    list.push(descriptor);
    sourceVerticalGroups.set(key, list);
  }
  for (const list of sourceVerticalGroups.values()) {
    if (list.length <= 1) {
      continue;
    }
    const ordered = [...list].sort(sharedSegmentComparator);
    let nextTrackY = Math.floor(Math.min(...ordered.map((descriptor) => descriptor.trackY)) / EDGE_EDGE_TRACK_SPACING) * EDGE_EDGE_TRACK_SPACING;
    const hasSharedTargetConstraint = ordered.some(
      (descriptor) => (incomingVerticalCountByTarget.get(descriptor.targetKey) ?? 0) > 1
    );
    if (!ordered[0].goDown && hasSharedTargetConstraint) {
      nextTrackY -= EDGE_EDGE_TRACK_SPACING;
    }
    for (const descriptor of ordered) {
      const min = Math.min(descriptor.minTrackY, descriptor.maxTrackY);
      const max = Math.max(descriptor.minTrackY, descriptor.maxTrackY);
      descriptor.trackY = clamp(nextTrackY, min, max);
      nextTrackY = descriptor.trackY + EDGE_EDGE_TRACK_SPACING;
    }
  }

  const sameRowGroups = new Map<string, RoutedEdgeDescriptor[]>();
  for (const descriptor of descriptors) {
    if (!descriptor.sameRow) {
      continue;
    }
    const key = `${Math.round(descriptor.startY)}:${Math.round(descriptor.endY)}`;
    const list = sameRowGroups.get(key) ?? [];
    list.push(descriptor);
    sameRowGroups.set(key, list);
  }
  for (const list of sameRowGroups.values()) {
    list.sort(sharedSegmentComparator);
    const half = (list.length - 1) / 2;
    list.forEach((descriptor, index) => {
      descriptor.bendX += (index - half) * SAME_ROW_BEND_SPACING;
    });
  }

  const result: Record<string, DiagramEdgeGeometry> = {};
  for (const descriptor of descriptors) {
    let points: DiagramPoint[];
    if (descriptor.sameRow) {
      const startX = descriptor.source.x + descriptor.source.w;
      const endX = descriptor.target.x;
      const startY = clamp(descriptor.sourceMidY + SOURCE_ANCHOR_OFFSET, descriptor.source.y + 8, descriptor.source.y + descriptor.source.h - 8);
      const endY = clamp(descriptor.targetMidY - TARGET_ANCHOR_OFFSET, descriptor.target.y + 8, descriptor.target.y + descriptor.target.h - 8);
      const bendX = Math.max(startX + SAME_ROW_BEND_OFFSET, descriptor.bendX);
      points = [
        { x: startX, y: startY },
        { x: bendX, y: startY },
        { x: bendX, y: endY },
        { x: endX, y: endY }
      ];
    } else {
      points = [
        { x: descriptor.startX, y: descriptor.startY },
        { x: descriptor.startX, y: descriptor.trackY },
        { x: descriptor.endX, y: descriptor.trackY },
        { x: descriptor.endX, y: descriptor.endY }
      ];
    }
    const label = middlePoint(points);
    result[descriptor.key] = {
      d: routePolyline(points),
      labelX: label.x,
      labelY: label.y - 7,
      points
    };
  }

  return result;
}

export function routePolyline(points: DiagramPoint[]): string {
  if (points.length === 0) {
    return '';
  }
  const commands: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 1; index < points.length; index += 1) {
    commands.push(`L ${points[index].x} ${points[index].y}`);
  }
  return commands.join(' ');
}

export function middlePoint(points: DiagramPoint[]): DiagramPoint {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  const mid = Math.floor((points.length - 1) / 2);
  return points[mid];
}

export function routeForwardEdge(
  from: Position,
  to: Position,
  options?: { sourceAttachmentCount?: number; targetAttachmentCount?: number; routeIndex?: number }
): DiagramEdgeGeometry {
  const anchorOffset = 20;
  const sameRowCornerOffset = 20;
  const fromMidX = from.x + from.w / 2;
  const fromMidY = from.y + from.h / 2;
  const toMidX = to.x + to.w / 2;
  const toMidY = to.y + to.h / 2;
  const sameRow = Math.abs(fromMidY - toMidY) < 4;
  const points: DiagramPoint[] = [];

  if (sameRow) {
    const startX = from.x + from.w;
    const startY = Math.max(from.y + 8, Math.min(from.y + from.h - 8, fromMidY + anchorOffset));
    const endX = to.x;
    const endY = Math.max(to.y + 8, Math.min(to.y + to.h - 8, toMidY - anchorOffset));
    const bendX = Math.max(startX + sameRowCornerOffset, (startX + endX) / 2);
    points.push(
      { x: startX, y: startY },
      { x: bendX, y: startY },
      { x: bendX, y: endY },
      { x: endX, y: endY }
    );
  } else {
    const goDown = toMidY > fromMidY;
    const startX = Math.max(from.x + 8, Math.min(from.x + from.w - 8, fromMidX + anchorOffset));
    const startY = goDown ? from.y + from.h : from.y;
    const endX = Math.max(to.x + 8, Math.min(to.x + to.w - 8, toMidX - anchorOffset));
    const endY = goDown ? to.y : to.y + to.h;
    const sourceAttachmentCount = options?.sourceAttachmentCount ?? 1;
    const targetAttachmentCount = options?.targetAttachmentCount ?? 1;
    const density = Math.max(sourceAttachmentCount, targetAttachmentCount);
    const deltaY = Math.abs(endY - startY);
    const baseFirstLeg = Math.min(14, Math.max(10, deltaY * 0.06 + 8));
    const densityBias = Math.min(2, Math.max(0, density - 1) * 0.5);
    const firstLeg = Math.min(Math.max(8, deltaY - 8), baseFirstLeg + densityBias);
    const midY = goDown ? startY + firstLeg : startY - firstLeg;
    points.push(
      { x: startX, y: startY },
      { x: startX, y: midY },
      { x: endX, y: midY },
      { x: endX, y: endY }
    );
  }

  const label = middlePoint(points);
  return {
    d: routePolyline(points),
    labelX: label.x,
    labelY: label.y - 7,
    points
  };
}
