import {Events, type DomainEvent} from '../domain/events';
import type {NodeType} from './types';

export type ImportEventsResult =
  | {ok: true, events: DomainEvent[]}
  | {ok: false, error: string};

export function serializeDomainEvents(events: readonly DomainEvent[]): string {
  return JSON.stringify(events);
}

export function parseImportEvents(input: string): ImportEventsResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return {ok: false, error: 'Import must be valid JSON.'};
  }

  if (Array.isArray(parsed) && parsed.every(isDomainEvent)) {
    return {ok: true, events: parsed};
  }

  if (isLegacyGraphSnapshot(parsed)) {
    return {ok: true, events: legacySnapshotToEvents(parsed)};
  }

  return {ok: false, error: 'Import must be an exported event array or a legacy graph snapshot.'};
}

function isDomainEvent(event: unknown): event is DomainEvent {
  if (!event || typeof event !== 'object') {
    return false;
  }

  const candidate = event as Partial<DomainEvent>;
  return (
    typeof candidate.type === 'string' &&
    isKnownEventType(candidate.type) &&
    isEventPayload(candidate.type, candidate.payload) &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every((tag) => typeof tag === 'string')
  );
}

function isKnownEventType(type: string): type is DomainEvent['type'] {
  return (
    type === 'NodeAdded' ||
    type === 'NodeRenamed' ||
    type === 'NodeRemoved' ||
    type === 'NodeTypeChanged' ||
    type === 'NodesConnected' ||
    type === 'NodesDisconnected'
  );
}

function isEventPayload(type: DomainEvent['type'], payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  switch (type) {
    case 'NodeAdded':
      return (
        typeof candidate.nodeId === 'string' &&
        isNodeType(candidate.type) &&
        typeof candidate.laneId === 'number' &&
        typeof candidate.label === 'string'
      );
    case 'NodeRenamed':
      return typeof candidate.nodeId === 'string' && typeof candidate.newName === 'string';
    case 'NodeRemoved':
      return typeof candidate.nodeId === 'string';
    case 'NodeTypeChanged':
      return typeof candidate.nodeId === 'string' && isNodeType(candidate.newType);
    case 'NodesConnected':
      return (
        typeof candidate.sourceNodeId === 'string' &&
        typeof candidate.targetNodeId === 'string' &&
        (candidate.role === 'flow' || candidate.role === 'back-reference')
      );
    case 'NodesDisconnected':
      return typeof candidate.sourceNodeId === 'string' && typeof candidate.targetNodeId === 'string';
  }
}

type LegacyGraphSnapshot = {
  nodes: LegacyGraphNode[];
  edges: LegacyEdge[];
  lanes: unknown[];
};

type LegacyGraphNode = {
  id: string;
  label: string;
  type: NodeType;
  laneId: string;
};

type LegacyEdge = {
  sourceId: string;
  targetId: string;
  role?: 'flow' | 'back-reference';
};

function isLegacyGraphSnapshot(snapshot: unknown): snapshot is LegacyGraphSnapshot {
  if (!snapshot || typeof snapshot !== 'object') {
    return false;
  }

  const candidate = snapshot as Partial<LegacyGraphSnapshot>;
  return (
    Array.isArray(candidate.nodes) &&
    candidate.nodes.every(isLegacyGraphNode) &&
    Array.isArray(candidate.edges) &&
    candidate.edges.every(isLegacyEdge) &&
    Array.isArray(candidate.lanes)
  );
}

function isLegacyGraphNode(node: unknown): node is LegacyGraphNode {
  if (!node || typeof node !== 'object') {
    return false;
  }

  const candidate = node as Partial<LegacyGraphNode>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    isNodeType(candidate.type) &&
    typeof candidate.laneId === 'string' &&
    legacyLaneOrder(candidate.laneId) !== null
  );
}

function isLegacyEdge(edge: unknown): edge is LegacyEdge {
  if (!edge || typeof edge !== 'object') {
    return false;
  }

  const candidate = edge as Partial<LegacyEdge>;
  return (
    typeof candidate.sourceId === 'string' &&
    typeof candidate.targetId === 'string' &&
    (candidate.role === undefined || candidate.role === 'flow' || candidate.role === 'back-reference')
  );
}

function isNodeType(type: unknown): type is NodeType {
  return type === 'ui' || type === 'cmd' || type === 'evt' || type === 'rm' || type === 'dm' || type === 'processor';
}

function legacySnapshotToEvents(snapshot: LegacyGraphSnapshot): DomainEvent[] {
  const nodeIds = new Set(snapshot.nodes.map((node) => node.id));
  return [
    ...snapshot.nodes.map((node) => Events.nodeAdded(node.id, node.type, legacyLaneOrder(node.laneId) ?? 0, node.label)),
    ...snapshot.edges
      .filter((edge) => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId))
      .map((edge) => Events.nodesConnected(edge.sourceId, edge.targetId, edge.role)),
  ];
}

function legacyLaneOrder(laneId: string): number | null {
  const match = /^lane-(\d+)$/.exec(laneId);
  return match ? Number(match[1]) : null;
}
