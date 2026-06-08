import {describe, expect, it} from 'vitest';
import {IndexedDBSpecEventStore as ExportedIndexedDBSpecEventStore, MemorySpecEventStore, Query} from './index.ts';
import {IndexedDBSpecEventStore} from './indexedDBSpecEventStore.ts';
import type {SpecEventStore} from './index.ts';
import type {Event} from './types.ts';

type TestEvent = Event<'Created', {readonly value: number}>;

const event: TestEvent = {type: 'Created', payload: {value: 1}, tags: []};

describe('package entrypoint exports', () => {
  it('exports the spec store API and memory-backed implementation', async () => {
    const store: SpecEventStore<TestEvent> = MemorySpecEventStore.create<TestEvent>();

    const appended = await store.append([event]);

    expect(appended).toEqual([{position: 1, event}]);
    await expect(store.query(Query.all())).resolves.toEqual([{position: 1, event}]);
  });

  it('exports IndexedDBSpecEventStore from the package entrypoint', () => {
    expect(ExportedIndexedDBSpecEventStore).toBe(IndexedDBSpecEventStore);
    expect(typeof ExportedIndexedDBSpecEventStore.create).toBe('function');
  });
});
