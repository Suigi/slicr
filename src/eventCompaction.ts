type AppProjectCreatedEvent = {
  id: string;
  version: number;
  at: string;
  type: 'project-created';
  payload: { projectId: string; name: string };
};

type AppProjectSelectedEvent = {
  id: string;
  version: number;
  at: string;
  type: 'project-selected';
  payload: { projectId: string };
};

type AppSliceAddedEvent = {
  id: string;
  version: number;
  at: string;
  type: 'slice-added-to-project';
  payload: { projectId: string; sliceId: string };
};

type AppSliceSelectedEvent = {
  id: string;
  version: number;
  at: string;
  type: 'slice-selected';
  payload: { projectId: string; selectedSliceId: string };
};

type AppEvent = AppProjectCreatedEvent | AppProjectSelectedEvent | AppSliceAddedEvent | AppSliceSelectedEvent;

type SliceTextEditedEvent = {
  id: string;
  sliceId: string;
  version: number;
  at: string;
  type: 'text-edited';
  payload: { dsl: string };
};

type SliceNodeMovedEvent = {
  id: string;
  sliceId: string;
  version: number;
  at: string;
  type: 'node-moved';
  payload: { nodeKey: string; x: number; y: number };
};

type SliceEdgeMovedEvent = {
  id: string;
  sliceId: string;
  version: number;
  at: string;
  type: 'edge-moved';
  payload: { edgeKey: string; points: Array<{ x: number; y: number }> };
};

type SliceLayoutResetEvent = {
  id: string;
  sliceId: string;
  version: number;
  at: string;
  type: 'layout-reset';
  payload: Record<string, never>;
};

type SliceCreatedEvent = {
  id: string;
  sliceId: string;
  version: number;
  at: string;
  type: 'slice-created';
  payload: { initialDsl: string };
};

type SliceSelectedEvent = {
  id: string;
  sliceId: string;
  version: number;
  at: string;
  type: 'slice-selected';
  payload: { selectedSliceId: string };
};

type SliceEvent =
  | SliceTextEditedEvent
  | SliceNodeMovedEvent
  | SliceEdgeMovedEvent
  | SliceLayoutResetEvent
  | SliceCreatedEvent
  | SliceSelectedEvent;

type WriteEntry = {
  key: string;
  events: Array<Record<string, unknown>>;
};

export type CompactionPlan = {
  write: WriteEntry[];
  remove: string[];
};

export type EventCountByType = Record<string, number>;

export type StorageKeyDelta = {
  key: string;
  beforeBytes: number;
  afterBytes: number;
  deltaBytes: number;
};

export type CompactionPreview = {
  beforeBytes: number;
  afterBytes: number;
  reclaimedBytes: number;
  beforeEventCounts: EventCountByType;
  afterEventCounts: EventCountByType;
  keyDeltas: StorageKeyDelta[];
  plan: CompactionPlan;
};

export type CompactionResult = {
  beforeBytes: number;
  afterBytes: number;
  reclaimedBytes: number;
  writtenKeys: string[];
  removedKeys: string[];
  keyDeltas: StorageKeyDelta[];
};

const APP_STREAM_KEY = 'slicr.es.v1.stream.app';
const STREAM_KEY_PREFIX = 'slicr.es.v1.stream.';
const SNAPSHOT_KEY_PREFIX = 'slicr.es.v1.snapshot.';
const LEGACY_V1_INDEX_KEY = 'slicr.es.v1.index';
const LEGACY_PROJECT_INDEX_KEY = 'slicr.es.v2.projects.index';
const LEGACY_V2_PROJECT_PREFIX = 'slicr.es.v2.project.';
const DEFAULT_PROJECT_ID = 'default';
const DEFAULT_PROJECT_NAME = 'Default';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readRawObjectArray(storage: Storage, key: string): Array<Record<string, unknown>> {
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'));
  } catch {
    return [];
  }
}

