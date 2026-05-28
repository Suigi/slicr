import type { LaneInput } from 'layout-lib';
import { ARROW_LENGTH, ARROW_WIDTH, laneIdForOrder } from './constants';
import type { AddDirection, NodeType, Point } from './types';

function removeConsecutiveDuplicatePoints(points: Point[]) {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });
}

export function getRoundedPath(points: Point[], radius = 6) {
  const normalizedPoints = removeConsecutiveDuplicatePoints(points);
  const first = normalizedPoints[0];
  if (!first) {
    return '';
  }

  let path = `M ${first.x} ${first.y}`;

  for (let index = 1; index < normalizedPoints.length; index += 1) {
    const previous = normalizedPoints[index - 1];
    const current = normalizedPoints[index];
    const next = normalizedPoints[index + 1];

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

export function getArrowRenderPoints(points: Point[]) {
  const normalizedPoints = removeConsecutiveDuplicatePoints(points);
  const tip = normalizedPoints[normalizedPoints.length - 1];
  const previous = normalizedPoints[normalizedPoints.length - 2];
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
    linePoints: [...normalizedPoints.slice(0, -1), base],
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

export function getLaneOrder(lanes: LaneInput[], laneId: string) {
  return lanes.find((lane) => lane.id === laneId)?.order ?? 0;
}

export function ensureLane(lanes: LaneInput[], order: number) {
  if (lanes.some((lane) => lane.order === order)) {
    return lanes;
  }

  return [...lanes, { id: laneIdForOrder(order), order }];
}

export function getSuccessorNodeType(sourceType: NodeType, direction: AddDirection): NodeType {
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

export function getKeyboardSuccessorDirection(sourceType: NodeType): AddDirection {
  return sourceType === 'ui' || sourceType === 'cmd' ? 'bottom' : 'top';
}

export function getKeyboardSuccessorNodeType(sourceType: NodeType): NodeType {
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
