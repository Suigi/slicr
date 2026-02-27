import { DEFAULT_DSL } from './defaultDsl';
import { appendSliceEvent, hydrateSliceProjection, loadSliceEvents } from './sliceEventStore';

export const SLICES_STORAGE_KEY = 'slicr.slices';
export const LEGACY_DSL_STORAGE_KEY = 'slicr.dsl';
export const SLICES_LAYOUT_STORAGE_KEY = 'slicr.sliceLayout';
export const SLICES_EVENT_INDEX_STORAGE_KEY = 'slicr.es.v1.index';
export const APP_SELECTION_STREAM_STORAGE_KEY = 'slicr.es.v1.stream.app';

export type StoredSlice = {
  id: string;
  dsl: string;
};

export type SliceLibrary = {
  selectedSliceId: string;
  slices: StoredSlice[];
};

export type SliceLayoutPoint = { x: number; y: number };
export type SliceLayoutOverrides = {
  nodes: Record<string, SliceLayoutPoint>;
  edges: Record<string, SliceLayoutPoint[]>;
};
type SaveLayoutOptions = {
  emitEvents?: boolean;
};
type StoredSliceLayoutMap = Record<string, SliceLayoutOverrides>;
type StoredEventIndex = {
  selectedSliceId?: string;
  sliceIds: string[];
};
type AppSelectionEvent = {
  id: string;
  version: number;
  at: string;
  type: 'slice-selected';
  payload: {
    selectedSliceId: string;
  };
};

function emptyLayoutOverrides(): SliceLayoutOverrides {
  return { nodes: {}, edges: {} };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function asLayoutPoint(value: unknown): SliceLayoutPoint | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const point = value as { x?: unknown; y?: unknown };
  if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
    return null;
  }
  return { x: point.x, y: point.y };
}

function asSliceLayoutOverrides(value: unknown): SliceLayoutOverrides | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const maybe = value as { nodes?: unknown; edges?: unknown };
  if (!maybe.nodes || typeof maybe.nodes !== 'object' || !maybe.edges || typeof maybe.edges !== 'object') {
    return null;
  }

  const nodes: Record<string, SliceLayoutPoint> = {};
  for (const [key, rawPos] of Object.entries(maybe.nodes as Record<string, unknown>)) {
    const parsedPoint = asLayoutPoint(rawPos);
    if (parsedPoint) {
      nodes[key] = parsedPoint;
    }
  }

  const edges: Record<string, SliceLayoutPoint[]> = {};
  for (const [key, rawPoints] of Object.entries(maybe.edges as Record<string, unknown>)) {
    if (!Array.isArray(rawPoints)) {
      continue;
    }
    const points = rawPoints
      .map((rawPoint) => asLayoutPoint(rawPoint))
      .filter((point): point is SliceLayoutPoint => point !== null);
    if (points.length > 0) {
      edges[key] = points;
    }
  }

  return { nodes, edges };
}

function loadLayoutMap(): StoredSliceLayoutMap {
  try {
    const raw = localStorage.getItem(SLICES_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    const map: StoredSliceLayoutMap = {};
    for (const [sliceId, rawOverrides] of Object.entries(parsed as Record<string, unknown>)) {
      const overrides = asSliceLayoutOverrides(rawOverrides);
      if (overrides) {
        map[sliceId] = overrides;
      }
    }
    return map;
  } catch {
    return {};
  }
}

function hasLayoutOverrides(overrides: SliceLayoutOverrides): boolean {
  return Object.keys(overrides.nodes).length > 0 || Object.keys(overrides.edges).length > 0;
}

function hasLayoutEvents(sliceId: string): boolean {
  return loadSliceEvents(sliceId).some(
    (event) => event.type === 'node-moved' || event.type === 'edge-moved' || event.type === 'layout-reset'
  );
}

function getProjectedDslFromEvents(events: ReturnType<typeof loadSliceEvents>): string {
  let dsl = '';
  for (const event of events) {
    if (event.type === 'slice-created') {
      dsl = event.payload.initialDsl;
      continue;
    }
    if (event.type === 'text-edited') {
      dsl = event.payload.dsl;
    }
  }
  return dsl;
}

function migrateLegacyLayoutOverrides(sliceId: string): SliceLayoutOverrides | null {
  const map = loadLayoutMap();
  const legacy = map[sliceId];
  if (!legacy || !hasLayoutOverrides(legacy)) {
    return null;
  }

  appendSliceLayoutResetEvent(sliceId);
  for (const [nodeKey, point] of Object.entries(legacy.nodes)) {
    appendSliceNodeMovedEvent(sliceId, nodeKey, point);
  }
  for (const [edgeKey, points] of Object.entries(legacy.edges)) {
    appendSliceEdgeMovedEvent(sliceId, edgeKey, points);
  }
  return legacy;
}

function equalPoints(a: SliceLayoutPoint[] | undefined, b: SliceLayoutPoint[] | undefined): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) {
      return false;
    }
  }
  return true;
}