function parseAppEvent(value: Record<string, unknown>): AppEvent | null {
  const maybe = value as {
    id?: unknown;
    version?: unknown;
    at?: unknown;
    type?: unknown;
    payload?: unknown;
  };
  if (
    typeof maybe.id !== 'string'
    || !isFiniteNumber(maybe.version)
    || typeof maybe.at !== 'string'
    || typeof maybe.type !== 'string'
    || !maybe.payload
    || typeof maybe.payload !== 'object'
  ) {
    return null;
  }

  if (maybe.type === 'project-created') {
    const payload = maybe.payload as { projectId?: unknown; name?: unknown };
    if (typeof payload.projectId !== 'string' || payload.projectId.length === 0 || typeof payload.name !== 'string' || payload.name.length === 0) {
      return null;
    }
    return { id: maybe.id, version: maybe.version, at: maybe.at, type: 'project-created', payload: { projectId: payload.projectId, name: payload.name } };
  }
  if (maybe.type === 'project-selected') {
    const payload = maybe.payload as { projectId?: unknown };
    if (typeof payload.projectId !== 'string' || payload.projectId.length === 0) {
      return null;
    }
    return { id: maybe.id, version: maybe.version, at: maybe.at, type: 'project-selected', payload: { projectId: payload.projectId } };
  }
  if (maybe.type === 'slice-added-to-project') {
    const payload = maybe.payload as { projectId?: unknown; sliceId?: unknown };
    if (typeof payload.projectId !== 'string' || payload.projectId.length === 0 || typeof payload.sliceId !== 'string' || payload.sliceId.length === 0) {
      return null;
    }
    return {
      id: maybe.id,
      version: maybe.version,
      at: maybe.at,
      type: 'slice-added-to-project',
      payload: { projectId: payload.projectId, sliceId: payload.sliceId }
    };
  }
  if (maybe.type === 'slice-selected') {
    const payload = maybe.payload as { projectId?: unknown; selectedSliceId?: unknown };
    if (
      typeof payload.projectId !== 'string'
      || payload.projectId.length === 0
      || typeof payload.selectedSliceId !== 'string'
      || payload.selectedSliceId.length === 0
    ) {
      return null;
    }
    return {
      id: maybe.id,
      version: maybe.version,
      at: maybe.at,
      type: 'slice-selected',
      payload: { projectId: payload.projectId, selectedSliceId: payload.selectedSliceId }
    };
  }

  return null;
}

function parsePoint(value: unknown): { x: number; y: number } | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const maybe = value as { x?: unknown; y?: unknown };
  if (!isFiniteNumber(maybe.x) || !isFiniteNumber(maybe.y)) {
    return null;
  }
  return { x: maybe.x, y: maybe.y };
}

