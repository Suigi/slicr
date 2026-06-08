import {describe, expect, it} from 'vitest';
import {Query} from './query.ts';
import {filterEventsByQuery} from './queryMatcher.ts';
import type {Event} from './types.ts';

type TestEvent = Event<string, {readonly value: string}>;

const firstEvent: TestEvent = {type: 'NodeAdded', payload: {value: 'a'}, tags: ['nodeType:Command']};
const secondEvent: TestEvent = {type: 'NodeAdded', payload: {value: 'b'}, tags: ['nodeType:Event']};
const thirdEvent: TestEvent = {type: 'NodeUpdated', payload: {value: 'c'}, tags: ['nodeType:Command', 'categoryId:cat_A']};

describe('filterEventsByQuery', () => {
  it('preserves none, all, type, tag, and combined query matching semantics', () => {
    expect(filterEventsByQuery([firstEvent, secondEvent, thirdEvent], Query.none())).toEqual([]);
    expect(filterEventsByQuery([firstEvent, secondEvent, thirdEvent], Query.all())).toEqual([firstEvent, secondEvent, thirdEvent]);
    expect(filterEventsByQuery([firstEvent, secondEvent, thirdEvent], Query.where({types: ['NodeAdded']}))).toEqual([firstEvent, secondEvent]);
    expect(filterEventsByQuery([firstEvent, secondEvent, thirdEvent], Query.where({tags: ['nodeType:Command']}))).toEqual([firstEvent, thirdEvent]);
    expect(filterEventsByQuery([firstEvent, secondEvent, thirdEvent], Query.anyOf({types: ['NodeAdded'], tags: ['nodeType:Event']}, {tags: ['categoryId:cat_A']}))).toEqual([secondEvent, thirdEvent]);
  });
});
