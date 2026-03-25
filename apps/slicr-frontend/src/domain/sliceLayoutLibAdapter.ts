import type { LayoutRequest } from 'layout-lib';
import { buildElkLaneMeta } from './elkLayout';
import { DEFAULT_NODE_WIDTH, type NodeDimensions } from './nodeSizing';
import type { Parsed } from './types';

const DEFAULT_NODE_HEIGHT = 42;

export type SliceLayoutLibRequest = {
  request: LayoutRequest;
  laneByKey: Map<string, number>;
  rowStreamLabels: Record<number, string>;
};

export function buildSliceLayoutLibRequest(
  parsed: Parsed,
  nodeDimensions?: Record<string, NodeDimensions>
): SliceLayoutLibRequest {
  const { laneByKey, rowStreamLabels } = buildElkLaneMeta(parsed);
  const orderedLaneNumbers = [...new Set(laneByKey.values())].sort((a, b) => a - b);
  const groups = buildGroups(parsed);
  const groupIdByNodeKey = groups
    ? new Map(groups.flatMap((group) => group.nodeKeys.map((nodeKey) => [nodeKey, group.id] as const)))
    : null;

  return {
    request: {
      nodes: [...parsed.nodes.values()].map((node) => ({
        id: node.key,
        laneId: `lane-${laneByKey.get(node.key) ?? 0}`,
        groupId: groupIdByNodeKey?.get(node.key),
        width: normalizeDimension(nodeDimensions?.[node.key]?.width),
        height: normalizeDimension(nodeDimensions?.[node.key]?.height)
      })),
      edges: parsed.edges.map((edge, index) => ({
        id: `${edge.from}->${edge.to}#${index}`,
        sourceId: edge.from,
        targetId: edge.to
      })),
      lanes: orderedLaneNumbers.map((lane) => ({
        id: `lane-${lane}`,
        order: lane
      })),
      groups: groups?.map(({ id, order }) => ({ id, order })),
      defaults: {
        nodeWidth: DEFAULT_NODE_WIDTH,
        nodeHeight: DEFAULT_NODE_HEIGHT
      },
      spacing: {
        laneMargin: 24,
        laneGap: 44,
        groupGap: 80,
        minTargetShift: 20,
        minNodeGap: 40
      }
    },
    laneByKey,
    rowStreamLabels
  };
}

function buildGroups(parsed: Parsed): Array<{ id: string; order: number; nodeKeys: string[] }> | undefined {
  if (parsed.boundaries.length === 0 || parsed.nodes.size === 0) {
    return undefined;
  }

  const boundaryAfterKeys = new Set(parsed.boundaries.map((boundary) => boundary.after));
  const groups: Array<{ id: string; order: number; nodeKeys: string[] }> = [];
  let currentGroupIndex = 0;
  let currentGroup = createGroup(currentGroupIndex);

  for (const node of parsed.nodes.values()) {
    currentGroup.nodeKeys.push(node.key);
    if (boundaryAfterKeys.has(node.key)) {
      groups.push(currentGroup);
      currentGroupIndex += 1;
      currentGroup = createGroup(currentGroupIndex);
    }
  }

  if (currentGroup.nodeKeys.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function createGroup(index: number) {
  return {
    id: `group-${index}`,
    order: index,
    nodeKeys: [] as string[]
  };
}

function normalizeDimension(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : undefined;
}
