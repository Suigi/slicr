import { Position } from './types';

export function edgePath(from: Position, to: Position) {
  const fromMidX = from.x + from.w / 2;
  const fromMidY = from.y + from.h / 2;
  const toMidX = to.x + to.w / 2;
  const toMidY = to.y + to.h / 2;
  const sameRow = Math.abs(from.y - to.y) < 4;

  if (sameRow) {
    const x1 = from.x + from.w;
    const y1 = fromMidY;
    const x2 = to.x;
    const y2 = toMidY;
    const cx = (x1 + x2) / 2;

    return {
      d: `M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`,
      labelX: cx,
      labelY: y1 - 7
    };
  }

  const goDown = to.y > from.y;
  const x1 = fromMidX;
  const y1 = goDown ? from.y + from.h : from.y;
  const x2 = toMidX;
  const y2 = goDown ? to.y : to.y + to.h;
  const cy = (y1 + y2) / 2;

  return {
    d: `M ${x1} ${y1} C ${x1} ${cy} ${x2} ${cy} ${x2} ${y2}`,
    labelX: (x1 + x2) / 2 + 6,
    labelY: cy
  };
}
