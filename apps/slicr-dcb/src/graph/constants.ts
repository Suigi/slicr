import type { LaneInput } from 'layout-lib';

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 86;

export const ARROW_LENGTH = 18;
export const ARROW_WIDTH = 16;

export const laneIdForOrder = (order: number) => `lane-${order}`;

export const initialLane: LaneInput = { id: laneIdForOrder(0), order: 0 };
