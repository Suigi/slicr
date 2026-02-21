import type { DiagramPoint } from './domain/diagramRouting';
import { parseDsl } from './domain/parseDsl';

const EVENT_STREAM_KEY_PREFIX = 'slicr.es.v1.stream.';
const SNAPSHOT_KEY_PREFIX = 'slicr.es.v1.snapshot.';
const SNAPSHOT_INTERVAL = 100;

type BaseSliceEvent = {
  id: string;
  sliceId: string;
  version: number;
  at: string;
};

export type TextEditedEvent = BaseSliceEvent & {
  type: 'text-edited';
  payload: { dsl: string };
};

export type NodeMovedEvent = BaseSliceEvent & {
  type: 'node-moved';
  payload: { nodeKey: string; x: number; y: number };
};

export type EdgeMovedEvent = BaseSliceEvent & {
  type: 'edge-moved';
  payload: { edgeKey: string; points: DiagramPoint[] };
};

export type LayoutResetEvent = BaseSliceEvent & {
  type: 'layout-reset';
  payload: Record<string, never>;
};

export type SliceCreatedEvent = BaseSliceEvent & {
  type: 'slice-created';
  payload: { initialDsl: string };
};

export type SliceSelectedEvent = BaseSliceEvent & {
  type: 'slice-selected';
  payload: { selectedSliceId: string };
};

export type SliceEvent =
  | TextEditedEvent
  | NodeMovedEvent
  | EdgeMovedEvent
  | LayoutResetEvent
  | SliceCreatedEvent
  | SliceSelectedEvent;

export type SliceProjection = {
  dsl: string;
  manualNodePositions: Record<string, { x: number; y: number }>;
  manualEdgePoints: Record<string, DiagramPoint[]>;
};

export type SliceProjectionSnapshot = {
  version: number;
  projection: SliceProjection;
};

export function createEmptyProjection(): SliceProjection {
  return {
    dsl: '',
    manualNodePositions: {},
    manualEdgePoints: {}
  };
}

function streamStorageKey(sliceId: string): string {
  return `${EVENT_STREAM_KEY_PREFIX}${sliceId}`;
}

