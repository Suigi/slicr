import {describe, expect, it} from 'vitest';
import {MemorySpecEventStore} from './specEventStore.ts';
import type {Event} from '../types.ts';

type TestEvent = Event<'Created', {readonly value: number}>;

const firstEvent: TestEvent = {type: 'Created', payload: {value: 1}, tags: []};
const secondEvent: TestEvent = {type: 'Created', payload: {value: 2}, tags: []};
const thirdEvent: TestEvent = {type: 'Created', payload: {value: 3}, tags: []};

describe('MemorySpecEventStore.read', () => {
  it('returns only later sequenced events when from is provided', async () => {
    const store = MemorySpecEventStore.create<TestEvent>();

    await store.append([firstEvent, secondEvent, thirdEvent]);

    await expect(store.read({from: 1})).resolves.toEqual([
      {position: 2, event: secondEvent},
      {position: 3, event: thirdEvent},
    ]);
  });
});
