import { Position } from './types';

export const EDGE_ANCHOR_OFFSET = 12;

export function edgePath(from: Position, to: Position) {
  const anchorOffset = Math.min(EDGE_ANCHOR_OFFSET, from.w / 4, to.w / 4);
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
  const x1 = fromMidX + anchorOffset;
  const y1 = goDown ? from.y + from.h : from.y;
  const x2 = toMidX - anchorOffset;
  const y2 = goDown ? to.y : to.y + to.h;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const c1x = x1 + Math.round(dx * 0.2);
  const c1y = y1 + Math.round(dy * 0.45);
  const c2x = x2 - Math.round(dx * 0.2);
  const c2y = y2 - Math.round(dy * 0.45);
  const labelY = (y1 + y2) / 2;

  return {
    d: `M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`,
    labelX: (x1 + x2) / 2 + 6,
    labelY
  };
}
