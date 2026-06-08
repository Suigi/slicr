import {describe, expect, it, vi} from 'vitest';
import {Query} from '../query.ts';
import type {Event, Tag} from '../types.ts';

const {filterEventsByQueryMock} = vi.hoisted(() => ({
  filterEventsByQueryMock: vi.fn(),
}));

vi.mock('../queryMatcher.ts', () => ({
  filterEventsByQuery: filterEventsByQueryMock,
}));

import {MemoryStore} from './memoryStore.ts';

type TestEvent = Event<'NodeAdded', {readonly value: string}>;

const makeEvent = (type: string, value: string, ...tags: Tag[]): TestEvent => ({
  type: type as TestEvent['type'],
  payload: {value},
  tags,
});

describe('MemoryStore.query', () => {
  it('delegates matching to the shared helper', () => {
    const store = MemoryStore.create<TestEvent>();
    const firstEvent = makeEvent('NodeAdded', 'a', 'nodeType:Command');
    const secondEvent = makeEvent('NodeAdded', 'b', 'nodeType:Event');
    const query = Query.where({tags: ['nodeType:Command']});

    filterEventsByQueryMock.mockReturnValue([firstEvent]);

    store.append([firstEvent, secondEvent]);

    expect(store.query(query)).toEqual([firstEvent]);
    expect(filterEventsByQueryMock).toHaveBeenCalledWith([firstEvent, secondEvent], query);
  });
});
