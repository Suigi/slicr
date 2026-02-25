export const RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY = 'slicr.flag.renderEngineDropdown';
export const DRAG_AND_DROP_FLAG_STORAGE_KEY = 'slicr.flag.dragAndDrop';
export const CROSS_SLICE_DATA_FLAG_STORAGE_KEY = 'slicr.flag.crossSliceData';
export const DIAGRAM_RENDERER_FLAG_STORAGE_KEY = 'slicr.flag.diagramRenderer';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export type DiagramRendererId = 'dom-svg' | 'dom-svg-camera';

function parseStoredFlag(value: string | null): boolean | null {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return null;
}

function parseStoredRendererId(value: string | null): DiagramRendererId | null {
  if (value === 'dom-svg' || value === 'dom-svg-camera') {
    return value;
  }
  return null;
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function readFlag(hostname: string, storageKey: string, storage: StorageLike | null = defaultStorage()): boolean {
  const defaultValue = hostname === 'localhost';
  if (!storage) {
    return defaultValue;
  }
  try {
    const stored = parseStoredFlag(storage.getItem(storageKey));
    if (stored !== null) {
      return stored;
    }
    storage.setItem(storageKey, defaultValue ? 'true' : 'false');
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

export function shouldShowDevDiagramControls(hostname: string, storage?: StorageLike | null): boolean {
  return readFlag(hostname, RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY, storage);
}

export function isDragAndDropEnabled(hostname: string, storage?: StorageLike | null): boolean {
  return readFlag(hostname, DRAG_AND_DROP_FLAG_STORAGE_KEY, storage);
}

export function isCrossSliceDataEnabled(hostname: string, storage?: StorageLike | null): boolean {
  return readFlag(hostname, CROSS_SLICE_DATA_FLAG_STORAGE_KEY, storage);
}

export function getDiagramRendererId(_hostname: string, storage: StorageLike | null = defaultStorage()): DiagramRendererId {
  const defaultValue: DiagramRendererId = 'dom-svg-camera';
  if (!storage) {
    return defaultValue;
  }
  try {
    const stored = parseStoredRendererId(storage.getItem(DIAGRAM_RENDERER_FLAG_STORAGE_KEY));
    if (stored !== null) {
      return stored;
    }
    storage.setItem(DIAGRAM_RENDERER_FLAG_STORAGE_KEY, defaultValue);
    return defaultValue;
  } catch {
    return defaultValue;
  }
}
