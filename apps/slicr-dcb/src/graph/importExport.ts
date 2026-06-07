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
    type === 'NodeSchemaChanged' ||
    type === 'NodeExampleValuesChanged' ||
    type === 'NodesConnected' ||
    type === 'NodesDisconnected' ||
    type === 'ProjectAdded' ||
    type === 'ProjectRenamed' ||
    type === 'ChapterAdded' ||
    type === 'ChapterRenamed'
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
    case 'NodeSchemaChanged':
      return typeof candidate.nodeId === 'string' && Array.isArray(candidate.schema) && candidate.schema.every(isNodePropertySchema);
    case 'NodeExampleValuesChanged':
      return (
        typeof candidate.nodeId === 'string' &&
        Array.isArray(candidate.exampleValues) &&
        candidate.exampleValues.every(isNodePropertyExampleValues)
      );
    case 'NodesConnected':
      return (
        typeof candidate.sourceNodeId === 'string' &&
        typeof candidate.targetNodeId === 'string' &&
        (candidate.role === 'flow' || candidate.role === 'back-reference')
      );
    case 'NodesDisconnected':
      return typeof candidate.sourceNodeId === 'string' && typeof candidate.targetNodeId === 'string';
    case 'ProjectAdded':
      return typeof candidate.projectId === 'string' && typeof candidate.name === 'string';
    case 'ProjectRenamed':
      return typeof candidate.projectId === 'string' && typeof candidate.newName === 'string';
    case 'ChapterAdded':
      return (
        typeof candidate.projectId === 'string' &&
        typeof candidate.chapterId === 'string' &&
        typeof candidate.title === 'string'
      );
    case 'ChapterRenamed':
      return (
        typeof candidate.projectId === 'string' &&
        typeof candidate.chapterId === 'string' &&
        typeof candidate.newTitle === 'string'
      );
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

function isNodePropertySchema(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') {
    return false;
  }

  const candidate = schema as Record<string, unknown>;
  return (
    typeof candidate.propertyId === 'string' &&
    typeof candidate.name === 'string' &&
    isPropertyType(candidate.type) &&
    (candidate.list === undefined || typeof candidate.list === 'boolean') &&
    (candidate.optional === undefined || typeof candidate.optional === 'boolean') &&
    (candidate.generated === undefined || typeof candidate.generated === 'boolean') &&
    (candidate.properties === undefined ||
      (candidate.type === 'Object' && Array.isArray(candidate.properties) && candidate.properties.every(isNodePropertySchema)))
  );
}

function isPropertyType(type: unknown): boolean {
  return type === 'string' || type === 'number' || type === 'boolean' || type === 'Object';
}

function isNodePropertyExampleValues(exampleValues: unknown): boolean {
  if (!exampleValues || typeof exampleValues !== 'object') {
    return false;
  }

  const candidate = exampleValues as Record<string, unknown>;
  return (
    typeof candidate.propertyId === 'string' &&
    (candidate.scalarValue === undefined || isNodeExamplePrimitive(candidate.scalarValue)) &&
    (candidate.scalarListValues === undefined ||
      (Array.isArray(candidate.scalarListValues) && candidate.scalarListValues.every(isNodeExamplePrimitive))) &&
    (candidate.complexValue === undefined || isNodeComplexExampleValue(candidate.complexValue)) &&
    (candidate.complexListValues === undefined ||
      (Array.isArray(candidate.complexListValues) && candidate.complexListValues.every(isNodeComplexExampleValue)))
  );
}

function isNodeExamplePrimitive(value: unknown): boolean {
  return typeof value === 'string' || value === null;
}

function isNodeComplexExampleValue(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((nestedValue) => (
    isNodeExamplePrimitive(nestedValue) || isNodeComplexExampleValue(nestedValue)
  ));
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
