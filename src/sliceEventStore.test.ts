// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as parseDslModule from './domain/parseDsl';
import {
  appendSliceEvent,
  createEmptyProjection,
  foldSliceEvents,
  hydrateSliceProjection,
  loadSliceEvents,
  loadSliceProjectionSnapshot,
  saveSliceProjectionSnapshot,
  type SliceEvent,
  type SliceProjection
} from './sliceEventStore';

afterEach(() => {
  localStorage.clear();
});

function textEditedEvent(version: number, dsl: string): SliceEvent {
  return {
    id: `e-${version}`,
    sliceId: 'slice-a',
    version,
    at: `2026-01-01T00:00:0${version}.000Z`,
    type: 'text-edited',
    payload: { dsl }
  };
}

describe('sliceEventStore', () => {
  it('folds text, node and edge events into a projection', () => {
    const events: SliceEvent[] = [
      textEditedEvent(1, 'slice "A"\n\nevt:start'),
      {
        id: 'e-2',
        sliceId: 'slice-a',
        version: 2,
        at: '2026-01-01T00:00:02.000Z',
        type: 'node-moved',
        payload: { nodeKey: 'start', x: 120, y: 80 }
      },
      {
        id: 'e-3',
        sliceId: 'slice-a',
        version: 3,
        at: '2026-01-01T00:00:03.000Z',
        type: 'edge-moved',
        payload: {
          edgeKey: 'start->next#0',
          points: [
            { x: 10, y: 20 },
            { x: 30, y: 40 }
          ]
        }
      }
    ];

    const projection = foldSliceEvents(events);

    expect(projection).toEqual<SliceProjection>({
      dsl: 'slice "A"\n\nevt:start',
      manualNodePositions: { start: { x: 120, y: 80 } },
      manualEdgePoints: { 'start->next#0': [{ x: 10, y: 20 }, { x: 30, y: 40 }] }
    });
  });

  it('clears manual layout on layout-reset', () => {
    const events: SliceEvent[] = [
      textEditedEvent(1, 'slice "A"\n\nevt:start'),
      {
        id: 'e-2',
        sliceId: 'slice-a',
        version: 2,
        at: '2026-01-01T00:00:02.000Z',
        type: 'node-moved',
        payload: { nodeKey: 'start', x: 120, y: 80 }
      },
      {
        id: 'e-3',
        sliceId: 'slice-a',
        version: 3,
        at: '2026-01-01T00:00:03.000Z',
        type: 'layout-reset',
        payload: {}
      }
    ];

    const projection = foldSliceEvents(events);
    expect(projection.manualNodePositions).toEqual({});
    expect(projection.manualEdgePoints).toEqual({});
  });

  it('appends events in order and loads only valid payloads', () => {
    appendSliceEvent('slice-a', {
      type: 'text-edited',
      payload: { dsl: 'slice "A"\n\nevt:start' },
      at: '2026-01-01T00:00:01.000Z'
    });
    appendSliceEvent('slice-a', {
      type: 'node-moved',
      payload: { nodeKey: 'start', x: 10, y: 20 },
      at: '2026-01-01T00:00:02.000Z'
    });

    localStorage.setItem('slicr.es.v1.stream.slice-a', JSON.stringify([
      ...loadSliceEvents('slice-a'),
      { bad: true },
      { id: 'oops', sliceId: 'slice-a', version: 'x', at: 'nope', type: 'text-edited', payload: {} }
    ]));

    const events = loadSliceEvents('slice-a');

    expect(events.map((event) => event.version)).toEqual([1, 2]);
    expect(events[0].type).toBe('text-edited');
    expect(events[1].type).toBe('node-moved');
  });

  it('returns an empty projection for empty events', () => {
    expect(foldSliceEvents([])).toEqual(createEmptyProjection());
  });

  it('does not parse text-edited events when no manual overrides exist', () => {
    const parseSpy = vi.spyOn(parseDslModule, 'parseDsl');
    const events: SliceEvent[] = [
      textEditedEvent(1, 'slice "A1"\n\nevt:a1'),
      textEditedEvent(2, 'slice "A2"\n\nevt:a2'),
      textEditedEvent(3, 'slice "A3"\n\nevt:a3')
    ];

    const projection = foldSliceEvents(events);

    expect(projection.dsl).toBe('slice "A3"\n\nevt:a3');
    expect(parseSpy).not.toHaveBeenCalled();
    parseSpy.mockRestore();
  });

  it('hydrates from snapshot and only folds events after the snapshot version', () => {
    saveSliceProjectionSnapshot('slice-a', {
      version: 0,
      projection: {
        dsl: 'slice "From Snapshot"\n\nevt:snap',
        manualNodePositions: { snap: { x: 11, y: 22 } },
        manualEdgePoints: {}
      }
    });
    appendSliceEvent('slice-a', {
      type: 'text-edited',
      payload: { dsl: 'slice "From Event"\n\nevt:live' },
      at: '2026-01-01T00:00:03.000Z'
    });
    appendSliceEvent('slice-a', {
      type: 'node-moved',
      payload: { nodeKey: 'live', x: 30, y: 40 },
      at: '2026-01-01T00:00:04.000Z'
    });

    const projection = hydrateSliceProjection('slice-a');
    expect(projection).toEqual<SliceProjection>({
      dsl: 'slice "From Event"\n\nevt:live',
      manualNodePositions: { live: { x: 30, y: 40 } },
      manualEdgePoints: {}
    });
  });

  it('ignores malformed snapshot payloads', () => {
    localStorage.setItem('slicr.es.v1.snapshot.slice-a', JSON.stringify({ bad: true }));
    expect(loadSliceProjectionSnapshot('slice-a')).toBeNull();
  });

  it('creates a snapshot automatically on snapshot interval boundaries', () => {
    for (let i = 1; i <= 99; i += 1) {
      appendSliceEvent('slice-a', {
        type: 'text-edited',
        payload: { dsl: `slice "A${i}"\n\nevt:e${i}` },
        at: `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`
      });
    }

    expect(loadSliceProjectionSnapshot('slice-a')).toBeNull();

    appendSliceEvent('slice-a', {
      type: 'text-edited',
      payload: { dsl: 'slice "A100"\n\nevt:e100' },
      at: '2026-01-01T00:01:40.000Z'
    });

    const snapshot = loadSliceProjectionSnapshot('slice-a');
    expect(snapshot).not.toBeNull();
    expect(snapshot?.version).toBe(100);
    expect(snapshot?.projection.dsl).toBe('slice "A100"\n\nevt:e100');
  });

  it('prunes manual layout entries that no longer exist after text edits', () => {
    const events: SliceEvent[] = [
      textEditedEvent(1, 'slice "A"\n\nevt:a\nevt:b <- evt:a'),
      {
        id: 'e-2',
        sliceId: 'slice-a',
        version: 2,
        at: '2026-01-01T00:00:02.000Z',
        type: 'node-moved',
        payload: { nodeKey: 'a', x: 100, y: 100 }
      },
      {
        id: 'e-3',
        sliceId: 'slice-a',
        version: 3,
        at: '2026-01-01T00:00:03.000Z',
        type: 'node-moved',
        payload: { nodeKey: 'x', x: 200, y: 200 }
      },
      {
        id: 'e-4',
        sliceId: 'slice-a',
        version: 4,
        at: '2026-01-01T00:00:04.000Z',
        type: 'edge-moved',
        payload: {
          edgeKey: 'a->b#0',
          points: [
            { x: 10, y: 10 },
            { x: 20, y: 20 }
          ]
        }
      },
      {
        id: 'e-5',
        sliceId: 'slice-a',
        version: 5,
        at: '2026-01-01T00:00:05.000Z',
        type: 'edge-moved',
        payload: {
          edgeKey: 'x->y#0',
          points: [
            { x: 1, y: 1 },
            { x: 2, y: 2 }
          ]
        }
      },
      textEditedEvent(6, 'slice "A"\n\nevt:a\nevt:b <- evt:a')
    ];

    const projection = foldSliceEvents(events);
    expect(projection.manualNodePositions).toEqual({ a: { x: 100, y: 100 } });
    expect(projection.manualEdgePoints).toEqual({ 'a->b#0': [{ x: 10, y: 10 }, { x: 20, y: 20 }] });
  });

  it('uses slice-created initialDsl as the projection dsl', () => {
    const events: SliceEvent[] = [
      {
        id: 'e-1',
        sliceId: 'slice-a',
        version: 1,
        at: '2026-01-01T00:00:01.000Z',
        type: 'slice-created',
        payload: { initialDsl: 'slice "Created"\n\nevt:created' }
      }
    ];

    const projection = foldSliceEvents(events);
    expect(projection.dsl).toBe('slice "Created"\n\nevt:created');
  });
});
