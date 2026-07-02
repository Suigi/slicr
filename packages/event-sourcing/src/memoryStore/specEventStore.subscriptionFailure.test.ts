import {describe, expect, it} from 'vitest';
import {Query} from '../query.ts';
import type {Event} from '../types.ts';
import {MemorySpecEventStore} from './specEventStore.ts';

type TestEvent = Event<'Created', {readonly value: number}>;

const testEvent: TestEvent = {type: 'Created', payload: {value: 1}, tags: []};

describe('MemorySpecEventStore.append', () => {
  it('resolves with appended events when a matching subscriber throws', async () => {
    const store = MemorySpecEventStore.create<TestEvent>();
    store.subscribe(Query.where({types: ['Created']}), () => {
      throw new Error('projection failed');
    });

    await expect(store.append([testEvent])).resolves.toEqual([{position: 1, event: testEvent}]);
    await expect(store.read()).resolves.toEqual([{position: 1, event: testEvent}]);
  });
});
