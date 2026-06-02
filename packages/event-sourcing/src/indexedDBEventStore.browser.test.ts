import {describe, expect, it} from 'vitest';
import {IndexedDBEventStore as ExportedIndexedDBEventStore} from './index.ts';
import {IndexedDBEventStore} from './indexedDBEventStore.ts';
import {Query} from './query.ts';
import type {Event} from './types.ts';

type TestEvent = Event<'FirstEvent' | 'SecondEvent' | 'ThirdEvent', {readonly value: number}>;

const makeEvent = (type: TestEvent['type'], value: number, tags: readonly string[] = []): TestEvent => ({
  type,
  payload: {value},
  tags: [...tags],
});

const databaseName = (testName: string): string => `event-sourcing-${testName}-${crypto.randomUUID()}`;

describe('IndexedDBEventStore in a browser', () => {
  it('is exported from the package entrypoint', async () => {
    const store = await ExportedIndexedDBEventStore.create<TestEvent>({
      databaseName: databaseName('entrypoint-export'),
      streamName: 'primary-stream',
    });

    await store.append(makeEvent('FirstEvent', 1));

    await expect(store.readAll()).resolves.toEqual([makeEvent('FirstEvent', 1)]);
  });

  it('appends one or many events and reads them back in append order', async () => {
    const store = await IndexedDBEventStore.create<TestEvent>({
      databaseName: databaseName('append-read-order'),
      streamName: 'primary-stream',
    });
    const first = makeEvent('FirstEvent', 1);
    const second = makeEvent('SecondEvent', 2);
    const third = makeEvent('ThirdEvent', 3);

    await store.append(first);
    await store.append([second, third]);

    await expect(store.readAll()).resolves.toEqual([first, second, third]);
    await expect(store.query(Query.all())).resolves.toEqual([first, second, third]);
  });

  it('matches MemoryStore query semantics for all, none, and where filters', async () => {
    const store = await IndexedDBEventStore.create<TestEvent>({
      databaseName: databaseName('query-semantics'),
      streamName: 'primary-stream',
    });
    const first = makeEvent('FirstEvent', 1, ['nodeType:Command', 'lane:1']);
    const second = makeEvent('SecondEvent', 2, ['nodeType:Event', 'lane:1']);
    const third = makeEvent('FirstEvent', 3, ['nodeType:Command', 'lane:2']);
    await store.append([first, second, third]);

    await expect(store.query(Query.none())).resolves.toEqual([]);
    await expect(store.query(Query.all())).resolves.toEqual([first, second, third]);
    await expect(store.query(Query.where({
      types: ['FirstEvent'],
      tags: ['nodeType:Command', 'lane:2'],
    }))).resolves.toEqual([third]);
  });

  it('clears and replaces only the configured stream scope', async () => {
    const sharedDatabaseName = databaseName('clear-replace-scope');
    const primaryStore = await IndexedDBEventStore.create<TestEvent>({
      databaseName: sharedDatabaseName,
      streamName: 'primary-stream',
    });
    const secondaryStore = await IndexedDBEventStore.create<TestEvent>({
      databaseName: sharedDatabaseName,
      streamName: 'secondary-stream',
    });
    const primaryFirst = makeEvent('FirstEvent', 1);
    const primarySecond = makeEvent('SecondEvent', 2);
    const secondaryFirst = makeEvent('ThirdEvent', 10);
    const replacementFirst = makeEvent('ThirdEvent', 30);
    const replacementSecond = makeEvent('FirstEvent', 40);
    await primaryStore.append([primaryFirst, primarySecond]);
    await secondaryStore.append(secondaryFirst);

    await primaryStore.clear();

    await expect(primaryStore.readAll()).resolves.toEqual([]);
    await expect(secondaryStore.readAll()).resolves.toEqual([secondaryFirst]);

    await primaryStore.replace([replacementFirst, replacementSecond]);

    await expect(primaryStore.readAll()).resolves.toEqual([replacementFirst, replacementSecond]);
    await expect(secondaryStore.readAll()).resolves.toEqual([secondaryFirst]);
  });
});