function snapshotStorageKey(sliceId: string): string {
  return `${SNAPSHOT_KEY_PREFIX}${sliceId}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function asPoint(value: unknown): DiagramPoint | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const maybe = value as { x?: unknown; y?: unknown };
  if (!isFiniteNumber(maybe.x) || !isFiniteNumber(maybe.y)) {
    return null;
  }
  return { x: maybe.x, y: maybe.y };
}

function parseSliceEvent(value: unknown): SliceEvent | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const maybe = value as {
    id?: unknown;
    sliceId?: unknown;
    version?: unknown;
    at?: unknown;
    type?: unknown;
    payload?: unknown;
  };

  if (
    typeof maybe.id !== 'string' ||
    typeof maybe.sliceId !== 'string' ||
    !isFiniteNumber(maybe.version) ||
    typeof maybe.at !== 'string' ||
    typeof maybe.type !== 'string' ||
    !maybe.payload ||
    typeof maybe.payload !== 'object'
  ) {
    return null;
  }

  if (maybe.type === 'text-edited') {
    const payload = maybe.payload as { dsl?: unknown };
    if (typeof payload.dsl !== 'string') {
      return null;
    }
    return {
      id: maybe.id,
      sliceId: maybe.sliceId,
      version: maybe.version,
      at: maybe.at,
      type: 'text-edited',
      payload: { dsl: payload.dsl }
    };
  }

  if (maybe.type === 'node-moved') {
    const payload = maybe.payload as { nodeKey?: unknown; x?: unknown; y?: unknown };
    if (typeof payload.nodeKey !== 'string' || !isFiniteNumber(payload.x) || !isFiniteNumber(payload.y)) {
      return null;
    }
    return {
      id: maybe.id,
      sliceId: maybe.sliceId,
      version: maybe.version,
      at: maybe.at,
      type: 'node-moved',
      payload: { nodeKey: payload.nodeKey, x: payload.x, y: payload.y }
    };
  }

  if (maybe.type === 'edge-moved') {
    const payload = maybe.payload as { edgeKey?: unknown; points?: unknown };
    if (typeof payload.edgeKey !== 'string' || !Array.isArray(payload.points)) {
      return null;
    }
    const points = payload.points
      .map((point) => asPoint(point))
      .filter((point): point is DiagramPoint => point !== null);
    if (points.length !== payload.points.length) {
      return null;
    }
    return {
      id: maybe.id,
      sliceId: maybe.sliceId,
      version: maybe.version,
      at: maybe.at,
      type: 'edge-moved',
      payload: { edgeKey: payload.edgeKey, points }
    };
  }

  if (maybe.type === 'layout-reset') {
    return {
      id: maybe.id,
      sliceId: maybe.sliceId,
      version: maybe.version,
      at: maybe.at,
      type: 'layout-reset',
      payload: {}
    };
  }

  if (maybe.type === 'slice-created') {
    const payload = maybe.payload as { initialDsl?: unknown };
    if (typeof payload.initialDsl !== 'string') {
      return null;
    }
    return {
      id: maybe.id,
      sliceId: maybe.sliceId,
      version: maybe.version,
      at: maybe.at,
      type: 'slice-created',
      payload: { initialDsl: payload.initialDsl }
    };
  }

  if (maybe.type === 'slice-selected') {
    const payload = maybe.payload as { selectedSliceId?: unknown };
    if (typeof payload.selectedSliceId !== 'string') {
      return null;
    }
    return {
      id: maybe.id,
      sliceId: maybe.sliceId,
      version: maybe.version,
      at: maybe.at,
      type: 'slice-selected',
      payload: { selectedSliceId: payload.selectedSliceId }
    };
  }

  return null;
}

function parseProjection(value: unknown): SliceProjection | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const maybe = value as { dsl?: unknown; manualNodePositions?: unknown; manualEdgePoints?: unknown };
  if (typeof maybe.dsl !== 'string' || !maybe.manualNodePositions || !maybe.manualEdgePoints) {
    return null;
  }
  if (typeof maybe.manualNodePositions !== 'object' || typeof maybe.manualEdgePoints !== 'object') {
    return null;
  }

  const manualNodePositions: Record<string, { x: number; y: number }> = {};
  for (const [nodeKey, rawPoint] of Object.entries(maybe.manualNodePositions as Record<string, unknown>)) {
    const point = asPoint(rawPoint);
    if (!point) {
      return null;
    }
    manualNodePositions[nodeKey] = point;
  }

  const manualEdgePoints: Record<string, DiagramPoint[]> = {};
  for (const [edgeKey, rawPoints] of Object.entries(maybe.manualEdgePoints as Record<string, unknown>)) {
    if (!Array.isArray(rawPoints)) {
      return null;
    }
    const points = rawPoints
      .map((rawPoint) => asPoint(rawPoint))
      .filter((point): point is DiagramPoint => point !== null);
    if (points.length !== rawPoints.length) {
      return null;
    }
    manualEdgePoints[edgeKey] = points;
  }

  return {
    dsl: maybe.dsl,
    manualNodePositions,
    manualEdgePoints
  };
}

function parseSnapshot(value: unknown): SliceProjectionSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const maybe = value as { version?: unknown; projection?: unknown };
  if (!isFiniteNumber(maybe.version)) {
    return null;
  }
  const projection = parseProjection(maybe.projection);
  if (!projection) {
    return null;
  }
  return {
    version: maybe.version,
    projection
  };
}

function loadRawEvents(sliceId: string): SliceEvent[] {
  try {
    const raw = localStorage.getItem(streamStorageKey(sliceId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((value) => parseSliceEvent(value))
      .filter((event): event is SliceEvent => event !== null)
      .sort((a, b) => a.version - b.version);
  } catch {
    return [];
  }
}

export function loadSliceEvents(sliceId: string): SliceEvent[] {
  return loadRawEvents(sliceId);
}

export function loadSliceProjectionSnapshot(sliceId: string): SliceProjectionSnapshot | null {
  try {
    const raw = localStorage.getItem(snapshotStorageKey(sliceId));
    if (!raw) {
      return null;
    }
    return parseSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSliceProjectionSnapshot(sliceId: string, snapshot: SliceProjectionSnapshot): void {
  localStorage.setItem(snapshotStorageKey(sliceId), JSON.stringify(snapshot));
}

function nextVersion(events: SliceEvent[]): number {
  if (events.length === 0) {
    return 1;
  }
  return Math.max(...events.map((event) => event.version)) + 1;
}

function makeEventId(): string {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function appendSliceEvent(
  sliceId: string,
  input:
    | { type: 'text-edited'; at?: string; payload: TextEditedEvent['payload'] }
    | { type: 'node-moved'; at?: string; payload: NodeMovedEvent['payload'] }
    | { type: 'edge-moved'; at?: string; payload: EdgeMovedEvent['payload'] }
    | { type: 'layout-reset'; at?: string; payload: LayoutResetEvent['payload'] }
    | { type: 'slice-created'; at?: string; payload: SliceCreatedEvent['payload'] }
    | { type: 'slice-selected'; at?: string; payload: SliceSelectedEvent['payload'] }
): SliceEvent {
  const existing = loadRawEvents(sliceId);
  const event: SliceEvent = {
    id: makeEventId(),
    sliceId,
    version: nextVersion(existing),
    at: input.at ?? new Date().toISOString(),
    type: input.type,
    payload: input.payload
  } as SliceEvent;

  const next = [...existing, event];
  localStorage.setItem(streamStorageKey(sliceId), JSON.stringify(next));
  if (event.version % SNAPSHOT_INTERVAL === 0) {
    saveSliceProjectionSnapshot(sliceId, {
      version: event.version,
      projection: foldSliceEvents(next)
    });
  }
  return event;
}

export function applySliceEvent(projection: SliceProjection, event: SliceEvent): SliceProjection {
  if (event.type === 'text-edited') {
    let manualNodePositions = projection.manualNodePositions;
    let manualEdgePoints = projection.manualEdgePoints;
    try {
      const parsed = parseDsl(event.payload.dsl);
      const validNodes = new Set(parsed.nodes.keys());
      const validEdges = new Set(parsed.edges.map((edge, index) => `${edge.from}->${edge.to}#${index}`));
      manualNodePositions = Object.fromEntries(
        Object.entries(projection.manualNodePositions).filter(([nodeKey]) => validNodes.has(nodeKey))
      );
      manualEdgePoints = Object.fromEntries(
        Object.entries(projection.manualEdgePoints).filter(([edgeKey]) => validEdges.has(edgeKey))
      );
    } catch {
      // Keep existing manual overrides if DSL cannot be parsed.
    }

    return {
      ...projection,
      dsl: event.payload.dsl,
      manualNodePositions,
      manualEdgePoints
    };
  }

  if (event.type === 'node-moved') {
    return {
      ...projection,
      manualNodePositions: {
        ...projection.manualNodePositions,
        [event.payload.nodeKey]: {
          x: event.payload.x,
          y: event.payload.y
        }
      }
    };
  }

  if (event.type === 'edge-moved') {
    return {
      ...projection,
      manualEdgePoints: {
        ...projection.manualEdgePoints,
        [event.payload.edgeKey]: event.payload.points.map((point) => ({ ...point }))
      }
    };
  }

  if (event.type === 'slice-created') {
    return {
      ...projection,
      dsl: event.payload.initialDsl
    };
  }

  if (event.type === 'slice-selected') {
    return projection;
  }

  return {
    ...projection,
    manualNodePositions: {},
    manualEdgePoints: {}
  };
}

export function foldSliceEvents(events: SliceEvent[], initialProjection = createEmptyProjection()): SliceProjection {
  return [...events]
    .sort((a, b) => a.version - b.version)
    .reduce((projection, event) => applySliceEvent(projection, event), initialProjection);
}

export function hydrateSliceProjection(sliceId: string): SliceProjection {
  const snapshot = loadSliceProjectionSnapshot(sliceId);
  const baseProjection = snapshot?.projection ?? createEmptyProjection();
  const fromVersion = snapshot?.version ?? 0;
  const events = loadRawEvents(sliceId).filter((event) => event.version > fromVersion);
  return foldSliceEvents(events, baseProjection);
}
