import {describe, expect, it} from 'vitest';
import {MemorySpecEventStore} from './specEventStore.ts';
import type {Event} from '../types.ts';

type TestEvent = Event<'Created', {readonly value: number}>;

const firstEvent: TestEvent = {type: 'Created', payload: {value: 1}, tags: []};
const secondEvent: TestEvent = {type: 'Created', payload: {value: 2}, tags: []};

describe('MemorySpecEventStore.append', () => {
  it('assigns increasing sequence positions starting at 1', async () => {
    const store = MemorySpecEventStore.create<TestEvent>();

    await expect(store.append([firstEvent, secondEvent])).resolves.toEqual([
      {position: 1, event: firstEvent},
      {position: 2, event: secondEvent},
    ]);
  });
});
