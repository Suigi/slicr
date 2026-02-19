import type { Position } from './types';

export type DiagramPoint = { x: number; y: number };

export type DiagramEdgeGeometry = {
  d: string;
  labelX: number;
  labelY: number;
  points?: DiagramPoint[];
};

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