function parseSliceEvent(value: Record<string, unknown>): SliceEvent | null {
  const maybe = value as {
    id?: unknown;
    sliceId?: unknown;
    version?: unknown;
    at?: unknown;
    type?: unknown;
    payload?: unknown;
  };
  if (
    typeof maybe.id !== 'string'
    || typeof maybe.sliceId !== 'string'
    || !isFiniteNumber(maybe.version)
    || typeof maybe.at !== 'string'
    || typeof maybe.type !== 'string'
    || !maybe.payload
    || typeof maybe.payload !== 'object'
  ) {
    return null;
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
      .map((point) => parsePoint(point))
      .filter((point): point is { x: number; y: number } => point !== null);
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
  if (maybe.type === 'slice-selected') {
    const payload = maybe.payload as { selectedSliceId?: unknown };
    if (typeof payload.selectedSliceId !== 'string' || payload.selectedSliceId.length === 0) {
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

function sortedByVersion<T extends { version: number }>(events: T[]): T[] {
  return [...events].sort((a, b) => a.version - b.version);
}

function makeEventId(): string {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function countEventTypes(events: Array<{ type: string }>): EventCountByType {
  const counts: EventCountByType = {};
  for (const event of events) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
  }
  return counts;
}

function collectStorageKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key) {
      keys.push(key);
    }
  }
  return keys;
}

function readSliceEvents(storage: Storage, sliceId: string): SliceEvent[] {
  return sortedByVersion(
    readRawObjectArray(storage, `${STREAM_KEY_PREFIX}${sliceId}`)
      .map((event) => parseSliceEvent(event))
      .filter((event): event is SliceEvent => event !== null)
  );
}

function projectSliceState(events: SliceEvent[]): {
  dsl: string;
  nodes: Record<string, { x: number; y: number }>;
  edges: Record<string, Array<{ x: number; y: number }>>;
} {
  let dsl = '';
  let nodes: Record<string, { x: number; y: number }> = {};
  let edges: Record<string, Array<{ x: number; y: number }>> = {};
  for (const event of events) {
    if (event.type === 'slice-created') {
      dsl = event.payload.initialDsl;
      continue;
    }
    if (event.type === 'text-edited') {
      dsl = event.payload.dsl;
      continue;
    }
    if (event.type === 'layout-reset') {
      nodes = {};
      edges = {};
      continue;
    }
    if (event.type === 'node-moved') {
      nodes[event.payload.nodeKey] = { x: event.payload.x, y: event.payload.y };
      continue;
    }
    if (event.type === 'edge-moved') {
      edges[event.payload.edgeKey] = event.payload.points.map((point) => ({ ...point }));
    }
  }
  return { dsl, nodes, edges };
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildCanonicalAppEvents(
  projectOrder: string[],
  projectNames: Map<string, string>,
  selectedProjectId: string,
  projectSlices: Map<string, string[]>,
  selectedSliceByProject: Map<string, string>
): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  let version = 1;
  const at = nowIso();
  for (const projectId of projectOrder) {
    events.push({
      id: makeEventId(),
      version: version++,
      at,
      type: 'project-created',
      payload: { projectId, name: projectNames.get(projectId) ?? projectId }
    });
  }
  events.push({
    id: makeEventId(),
    version: version++,
    at,
    type: 'project-selected',
    payload: { projectId: selectedProjectId }
  });
  for (const projectId of projectOrder) {
    for (const sliceId of projectSlices.get(projectId) ?? []) {
      events.push({
        id: makeEventId(),
        version: version++,
        at,
        type: 'slice-added-to-project',
        payload: { projectId, sliceId }
      });
    }
  }
  for (const projectId of projectOrder) {
    const selectedSliceId = selectedSliceByProject.get(projectId);
    if (!selectedSliceId) {
      continue;
    }
    events.push({
      id: makeEventId(),
      version: version++,
      at,
      type: 'slice-selected',
      payload: { projectId, selectedSliceId }
    });
  }
  return events;
}

function buildCanonicalSliceEvents(
  sliceId: string,
  dsl: string,
  nodes: Record<string, { x: number; y: number }>,
  edges: Record<string, Array<{ x: number; y: number }>>
): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  let version = 1;
  const at = nowIso();
  events.push({
    id: makeEventId(),
    sliceId,
    version: version++,
    at,
    type: 'slice-created',
    payload: { initialDsl: dsl }
  });
  for (const nodeKey of Object.keys(nodes).sort((a, b) => a.localeCompare(b))) {
    const point = nodes[nodeKey];
    events.push({
      id: makeEventId(),
      sliceId,
      version: version++,
      at,
      type: 'node-moved',
      payload: { nodeKey, x: point.x, y: point.y }
    });
  }
  for (const edgeKey of Object.keys(edges).sort((a, b) => a.localeCompare(b))) {
    const points = edges[edgeKey] ?? [];
    events.push({
      id: makeEventId(),
      sliceId,
      version: version++,
      at,
      type: 'edge-moved',
      payload: { edgeKey, points }
    });
  }
  return events;
}

function valueBytes(value: string | null): number {
  return value?.length ?? 0;
}

