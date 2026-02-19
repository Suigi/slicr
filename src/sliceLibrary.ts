import { DEFAULT_DSL } from './defaultDsl';

export const SLICES_STORAGE_KEY = 'slicr.slices';
export const LEGACY_DSL_STORAGE_KEY = 'slicr.dsl';
export const SLICES_LAYOUT_STORAGE_KEY = 'slicr.sliceLayout';

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
type StoredSliceLayoutMap = Record<string, SliceLayoutOverrides>;

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

export function loadSliceLayoutOverrides(sliceId: string): SliceLayoutOverrides {
  const map = loadLayoutMap();
  return map[sliceId] ?? emptyLayoutOverrides();
}

export function saveSliceLayoutOverrides(sliceId: string, overrides: SliceLayoutOverrides): void {
  try {
    const map = loadLayoutMap();
    if (hasLayoutOverrides(overrides)) {
      map[sliceId] = overrides;
    } else {
      delete map[sliceId];
    }
    localStorage.setItem(SLICES_LAYOUT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage failures and keep in-memory state.
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

export function createInitialLibrary(defaultDsl = DEFAULT_DSL): SliceLibrary {
  const id = makeSliceId();
  return {
    selectedSliceId: id,
    slices: [{ id, dsl: defaultDsl }]
  };
}

export function loadSliceLibrary(defaultDsl = DEFAULT_DSL): SliceLibrary {
  try {
    const stored = localStorage.getItem(SLICES_STORAGE_KEY);
    if (stored) {
      const parsed = asLibrary(JSON.parse(stored));
      if (parsed) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage errors and fall back.
  }

  try {
    const legacyDsl = localStorage.getItem(LEGACY_DSL_STORAGE_KEY);
    if (legacyDsl) {
      return createInitialLibrary(legacyDsl);
    }
  } catch {
    // Ignore storage errors and fall back.
  }

  return createInitialLibrary(defaultDsl);
}

export function saveSliceLibrary(library: SliceLibrary): void {
  localStorage.setItem(SLICES_STORAGE_KEY, JSON.stringify(library));
  localStorage.removeItem(LEGACY_DSL_STORAGE_KEY);
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
