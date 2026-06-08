import {describe, expect, it} from 'vitest';
import {Query} from './query.ts';
import {AppendConditionFailedError} from './specStore.ts';
import {IndexedDBSpecEventStore} from './indexedDBSpecEventStore.ts';
import type {Event} from './types.ts';

type TestEvent = Event<'FirstEvent' | 'SecondEvent', {readonly value: number}>;

const makeEvent = (type: TestEvent['type'], value: number, tags: readonly string[] = []): TestEvent => ({
  type,
  payload: {value},
  tags: [...tags],
});

const databaseName = (testName: string): string => `event-sourcing-${testName}-${crypto.randomUUID()}`;

describe('IndexedDBSpecEventStore in a browser', () => {
  it('assigns persisted sequence positions starting at 1 and reads sequenced events in append order', async () => {
    const store = await IndexedDBSpecEventStore.create<TestEvent>({
      databaseName: databaseName('spec-append-read-order'),
      streamName: 'primary-stream',
    });
    const first = makeEvent('FirstEvent', 1);
    const second = makeEvent('SecondEvent', 2);

    await expect(store.append([first, second])).resolves.toEqual([
      {position: 1, event: first},
      {position: 2, event: second},
    ]);

    await expect(store.read()).resolves.toEqual([
      {position: 1, event: first},
      {position: 2, event: second},
    ]);
  });

  it('filters later sequenced events with read({from}) and query(..., {from})', async () => {
    const store = await IndexedDBSpecEventStore.create<TestEvent>({
      databaseName: databaseName('spec-read-from-query-from'),
      streamName: 'primary-stream',
    });
    const first = makeEvent('FirstEvent', 1, ['match']);
    const second = makeEvent('SecondEvent', 2, ['other']);
    const third = makeEvent('FirstEvent', 3, ['match']);

    await store.append([first, second, third]);

    await expect(store.read({from: 1})).resolves.toEqual([
      {position: 2, event: second},
      {position: 3, event: third},
    ]);
    await expect(store.query(Query.where({tags: ['match']}), {from: 1})).resolves.toEqual([
      {position: 3, event: third},
    ]);
  });

  it('rejects conditional appends when matching conflicts exist after the relevant position', async () => {
    const store = await IndexedDBSpecEventStore.create<TestEvent>({
      databaseName: databaseName('spec-conditional-conflict'),
      streamName: 'primary-stream',
    });
    const conflicting = makeEvent('FirstEvent', 1, ['conflict']);
    const appended = makeEvent('SecondEvent', 2, ['conflict']);

    await store.append([conflicting]);

    await expect(store.append([appended], {failIfEventsMatch: Query.where({tags: ['conflict']})})).rejects.toMatchObject({
      name: 'AppendConditionFailedError',
      condition: {failIfEventsMatch: Query.where({tags: ['conflict']})},
      conflictingEvents: [{position: 1, event: conflicting}],
    });
    await expect(store.append([appended], {failIfEventsMatch: Query.where({tags: ['conflict']})}))
      .rejects.toBeInstanceOf(AppendConditionFailedError);
  });

  it('allows at most one of two overlapping conflicting conditional appends to succeed', async () => {
    const database = databaseName('spec-overlapping-conditional-appends');
    const firstStore = await IndexedDBSpecEventStore.create<TestEvent>({
      databaseName: database,
      streamName: 'primary-stream',
    });
    const secondStore = await IndexedDBSpecEventStore.create<TestEvent>({
      databaseName: database,
      streamName: 'primary-stream',
    });
    const firstAppend = makeEvent('FirstEvent', 1, ['conflict']);
    const secondAppend = makeEvent('SecondEvent', 2, ['conflict']);
    const condition = {failIfEventsMatch: Query.where({tags: ['conflict']})};

    const outcomes = await Promise.allSettled([
      firstStore.append([firstAppend], condition),
      secondStore.append([secondAppend], condition),
    ]);

    expect(outcomes).toHaveLength(2);
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejectedOutcome = outcomes.find(outcome => outcome.status === 'rejected');
    expect(rejectedOutcome).toBeDefined();
    if (rejectedOutcome?.status === 'rejected') {
      expect(rejectedOutcome.reason).toBeInstanceOf(AppendConditionFailedError);
    }
  });

  it('keeps events isolated by stream name', async () => {
    const database = databaseName('spec-stream-isolation');
    const primaryStore = await IndexedDBSpecEventStore.create<TestEvent>({
      databaseName: database,
      streamName: 'primary-stream',
    });
    const secondaryStore = await IndexedDBSpecEventStore.create<TestEvent>({
      databaseName: database,
      streamName: 'secondary-stream',
    });
    const primaryFirst = makeEvent('FirstEvent', 1, ['primary']);
    const primarySecond = makeEvent('SecondEvent', 2, ['primary']);
    const secondaryFirst = makeEvent('FirstEvent', 3, ['secondary']);

    await primaryStore.append([primaryFirst, primarySecond]);
    await secondaryStore.append([secondaryFirst]);

    await expect(primaryStore.read()).resolves.toEqual([
      {position: 1, event: primaryFirst},
      {position: 2, event: primarySecond},
    ]);
    await expect(primaryStore.query(Query.where({tags: ['primary']}))).resolves.toEqual([
      {position: 1, event: primaryFirst},
      {position: 2, event: primarySecond},
    ]);
    await expect(secondaryStore.read()).resolves.toEqual([
      {position: 3, event: secondaryFirst},
    ]);
    await expect(secondaryStore.query(Query.where({tags: ['secondary']}))).resolves.toEqual([
      {position: 3, event: secondaryFirst},
    ]);
  });
});