export function loadSliceLayoutOverrides(sliceId: string): SliceLayoutOverrides {
  if (hasLayoutEvents(sliceId)) {
    const projection = hydrateSliceProjection(sliceId);
    return {
      nodes: projection.manualNodePositions,
      edges: projection.manualEdgePoints
    };
  }
  const migrated = migrateLegacyLayoutOverrides(sliceId);
  if (migrated) {
    return migrated;
  }
  return emptyLayoutOverrides();
}

export function appendSliceNodeMovedEvent(sliceId: string, nodeKey: string, point: SliceLayoutPoint): void {
  appendSliceEvent(sliceId, {
    type: 'node-moved',
    payload: { nodeKey, x: point.x, y: point.y }
  });
}

export function appendSliceEdgeMovedEvent(sliceId: string, edgeKey: string, points: SliceLayoutPoint[]): void {
  appendSliceEvent(sliceId, {
    type: 'edge-moved',
    payload: { edgeKey, points }
  });
}

export function appendSliceLayoutResetEvent(sliceId: string): void {
  appendSliceEvent(sliceId, { type: 'layout-reset', payload: {} });
}

export function appendSliceCreatedEvent(sliceId: string, initialDsl: string): void {
  appendSliceEvent(sliceId, {
    type: 'slice-created',
    payload: { initialDsl }
  });
}

export function appendSliceSelectedEvent(sliceId: string): void {
  appendSliceEvent(sliceId, {
    type: 'slice-selected',
    payload: { selectedSliceId: sliceId }
  });
}

function asAppSelectionEvent(value: unknown): AppSelectionEvent | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
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
    || maybe.type !== 'slice-selected'
    || !maybe.payload
    || typeof maybe.payload !== 'object'
  ) {
    return null;
  }
  const payload = maybe.payload as { selectedSliceId?: unknown };
  if (typeof payload.selectedSliceId !== 'string' || payload.selectedSliceId.length === 0) {
    return null;
  }
  return {
    id: maybe.id,
    version: maybe.version,
    at: maybe.at,
    type: 'slice-selected',
    payload: {
      selectedSliceId: payload.selectedSliceId
    }
  };
}

