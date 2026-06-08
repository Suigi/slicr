import {describe, expect, it} from 'vitest';
import {Query} from '../query.ts';
import {MemorySpecEventStore} from './specEventStore.ts';
import type {Event} from '../types.ts';

type TestEvent = Event<'Created', {readonly value: number}>;

const preAfterMatchingEvent: TestEvent = {type: 'Created', payload: {value: 1}, tags: ['conflict']};
const appendedEvent: TestEvent = {type: 'Created', payload: {value: 2}, tags: ['conflict']};

describe('MemorySpecEventStore.append', () => {
  it('ignores matching events at or before after and appends successfully', async () => {
    const store = MemorySpecEventStore.create<TestEvent>();

    await store.append([preAfterMatchingEvent]);

    await expect(store.append([appendedEvent], {
      failIfEventsMatch: Query.where({tags: ['conflict']}),
      after: 1,
    })).resolves.toEqual([
      {position: 2, event: appendedEvent},
    ]);

    await expect(store.read()).resolves.toEqual([
      {position: 1, event: preAfterMatchingEvent},
      {position: 2, event: appendedEvent},
    ]);
  });
});
