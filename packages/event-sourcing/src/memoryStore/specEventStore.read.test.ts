import {describe, expect, it} from 'vitest';
import {MemorySpecEventStore} from './specEventStore.ts';
import type {Event} from '../types.ts';

type TestEvent = Event<'Created', {readonly value: number}>;

const firstEvent: TestEvent = {type: 'Created', payload: {value: 1}, tags: []};
const secondEvent: TestEvent = {type: 'Created', payload: {value: 2}, tags: []};

describe('MemorySpecEventStore.read', () => {
  it('returns sequenced events in append order', async () => {
    const store = MemorySpecEventStore.create<TestEvent>();

    await store.append([firstEvent, secondEvent]);

    await expect(store.read()).resolves.toEqual([
      {position: 1, event: firstEvent},
      {position: 2, event: secondEvent},
    ]);
  });
});
