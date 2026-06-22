import {describe, expect, it} from 'vitest';
import {Query} from '../query';
import type {Event} from '../types';
import type {Atom} from './index';
import {rescopeAtom} from './rescopeAtom';

type TestEvent = Event<'ThingAdded', { thingId: string }>;

describe('rescopeAtom', () => {
  it('maps outer scope to inner atom scope for queries', () => {
    const atom: Atom<TestEvent, { thingId: string }, boolean> = {
      query: ({thingId}) => Query.where({types: ['ThingAdded'], tags: [`thingId:${thingId}`]}),
      project: () => false,
    };

    const rescopedAtom = rescopeAtom(
      atom,
      (scope: { sourceThingId: string }) => ({thingId: scope.sourceThingId}),
    );

    expect(rescopedAtom.query({sourceThingId: 'source-thing-id'}))
      .toEqual(Query.where({types: ['ThingAdded'], tags: ['thingId:source-thing-id']}));
  });

  it('maps outer scope to inner atom scope for projections', () => {
    const event: TestEvent = {type: 'ThingAdded', payload: {thingId: 'source-thing-id'}, tags: []};
    const atom: Atom<TestEvent, { thingId: string }, { scope: { thingId: string }, events: readonly TestEvent[] }> = {
      query: () => Query.none(),
      project: (scope, events) => ({scope, events}),
    };

    const rescopedAtom = rescopeAtom(
      atom,
      (scope: { sourceThingId: string }) => ({thingId: scope.sourceThingId}),
    );

    expect(rescopedAtom.project({sourceThingId: 'source-thing-id'}, [event]))
      .toEqual({
        scope: {thingId: 'source-thing-id'},
        events: [event],
      });
  });
});