export function analyzeEventCompaction(storage: Storage): CompactionPreview {
  const keys = collectStorageKeys(storage);
  const appEvents = sortedByVersion(
    readRawObjectArray(storage, APP_STREAM_KEY)
      .map((event) => parseAppEvent(event))
      .filter((event): event is AppEvent => event !== null)
  );

  const projectOrder: string[] = [];
  const projectNames = new Map<string, string>();
  for (const event of appEvents) {
    if (event.type !== 'project-created') {
      continue;
    }
    if (!projectNames.has(event.payload.projectId)) {
      projectOrder.push(event.payload.projectId);
    }
    projectNames.set(event.payload.projectId, event.payload.name);
  }
  if (!projectNames.has(DEFAULT_PROJECT_ID)) {
    projectNames.set(DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME);
    projectOrder.unshift(DEFAULT_PROJECT_ID);
  }
  if (projectOrder.length === 0) {
    projectOrder.push(DEFAULT_PROJECT_ID);
  }

  const projectSlices = new Map<string, string[]>();
  for (const projectId of projectOrder) {
    projectSlices.set(projectId, []);
  }
  const seenByProject = new Map<string, Set<string>>();
  for (const event of appEvents) {
    if (event.type !== 'slice-added-to-project') {
      continue;
    }
    if (!projectSlices.has(event.payload.projectId)) {
      continue;
    }
    const seen = seenByProject.get(event.payload.projectId) ?? new Set<string>();
    if (!seen.has(event.payload.sliceId)) {
      seen.add(event.payload.sliceId);
      seenByProject.set(event.payload.projectId, seen);
      projectSlices.get(event.payload.projectId)?.push(event.payload.sliceId);
    }
  }

  if ([...projectSlices.values()].every((ids) => ids.length === 0)) {
    const fallbackSliceIds = keys
      .filter((key) => key.startsWith(STREAM_KEY_PREFIX) && key !== APP_STREAM_KEY)
      .map((key) => key.slice(STREAM_KEY_PREFIX.length))
      .filter((sliceId) => sliceId.length > 0)
      .sort((a, b) => a.localeCompare(b));
    projectSlices.set(DEFAULT_PROJECT_ID, fallbackSliceIds);
  }

  const selectedProjectEvents = appEvents.filter((event): event is AppProjectSelectedEvent => event.type === 'project-selected');
  const selectedProjectId = [...selectedProjectEvents]
    .reverse()
    .find((event) => projectNames.has(event.payload.projectId))
    ?.payload.projectId ?? projectOrder[0];

  const selectedSliceByProject = new Map<string, string>();
  for (const projectId of projectOrder) {
    const validSlices = new Set(projectSlices.get(projectId) ?? []);
    const selected = [...appEvents]
      .reverse()
      .find((event): event is AppSliceSelectedEvent => (
        event.type === 'slice-selected'
        && event.payload.projectId === projectId
        && validSlices.has(event.payload.selectedSliceId)
      ))
      ?.payload.selectedSliceId;
    if (selected) {
      selectedSliceByProject.set(projectId, selected);
    } else {
      const first = projectSlices.get(projectId)?.[0];
      if (first) {
        selectedSliceByProject.set(projectId, first);
      }
    }
  }

  const retainedSliceIds = new Set<string>();
  for (const ids of projectSlices.values()) {
    for (const sliceId of ids) {
      retainedSliceIds.add(sliceId);
    }
  }

  const write: WriteEntry[] = [];
  const nextAppEvents = buildCanonicalAppEvents(projectOrder, projectNames, selectedProjectId, projectSlices, selectedSliceByProject);
  write.push({ key: APP_STREAM_KEY, events: nextAppEvents });

  for (const sliceId of [...retainedSliceIds].sort((a, b) => a.localeCompare(b))) {
    const projection = projectSliceState(readSliceEvents(storage, sliceId));
    const nextSliceEvents = buildCanonicalSliceEvents(sliceId, projection.dsl, projection.nodes, projection.edges);
    write.push({ key: `${STREAM_KEY_PREFIX}${sliceId}`, events: nextSliceEvents });
  }

  const writtenKeys = new Set(write.map((entry) => entry.key));
  const remove = new Set<string>();
  for (const key of keys) {
    if (key.startsWith(SNAPSHOT_KEY_PREFIX)) {
      remove.add(key);
      continue;
    }
    if (key === LEGACY_V1_INDEX_KEY || key === LEGACY_PROJECT_INDEX_KEY || key.startsWith(LEGACY_V2_PROJECT_PREFIX)) {
      remove.add(key);
      continue;
    }
    if (key.startsWith(STREAM_KEY_PREFIX) && !writtenKeys.has(key)) {
      remove.add(key);
    }
  }

  const beforeBytes = keys.reduce((sum, key) => sum + key.length + valueBytes(storage.getItem(key)), 0);
  const afterBytes = keys.reduce((sum, key) => {
    if (remove.has(key)) {
      return sum;
    }
    const rewrite = write.find((entry) => entry.key === key);
    if (!rewrite) {
      return sum + key.length + valueBytes(storage.getItem(key));
    }
    return sum + key.length + JSON.stringify(rewrite.events).length;
  }, 0) + write
    .filter((entry) => !keys.includes(entry.key))
    .reduce((sum, entry) => sum + entry.key.length + JSON.stringify(entry.events).length, 0);

  const beforeEventCounts = countEventTypes([
    ...appEvents,
    ...[...retainedSliceIds].flatMap((sliceId) => readSliceEvents(storage, sliceId))
  ]);
  const afterEventCounts = countEventTypes(write.flatMap((entry) => entry.events as Array<{ type: string }>));

  const keyDeltas: StorageKeyDelta[] = [
    ...write.map((entry) => {
      const before = valueBytes(storage.getItem(entry.key));
      const after = JSON.stringify(entry.events).length;
      return {
        key: entry.key,
        beforeBytes: before,
        afterBytes: after,
        deltaBytes: after - before
      };
    }),
    ...[...remove]
      .filter((key) => !writtenKeys.has(key))
      .map((key) => {
        const before = valueBytes(storage.getItem(key));
        return {
          key,
          beforeBytes: before,
          afterBytes: 0,
          deltaBytes: -before
        };
      })
  ].sort((a, b) => a.key.localeCompare(b.key));

  return {
    beforeBytes,
    afterBytes,
    reclaimedBytes: Math.max(0, beforeBytes - afterBytes),
    beforeEventCounts,
    afterEventCounts,
    keyDeltas,
    plan: {
      write,
      remove: [...remove].sort((a, b) => a.localeCompare(b))
    }
  };
}

