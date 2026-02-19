// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_DSL } from './defaultDsl';
import {
  addNewSlice,
  LEGACY_DSL_STORAGE_KEY,
  loadSliceLayoutOverrides,
  loadSliceLibrary,
  saveSliceLayoutOverrides,
  saveSliceLibrary,
  selectSlice,
  SLICES_STORAGE_KEY,
  SLICES_LAYOUT_STORAGE_KEY,
  updateSelectedSliceDsl
} from './sliceLibrary';

afterEach(() => {
  localStorage.clear();
});

describe('sliceLibrary', () => {
  it('bootstraps from default DSL when storage is empty', () => {
    const library = loadSliceLibrary();

    expect(library.slices).toHaveLength(1);
    expect(library.slices[0].dsl).toBe(DEFAULT_DSL);
    expect(library.selectedSliceId).toBe(library.slices[0].id);
  });

  it('migrates from legacy DSL storage key', () => {
    localStorage.setItem(LEGACY_DSL_STORAGE_KEY, 'slice "Legacy"\n\nrm:legacy');

    const library = loadSliceLibrary();
    expect(library.slices).toHaveLength(1);
    expect(library.slices[0].dsl).toContain('rm:legacy');
  });

  it('recovers slices from partially-shaped library payloads', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'missing',
        slices: [{ dsl: 'slice "Recovered"\n\nrm:ok' }]
      })
    );

    const library = loadSliceLibrary();
    expect(library.slices).toHaveLength(1);
    expect(library.slices[0].id.length).toBeGreaterThan(0);
    expect(library.selectedSliceId).toBe(library.slices[0].id);
  });

  it('saves full library and selected DSL', () => {
    const library = addNewSlice(loadSliceLibrary());

    saveSliceLibrary(library);

    const storedLibrary = localStorage.getItem(SLICES_STORAGE_KEY);
    expect(storedLibrary).not.toBeNull();
    expect(localStorage.getItem(LEGACY_DSL_STORAGE_KEY)).toBeNull();
  });

  it('adds untitled slices with unique names', () => {
    const first = addNewSlice(loadSliceLibrary());
    const second = addNewSlice(first);

    expect(first.slices[first.slices.length - 1].dsl).toContain('slice "Untitled"');
    expect(second.slices[second.slices.length - 1].dsl).toContain('slice "Untitled 2"');
  });

  it('derives names from DSL text when loading stored slices', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          { id: 'a', dsl: 'slice "Name From DSL"\n\nrm:a' },
          { id: 'b', dsl: 'slice "Second Name"\n\nrm:b' }
        ]
      })
    );

    const library = loadSliceLibrary();
    expect(library.slices).toHaveLength(2);
    expect(library.slices[0].dsl).toContain('slice "Name From DSL"');
    expect(library.slices[1].dsl).toContain('slice "Second Name"');
  });

  it('selects and updates only the active slice', () => {
    const base = addNewSlice(loadSliceLibrary());
    const firstSliceId = base.slices[0].id;
    const selected = selectSlice(base, firstSliceId);
    const updated = updateSelectedSliceDsl(selected, 'slice "Updated"\n\nrm:updated');

    expect(updated.slices[0].dsl).toContain('rm:updated');
    expect(updated.slices[1].dsl).toBe(base.slices[1].dsl);
  });

  it('stores and loads layout overrides per slice', () => {
    saveSliceLayoutOverrides('slice-a', {
      nodes: { 'node-a': { x: 120, y: 80 } },
      edges: { 'a->b#0': [{ x: 1, y: 2 }, { x: 3, y: 4 }] }
    });
    saveSliceLayoutOverrides('slice-b', {
      nodes: { 'node-b': { x: 300, y: 200 } },
      edges: {}
    });

    expect(loadSliceLayoutOverrides('slice-a')).toEqual({
      nodes: { 'node-a': { x: 120, y: 80 } },
      edges: { 'a->b#0': [{ x: 1, y: 2 }, { x: 3, y: 4 }] }
    });
    expect(loadSliceLayoutOverrides('slice-b')).toEqual({
      nodes: { 'node-b': { x: 300, y: 200 } },
      edges: {}
    });
  });

  it('returns empty layout overrides for missing or invalid storage payloads', () => {
    expect(loadSliceLayoutOverrides('missing')).toEqual({ nodes: {}, edges: {} });

    localStorage.setItem(SLICES_LAYOUT_STORAGE_KEY, '{bad-json');
    expect(loadSliceLayoutOverrides('missing')).toEqual({ nodes: {}, edges: {} });

    localStorage.setItem(
      SLICES_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        missing: {
          nodes: { 'bad-node': { x: 'oops', y: 12 } },
          edges: { 'bad-edge': [{ x: 1, y: 'oops' }] }
        }
      })
    );
    expect(loadSliceLayoutOverrides('missing')).toEqual({ nodes: {}, edges: {} });
  });

  it('removes stored entry when overrides are empty for a slice', () => {
    saveSliceLayoutOverrides('slice-a', {
      nodes: { 'node-a': { x: 12, y: 34 } },
      edges: {}
    });
    saveSliceLayoutOverrides('slice-a', {
      nodes: {},
      edges: {}
    });

    const raw = localStorage.getItem(SLICES_LAYOUT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw).toBe('{}');
    expect(loadSliceLayoutOverrides('slice-a')).toEqual({ nodes: {}, edges: {} });
  });
});