function loadAppSelectedEvents(): AppSelectionEvent[] {
  try {
    const raw = localStorage.getItem(APP_SELECTION_STREAM_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((event) => asAppSelectionEvent(event))
      .filter((event): event is AppSelectionEvent => event !== null)
      .sort((a, b) => a.version - b.version);
  } catch {
    return [];
  }
}

function makeEventId(): string {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function appendAppSelectedEvent(sliceId: string): void {
  const existing = loadAppSelectedEvents();
  const nextVersion = existing.length === 0 ? 1 : existing[existing.length - 1].version + 1;
  const event: AppSelectionEvent = {
    id: makeEventId(),
    version: nextVersion,
    at: new Date().toISOString(),
    type: 'slice-selected',
    payload: {
      selectedSliceId: sliceId
    }
  };
  localStorage.setItem(APP_SELECTION_STREAM_STORAGE_KEY, JSON.stringify([...existing, event]));
}

export function saveSliceLayoutOverrides(
  sliceId: string,
  overrides: SliceLayoutOverrides,
  options: SaveLayoutOptions = {}
): void {
  if (options.emitEvents === false) {
    return;
  }

  const currentProjection = hydrateSliceProjection(sliceId);
  const currentOverrides = {
    nodes: currentProjection.manualNodePositions,
    edges: currentProjection.manualEdgePoints
  };
  const desiredHasOverrides = hasLayoutOverrides(overrides);
  const currentHasOverrides = hasLayoutOverrides(currentOverrides);

  const removedNodeKeys = Object.keys(currentOverrides.nodes).filter((key) => !Object.prototype.hasOwnProperty.call(overrides.nodes, key));
  const removedEdgeKeys = Object.keys(currentOverrides.edges).filter((key) => !Object.prototype.hasOwnProperty.call(overrides.edges, key));
  if ((removedNodeKeys.length > 0 || removedEdgeKeys.length > 0) && desiredHasOverrides) {
    appendSliceLayoutResetEvent(sliceId);
    for (const [nodeKey, point] of Object.entries(overrides.nodes)) {
      appendSliceNodeMovedEvent(sliceId, nodeKey, point);
    }
    for (const [edgeKey, points] of Object.entries(overrides.edges)) {
      appendSliceEdgeMovedEvent(sliceId, edgeKey, points);
    }
  } else if (!desiredHasOverrides && currentHasOverrides) {
    appendSliceLayoutResetEvent(sliceId);
  } else if (desiredHasOverrides) {
    for (const [nodeKey, point] of Object.entries(overrides.nodes)) {
      const current = currentOverrides.nodes[nodeKey];
      if (!current || current.x !== point.x || current.y !== point.y) {
        appendSliceNodeMovedEvent(sliceId, nodeKey, point);
      }
    }
    for (const [edgeKey, points] of Object.entries(overrides.edges)) {
      const current = currentOverrides.edges[edgeKey];
      if (!equalPoints(current, points)) {
        appendSliceEdgeMovedEvent(sliceId, edgeKey, points);
      }
    }
  }
}

export function getSliceNameFromDsl(dsl: string): string {
  const match = dsl.match(/^\s*slice\s+"([^"]+)"/m);
  if (match?.[1]) {
    return match[1];
  }
  return 'Untitled';
}

function makeSliceId(): string {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `slice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function asLibrary(value: unknown): SliceLibrary | null {
  if (!value || typeof value !== 'object') return null;

  const maybeLibrary = value as { selectedSliceId?: unknown; slices?: unknown };
  if (!Array.isArray(maybeLibrary.slices) || maybeLibrary.slices.length === 0) {
    return null;
  }

  const slices: StoredSlice[] = [];
  const seenIds = new Set<string>();
  for (const maybeSlice of maybeLibrary.slices) {
    if (!maybeSlice || typeof maybeSlice !== 'object') continue;
    const slice = maybeSlice as { id?: unknown; dsl?: unknown };
    if (typeof slice.dsl !== 'string') {
      continue;
    }

    let id = typeof slice.id === 'string' && slice.id.length > 0 ? slice.id : makeSliceId();
    while (seenIds.has(id)) {
      id = makeSliceId();
    }
    seenIds.add(id);

    slices.push({ id, dsl: slice.dsl });
  }

  if (slices.length === 0) {
    return null;
  }

  const selectedSliceId =
    typeof maybeLibrary.selectedSliceId === 'string' && slices.some((slice) => slice.id === maybeLibrary.selectedSliceId)
      ? maybeLibrary.selectedSliceId
      : slices[0].id;

  return { selectedSliceId, slices };
}

function asEventIndex(value: unknown): StoredEventIndex | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const maybe = value as { selectedSliceId?: unknown; sliceIds?: unknown };
  if (!Array.isArray(maybe.sliceIds) || maybe.sliceIds.length === 0) {
    return null;
  }
  const sliceIds = maybe.sliceIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (sliceIds.length === 0) {
    return null;
  }
  return {
    selectedSliceId: typeof maybe.selectedSliceId === 'string' ? maybe.selectedSliceId : undefined,
    sliceIds
  };
}

function deriveSelectedSliceIdFromLegacySliceEvents(sliceIds: string[]): string | null {
  let latest: { selectedSliceId: string; at: string; version: number } | null = null;

  for (const sliceId of sliceIds) {
    const selectedEvents = loadSliceEvents(sliceId).filter((event) => event.type === 'slice-selected');
    for (const event of selectedEvents) {
      if (!latest) {
        latest = { selectedSliceId: event.payload.selectedSliceId, at: event.at, version: event.version };
        continue;
      }

      const prevTs = Number.isNaN(Date.parse(latest.at)) ? 0 : Date.parse(latest.at);
      const nextTs = Number.isNaN(Date.parse(event.at)) ? 0 : Date.parse(event.at);
      if (nextTs > prevTs || (nextTs === prevTs && event.version >= latest.version)) {
        latest = { selectedSliceId: event.payload.selectedSliceId, at: event.at, version: event.version };
      }
    }
  }

  return latest?.selectedSliceId ?? null;
}

function deriveSelectedSliceIdFromAppEvents(sliceIds: string[]): string | null {
  const validIds = new Set(sliceIds);
  const latestSelected = [...loadAppSelectedEvents()]
    .reverse()
    .find((event) => validIds.has(event.payload.selectedSliceId));
  return latestSelected?.payload.selectedSliceId ?? null;
}

function deriveSelectedSliceId(sliceIds: string[]): string | null {
  const selectedFromAppStream = deriveSelectedSliceIdFromAppEvents(sliceIds);
  if (selectedFromAppStream) {
    return selectedFromAppStream;
  }
  return deriveSelectedSliceIdFromLegacySliceEvents(sliceIds);
}

function migrateMapsDslToUses(dsl: string): string {
  return dsl.replace(/^(\s*)maps:(\s*)$/gm, '$1uses:$2');
}

function migrateSliceMapsKeyword(slice: StoredSlice): StoredSlice {
  const migratedDsl = migrateMapsDslToUses(slice.dsl);
  if (migratedDsl === slice.dsl) {
    return slice;
  }

  appendSliceEvent(slice.id, {
    type: 'text-edited',
    payload: { dsl: migratedDsl }
  });
  return { ...slice, dsl: migratedDsl };
}

function migrateLibraryMapsKeyword(library: SliceLibrary): SliceLibrary {
  let didChange = false;
  const slices = library.slices.map((slice) => {
    const migrated = migrateSliceMapsKeyword(slice);
    if (migrated !== slice) {
      didChange = true;
    }
    return migrated;
  });

  if (!didChange) {
    return library;
  }
  return {
    ...library,
    slices
  };
}

function writeEventIndex(sliceIds: string[]): void {
  localStorage.setItem(
    SLICES_EVENT_INDEX_STORAGE_KEY,
    JSON.stringify({
      sliceIds
    })
  );
}

function migrateLegacyLibraryToEvents(library: SliceLibrary): void {
  localStorage.removeItem(SLICES_STORAGE_KEY);
  localStorage.removeItem(LEGACY_DSL_STORAGE_KEY);
  writeEventIndex(library.slices.map((slice) => slice.id));

  for (const slice of library.slices) {
    const events = loadSliceEvents(slice.id);
    const projectedDsl = getProjectedDslFromEvents(events);
    if (!events.some((event) => event.type === 'slice-created')) {
      appendSliceCreatedEvent(slice.id, projectedDsl || slice.dsl);
    } else if (!events.some((event) => event.type === 'text-edited') && !projectedDsl) {
      appendSliceEvent(slice.id, {
        type: 'text-edited',
        payload: { dsl: slice.dsl }
      });
    }
  }

  const selectedFromEvents = deriveSelectedSliceId(library.slices.map((slice) => slice.id));
  if (selectedFromEvents !== library.selectedSliceId) {
    appendAppSelectedEvent(library.selectedSliceId);
  }
}

function loadSliceLibraryFromEventIndex(): SliceLibrary | null {
  try {
    const raw = localStorage.getItem(SLICES_EVENT_INDEX_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const index = asEventIndex(JSON.parse(raw));
    if (!index) {
      return null;
    }

    const slices = index.sliceIds
      .map((sliceId) => {
        const events = loadSliceEvents(sliceId);
        if (events.length === 0) {
          return null;
        }
        return { id: sliceId, dsl: getProjectedDslFromEvents(events) };
      })
      .filter((slice): slice is StoredSlice => Boolean(slice));

    if (slices.length === 0) {
      return null;
    }

    const selectedFromEvents = deriveSelectedSliceId(slices.map((slice) => slice.id));
    const selectedSliceId = selectedFromEvents && slices.some((slice) => slice.id === selectedFromEvents)
      ? selectedFromEvents
      : slices[0].id;

    return { selectedSliceId, slices };
  } catch {
    return null;
  }
}

export function createInitialLibrary(defaultDsl = DEFAULT_DSL): SliceLibrary {
  const id = makeSliceId();
  return {
    selectedSliceId: id,
    slices: [{ id, dsl: defaultDsl }]
  };
}

export function loadSliceLibrary(defaultDsl = DEFAULT_DSL): SliceLibrary {
  const eventLibrary = loadSliceLibraryFromEventIndex();
  if (eventLibrary) {
    return migrateLibraryMapsKeyword(eventLibrary);
  }

  try {
    const stored = localStorage.getItem(SLICES_STORAGE_KEY);
    if (stored) {
      const parsed = asLibrary(JSON.parse(stored));
      if (parsed) {
        migrateLegacyLibraryToEvents(parsed);
        const migrated = loadSliceLibraryFromEventIndex();
        if (migrated) {
          return migrateLibraryMapsKeyword(migrated);
        }
      }
    }
  } catch {
    // Ignore storage errors and fall back.
  }

  try {
    const legacyDsl = localStorage.getItem(LEGACY_DSL_STORAGE_KEY);
    if (legacyDsl) {
      const migrated = createInitialLibrary(legacyDsl);
      migrateLegacyLibraryToEvents(migrated);
      const fromEvents = loadSliceLibraryFromEventIndex();
      if (fromEvents) {
        return migrateLibraryMapsKeyword(fromEvents);
      }
      return migrated;
    }
  } catch {
    // Ignore storage errors and fall back.
  }

  return createInitialLibrary(defaultDsl);
}

export function saveSliceLibrary(library: SliceLibrary): void {
  localStorage.removeItem(SLICES_STORAGE_KEY);
  localStorage.removeItem(LEGACY_DSL_STORAGE_KEY);
  writeEventIndex(library.slices.map((slice) => slice.id));
  for (const slice of library.slices) {
    const events = loadSliceEvents(slice.id);
    let projectedDsl = getProjectedDslFromEvents(events);
    if (!events.some((event) => event.type === 'slice-created')) {
      const initialDsl = projectedDsl || slice.dsl;
      appendSliceCreatedEvent(slice.id, initialDsl);
      projectedDsl = initialDsl;
    }
    if (projectedDsl !== slice.dsl) {
      appendSliceEvent(slice.id, {
        type: 'text-edited',
        payload: { dsl: slice.dsl }
      });
    }
  }

  const selectedFromEvents = deriveSelectedSliceId(library.slices.map((slice) => slice.id));
  if (selectedFromEvents !== library.selectedSliceId) {
    appendAppSelectedEvent(library.selectedSliceId);
  }
}

function nextUntitledName(existingNames: string[]): string {
  if (!existingNames.includes('Untitled')) {
    return 'Untitled';
  }

  for (let i = 2; i < 10_000; i++) {
    const candidate = `Untitled ${i}`;
    if (!existingNames.includes(candidate)) {
      return candidate;
    }
  }
  return `Untitled ${Date.now()}`;
}

export function createSliceDsl(name: string): string {
  return `slice "${name}"\n\n`;
}

export function addNewSlice(library: SliceLibrary): SliceLibrary {
  const name = nextUntitledName(library.slices.map((slice) => getSliceNameFromDsl(slice.dsl)));
  const id = makeSliceId();
  const newSlice: StoredSlice = { id, dsl: createSliceDsl(name) };
  return {
    selectedSliceId: id,
    slices: [...library.slices, newSlice]
  };
}

export function selectSlice(library: SliceLibrary, id: string): SliceLibrary {
  if (!library.slices.some((slice) => slice.id === id)) {
    return library;
  }
  return { ...library, selectedSliceId: id };
}

export function updateSelectedSliceDsl(library: SliceLibrary, dsl: string): SliceLibrary {
  return {
    ...library,
    slices: library.slices.map((slice) => (slice.id === library.selectedSliceId ? { ...slice, dsl } : slice))
  };
}
