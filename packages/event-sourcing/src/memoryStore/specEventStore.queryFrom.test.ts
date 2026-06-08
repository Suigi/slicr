import {describe, expect, it} from 'vitest';
import {Query} from '../query.ts';
import {MemorySpecEventStore} from './specEventStore.ts';
import type {Event} from '../types.ts';

type TestEvent = Event<'Created', {readonly value: number}>;

const firstEvent: TestEvent = {type: 'Created', payload: {value: 1}, tags: ['match']};
const secondEvent: TestEvent = {type: 'Created', payload: {value: 2}, tags: ['other']};
const thirdEvent: TestEvent = {type: 'Created', payload: {value: 3}, tags: ['match']};

describe('MemorySpecEventStore.query', () => {
  it('applies both query matching and from filtering', async () => {
    const store = MemorySpecEventStore.create<TestEvent>();

    await store.append([firstEvent, secondEvent, thirdEvent]);

    await expect(store.query(Query.where({tags: ['match']}), {from: 1})).resolves.toEqual([
      {position: 3, event: thirdEvent},
    ]);
  });
});
