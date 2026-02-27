// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as parseDslModule from './domain/parseDsl';
import { DEFAULT_DSL } from './defaultDsl';
import {
  addNewSlice,
  appendAppSelectedEvent,
  appendSliceEdgeMovedEvent,
  appendSliceLayoutResetEvent,
  appendSliceNodeMovedEvent,
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
    expect(storedLibrary).toBeNull();
    expect(localStorage.getItem('slicr.es.v1.index')).not.toBeNull();
    expect(localStorage.getItem(LEGACY_DSL_STORAGE_KEY)).toBeNull();
  });

  it('does not parse event streams while saving when only DSL projection is needed', () => {
    localStorage.setItem(
      'slicr.es.v1.index',
      JSON.stringify({ sliceIds: ['slice-a'] })
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a',
      JSON.stringify([
        {
          id: 'e-1',
          sliceId: 'slice-a',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "A1"\n\nevt:a1' }
        },
        {
          id: 'e-2',
          sliceId: 'slice-a',
          version: 2,
          at: '2026-01-01T00:00:02.000Z',
          type: 'text-edited',
          payload: { dsl: 'slice "A2"\n\nevt:a2' }
        },
        {
          id: 'e-3',
          sliceId: 'slice-a',
          version: 3,
          at: '2026-01-01T00:00:03.000Z',
          type: 'node-moved',
          payload: { nodeKey: 'a2', x: 10, y: 20 }
        }
      ])
    );
    const parseSpy = vi.spyOn(parseDslModule, 'parseDsl');

    saveSliceLibrary({
      selectedSliceId: 'slice-a',
      slices: [{ id: 'slice-a', dsl: 'slice "A2"\n\nevt:a2' }]
    });

    expect(parseSpy).not.toHaveBeenCalled();
    parseSpy.mockRestore();
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

  it('can save layout overrides without emitting layout events', () => {
    saveSliceLayoutOverrides('slice-a', {
      nodes: { 'node-a': { x: 120, y: 80 } },
      edges: { 'a->b#0': [{ x: 1, y: 2 }, { x: 3, y: 4 }] }
    }, { emitEvents: false });

    expect(localStorage.getItem('slicr.es.v1.stream.slice-a')).toBeNull();
    expect(localStorage.getItem(SLICES_LAYOUT_STORAGE_KEY)).toBeNull();
    expect(loadSliceLayoutOverrides('slice-a')).toEqual({ nodes: {}, edges: {} });
  });

  it('appends node/edge/layout-reset events explicitly', () => {
    appendSliceNodeMovedEvent('slice-a', 'node-a', { x: 10, y: 20 });
    appendSliceEdgeMovedEvent('slice-a', 'a->b#0', [{ x: 1, y: 2 }, { x: 3, y: 4 }]);
    appendSliceLayoutResetEvent('slice-a');

    const raw = localStorage.getItem('slicr.es.v1.stream.slice-a');
    expect(raw).not.toBeNull();
    const events = JSON.parse(raw ?? '[]') as Array<{ type: string; version: number }>;
    expect(events.map((event) => event.type)).toEqual(['node-moved', 'edge-moved', 'layout-reset']);
    expect(events.map((event) => event.version)).toEqual([1, 2, 3]);
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

  it('does not write the legacy layout storage key when saving overrides', () => {
    saveSliceLayoutOverrides('slice-a', {
      nodes: { 'node-a': { x: 12, y: 34 } },
      edges: {}
    });
    expect(localStorage.getItem(SLICES_LAYOUT_STORAGE_KEY)).toBeNull();
  });

  it('does not append text-edited when slice-created already carries the same DSL', () => {
    const library = {
      selectedSliceId: 'slice-a',
      slices: [{ id: 'slice-a', dsl: 'slice "A"\n\nevt:start' }]
    };

    saveSliceLibrary(library);

    const raw = localStorage.getItem('slicr.es.v1.stream.slice-a');
    expect(raw).not.toBeNull();
    const events = JSON.parse(raw ?? '[]') as Array<{ type: string; version: number; payload: { dsl: string } }>;
    expect(events.some((event) => event.type === 'slice-created')).toBe(true);
    expect(events.some((event) => event.type === 'text-edited')).toBe(false);

    saveSliceLibrary(library);
    const second = JSON.parse(localStorage.getItem('slicr.es.v1.stream.slice-a') ?? '[]') as Array<unknown>;
    expect(second).toHaveLength(events.length);
  });

  it('hydrates layout overrides from event streams', () => {
    saveSliceLayoutOverrides('slice-a', {
      nodes: { 'node-a': { x: 120, y: 80 } },
      edges: { 'a->b#0': [{ x: 1, y: 2 }, { x: 3, y: 4 }] }
    });

    localStorage.removeItem(SLICES_LAYOUT_STORAGE_KEY);

    expect(loadSliceLayoutOverrides('slice-a')).toEqual({
      nodes: { 'node-a': { x: 120, y: 80 } },
      edges: { 'a->b#0': [{ x: 1, y: 2 }, { x: 3, y: 4 }] }
    });
  });

  it('emits layout-reset when overrides are cleared', () => {
    saveSliceLayoutOverrides('slice-a', {
      nodes: { 'node-a': { x: 12, y: 34 } },
      edges: {}
    });
    saveSliceLayoutOverrides('slice-a', {
      nodes: {},
      edges: {}
    });

    const raw = localStorage.getItem('slicr.es.v1.stream.slice-a');
    expect(raw).not.toBeNull();
    const events = JSON.parse(raw ?? '[]') as Array<{ type: string }>;
    expect(events[events.length - 1]?.type).toBe('layout-reset');
  });

  it('loads slice library from event index when legacy library key is missing', () => {
    const library = {
      selectedSliceId: 'slice-b',
      slices: [
        { id: 'slice-a', dsl: 'slice "A"\n\nevt:a' },
        { id: 'slice-b', dsl: 'slice "B"\n\nevt:b' }
      ]
    };

    saveSliceLibrary(library);
    localStorage.removeItem(SLICES_STORAGE_KEY);
    localStorage.removeItem(LEGACY_DSL_STORAGE_KEY);

    const loaded = loadSliceLibrary();
    expect(loaded.selectedSliceId).toBe('slice-b');
    expect(loaded.slices).toEqual(library.slices);
  });

  it('derives selected slice from latest app selection event', () => {
    const library = {
      selectedSliceId: 'slice-a',
      slices: [
        { id: 'slice-a', dsl: 'slice "A"\n\nevt:a' },
        { id: 'slice-b', dsl: 'slice "B"\n\nevt:b' }
      ]
    };
    saveSliceLibrary(library);
    localStorage.removeItem(SLICES_STORAGE_KEY);
    localStorage.removeItem(LEGACY_DSL_STORAGE_KEY);
    appendAppSelectedEvent('slice-b');

    const loaded = loadSliceLibrary();
    expect(loaded.selectedSliceId).toBe('slice-b');
  });

  it('migrates legacy maps keyword to uses and appends a text-edited event on load', () => {
    localStorage.setItem(
      'slicr.es.v1.index',
      JSON.stringify({
        sliceIds: ['slice-a']
      })
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a',
      JSON.stringify([
        {
          id: 'e-1',
          sliceId: 'slice-a',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Legacy"\n\nrm:legacy\nmaps:\n  alpha' }
        }
      ])
    );

    const loaded = loadSliceLibrary();
    expect(loaded.slices).toEqual([{ id: 'slice-a', dsl: 'slice "Legacy"\n\nrm:legacy\nuses:\n  alpha' }]);

    const events = JSON.parse(localStorage.getItem('slicr.es.v1.stream.slice-a') ?? '[]') as Array<{
      type: string;
      payload?: { dsl?: string };
    }>;
    expect(events).toHaveLength(2);
    expect(events[1]?.type).toBe('text-edited');
    expect(events[1]?.payload?.dsl).toContain('uses:');
  });

  it('does not append repeated migration events once maps is migrated', () => {
    localStorage.setItem(
      'slicr.es.v1.index',
      JSON.stringify({
        sliceIds: ['slice-a']
      })
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a',
      JSON.stringify([
        {
          id: 'e-1',
          sliceId: 'slice-a',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Legacy"\n\nrm:legacy\nmaps:\n  alpha' }
        }
      ])
    );

    loadSliceLibrary();
    const afterFirstLoad = JSON.parse(localStorage.getItem('slicr.es.v1.stream.slice-a') ?? '[]') as Array<unknown>;
    loadSliceLibrary();
    const afterSecondLoad = JSON.parse(localStorage.getItem('slicr.es.v1.stream.slice-a') ?? '[]') as Array<unknown>;
    expect(afterSecondLoad).toHaveLength(afterFirstLoad.length);
  });

  it('prefers text from event stream over stale stored slice payloads', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [{ id: 'slice-a', dsl: 'slice "Stale"\n\nevt:stale' }]
      })
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a',
      JSON.stringify([
        {
          id: 'e-1',
          sliceId: 'slice-a',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'text-edited',
          payload: { dsl: 'slice "Fresh"\n\nevt:fresh' }
        }
      ])
    );

    const loaded = loadSliceLibrary();
    expect(loaded.slices).toEqual([{ id: 'slice-a', dsl: 'slice "Fresh"\n\nevt:fresh' }]);
  });

  it('keeps slices with intentionally empty DSL when loading from event index', () => {
    localStorage.setItem(
      'slicr.es.v1.index',
      JSON.stringify({
        sliceIds: ['slice-a']
      })
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a',
      JSON.stringify([
        {
          id: 'e-1',
          sliceId: 'slice-a',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'text-edited',
          payload: { dsl: '' }
        }
      ])
    );

    const loaded = loadSliceLibrary();
    expect(loaded.slices).toEqual([{ id: 'slice-a', dsl: '' }]);
    expect(loaded.selectedSliceId).toBe('slice-a');
  });
});
