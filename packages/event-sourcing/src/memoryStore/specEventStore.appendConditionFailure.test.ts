import {describe, expect, it} from 'vitest';
import {Query} from '../query.ts';
import {AppendConditionFailedError} from '../specStore.ts';
import {MemorySpecEventStore} from './specEventStore.ts';
import type {Event} from '../types.ts';

type TestEvent = Event<'Created', {readonly value: number}>;

const storedEvent: TestEvent = {type: 'Created', payload: {value: 1}, tags: ['conflict']};
const appendedEvent: TestEvent = {type: 'Created', payload: {value: 2}, tags: ['conflict']};

describe('MemorySpecEventStore.append', () => {
  it('fails with conflicting sequenced events when a matching append condition is violated', async () => {
    const store = MemorySpecEventStore.create<TestEvent>();

    await store.append([storedEvent]);

    await expect(store.append([appendedEvent], {failIfEventsMatch: Query.where({tags: ['conflict']})}))
      .rejects.toMatchObject({
        name: 'AppendConditionFailedError',
        condition: {failIfEventsMatch: Query.where({tags: ['conflict']})},
        conflictingEvents: [{position: 1, event: storedEvent}],
      });

    await expect(store.append([appendedEvent], {failIfEventsMatch: Query.where({tags: ['conflict']})}))
      .rejects.toBeInstanceOf(AppendConditionFailedError);
  });
});
