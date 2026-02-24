import { describe, expect, it } from 'vitest';
import {
  CROSS_SLICE_DATA_FLAG_STORAGE_KEY,
  DRAG_AND_DROP_FLAG_STORAGE_KEY,
  RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY,
  isDragAndDropEnabled,
  isCrossSliceDataEnabled,
  shouldShowDevDiagramControls
} from './runtimeFlags';

describe('runtimeFlags', () => {
  const createStorage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      }
    };
  };

  it('defaults render-engine flag to enabled on localhost and persists it', () => {
    const storage = createStorage();
    expect(shouldShowDevDiagramControls('localhost', storage)).toBe(true);
    expect(storage.getItem(RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY)).toBe('true');
  });

  it('defaults render-engine flag to disabled on non-localhost hosts and persists it', () => {
    const storage = createStorage();
    expect(shouldShowDevDiagramControls('example.com', storage)).toBe(false);
    expect(storage.getItem(RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY)).toBe('false');
  });

  it('honors persisted render-engine flag values', () => {
    const storage = createStorage();
    storage.setItem(RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY, 'false');
    expect(shouldShowDevDiagramControls('localhost', storage)).toBe(false);

    storage.setItem(RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY, 'true');
    expect(shouldShowDevDiagramControls('example.com', storage)).toBe(true);
  });

  it('defaults drag-and-drop flag to enabled on localhost and persists it', () => {
    const storage = createStorage();
    expect(isDragAndDropEnabled('localhost', storage)).toBe(true);
    expect(storage.getItem(DRAG_AND_DROP_FLAG_STORAGE_KEY)).toBe('true');
  });

  it('defaults drag-and-drop flag to disabled on non-localhost hosts and persists it', () => {
    const storage = createStorage();
    expect(isDragAndDropEnabled('example.com', storage)).toBe(false);
    expect(storage.getItem(DRAG_AND_DROP_FLAG_STORAGE_KEY)).toBe('false');
  });

  it('honors persisted drag-and-drop flag values', () => {
    const storage = createStorage();
    storage.setItem(DRAG_AND_DROP_FLAG_STORAGE_KEY, 'false');
    expect(isDragAndDropEnabled('localhost', storage)).toBe(false);

    storage.setItem(DRAG_AND_DROP_FLAG_STORAGE_KEY, 'true');
    expect(isDragAndDropEnabled('example.com', storage)).toBe(true);
  });

  it('defaults cross-slice-data flag to enabled on localhost and persists it', () => {
    const storage = createStorage();
    expect(isCrossSliceDataEnabled('localhost', storage)).toBe(true);
    expect(storage.getItem(CROSS_SLICE_DATA_FLAG_STORAGE_KEY)).toBe('true');
  });

  it('defaults cross-slice-data flag to disabled on non-localhost hosts and persists it', () => {
    const storage = createStorage();
    expect(isCrossSliceDataEnabled('example.com', storage)).toBe(false);
    expect(storage.getItem(CROSS_SLICE_DATA_FLAG_STORAGE_KEY)).toBe('false');
  });

  it('honors persisted cross-slice-data flag values', () => {
    const storage = createStorage();
    storage.setItem(CROSS_SLICE_DATA_FLAG_STORAGE_KEY, 'false');
    expect(isCrossSliceDataEnabled('localhost', storage)).toBe(false);

    storage.setItem(CROSS_SLICE_DATA_FLAG_STORAGE_KEY, 'true');
    expect(isCrossSliceDataEnabled('example.com', storage)).toBe(true);
  });
});