export function executeEventCompaction(storage: Storage, plan: CompactionPlan): CompactionResult {
  const keys = collectStorageKeys(storage);
  const beforeBytes = keys.reduce((sum, key) => sum + key.length + valueBytes(storage.getItem(key)), 0);
  const beforeByKey = new Map(keys.map((key) => [key, valueBytes(storage.getItem(key))]));

  for (const entry of plan.write) {
    storage.setItem(entry.key, JSON.stringify(entry.events));
  }
  for (const key of plan.remove) {
    storage.removeItem(key);
  }

  const nextKeys = collectStorageKeys(storage);
  const afterBytes = nextKeys.reduce((sum, key) => sum + key.length + valueBytes(storage.getItem(key)), 0);
  const allDeltaKeys = new Set<string>([
    ...plan.write.map((entry) => entry.key),
    ...plan.remove
  ]);
  const keyDeltas = [...allDeltaKeys]
    .map((key) => {
      const before = beforeByKey.get(key) ?? 0;
      const after = valueBytes(storage.getItem(key));
      return {
        key,
        beforeBytes: before,
        afterBytes: after,
        deltaBytes: after - before
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    beforeBytes,
    afterBytes,
    reclaimedBytes: Math.max(0, beforeBytes - afterBytes),
    writtenKeys: plan.write.map((entry) => entry.key),
    removedKeys: [...plan.remove],
    keyDeltas
  };
}
