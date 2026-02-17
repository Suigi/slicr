import { DEFAULT_DSL } from './defaultDsl';

export const SLICES_STORAGE_KEY = 'slicr.slices';
export const LEGACY_DSL_STORAGE_KEY = 'slicr.dsl';

export type StoredSlice = {
  id: string;
  dsl: string;
};

export type SliceLibrary = {
  selectedSliceId: string;
  slices: StoredSlice[];
};

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
