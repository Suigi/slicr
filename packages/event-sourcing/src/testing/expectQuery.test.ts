import {describe, expect, it} from 'vitest';

import {Query} from '../query';
import type {Event} from '../types';
import {expectQuery} from './expectQuery';

type TestEvent = Event<'TestEvent', {id: string}> | Event<'OtherEvent', {id: string}>;

const testEvent = (id = '1'): TestEvent => ({
  type: 'TestEvent',
  payload: {id},
  tags: [`id:${id}`, 'kind:test'],
});

const otherEvent = (id = '1'): TestEvent => ({
  type: 'OtherEvent',
  payload: {id},
  tags: [`id:${id}`, 'kind:other'],
});

describe('expectQuery', () => {
  it('passes when a query matches an expected event', () => {
    expectQuery(Query.where({types: ['TestEvent'], tags: ['id:1']}))
      .toMatchEvent(testEvent('1'));
  });

  it('passes when a query does not match an unexpected event', () => {
    expectQuery(Query.where({types: ['TestEvent'], tags: ['id:1']}))
      .not.toMatchEvent(otherEvent('1'));
  });

  it('throws when a query does not match an expected event', () => {
    expect(() => {
      expectQuery(Query.where({types: ['TestEvent'], tags: ['id:1']}))
        .toMatchEvent(testEvent('2'));
    }).toThrow();
  });

  it('throws when a query matches an unexpected event', () => {
    expect(() => {
      expectQuery(Query.where({types: ['TestEvent'], tags: ['id:1']}))
        .not.toMatchEvent(testEvent('1'));
    }).toThrow();
  });

  it('multiple not matched events can be chained', () => {
    expect(() => {
      expectQuery(Query.none())
        .not.toMatchEvent(testEvent('1'))
        .not.toMatchEvent(testEvent('2'));
    }).not.toThrow();
  });
});
