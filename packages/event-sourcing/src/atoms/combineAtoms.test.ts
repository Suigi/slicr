// noinspection JSDeprecatedSymbols

import {describe, expect, it} from 'vitest';
import {Query} from '../query.ts';
import {combineAtoms} from './combineAtoms.ts';
import type {Event} from '../types.ts';

describe('combineAtoms', () => {
  it('combines queries with anyOf', () => {
    const atomA = {
      query: () => Query.where({types: ['A']}),
      project: () => undefined,
    };
    const atomB = {
      query: () => Query.where({types: ['B']}),
      project: () => undefined,
    };

    const combinedAtom = combineAtoms({a: atomA, b: atomB});

    expect(combinedAtom.query(undefined))
      .toEqual(Query.anyOf(
        {types: ['A']},
        {types: ['B']},
      ));
  });

  it('ignores Query.none() if other Queries exist', () => {
    const atomA = {
      query: () => Query.none(),
      project: () => undefined,
    };
    const atomB = {
      query: () => Query.where({types: ['B']}),
      project: () => undefined,
    };

    const combinedAtom = combineAtoms({a: atomA, b: atomB});

    expect(combinedAtom.query(undefined))
      .toEqual(Query.anyOf(
        {types: ['B']},
      ));
  });

  it('returns Query.none() if all sub-atoms are Query.none()', () => {
    const atomA = {
      query: () => Query.none(),
      project: () => undefined,
    };
    const atomB = {
      query: () => Query.none(),
      project: () => undefined,
    };

    const combinedAtom = combineAtoms({a: atomA, b: atomB});

    expect(combinedAtom.query(undefined))
      .toEqual(Query.none());
  });

  it('returns Query.all() if any child query is all()', () => {
    const atomA = {
      query: () => Query.where({types: ['A']}),
      project: () => undefined,
    };
    const atomB = {
      query: () => Query.all(),
      project: () => undefined,
    };

    const combinedAtom = combineAtoms({a: atomA, b: atomB});

    expect(combinedAtom.query(undefined))
      .toEqual(Query.all());
  });

  it('combines projections with specified object shape', () => {
    const atomA = {
      query: () => Query.none(),
      project: () => 'a',
    };
    const atomB = {
      query: () => Query.none(),
      project: () => 'b',
    };

    const combinedAtom = combineAtoms({a: atomA, b: atomB});

    expect(combinedAtom.project(undefined, []))
      .toEqual({
        a: 'a',
        b: 'b',
      });
  });

  it('passes scope to sub-atoms', () => {
    const atomA = makeSpyAtom();
    const atomB = makeSpyAtom();

    const combinedAtom = combineAtoms({a: atomA.atom, b: atomB.atom});

    combinedAtom.project({scope: 'scope'}, []);

    expect(atomA.receivedScope())
      .toEqual({scope: 'scope'});
    expect(atomB.receivedScope())
      .toEqual({scope: 'scope'});
  });

  it('passes events to sub-atoms', () => {
    const atomA = makeSpyAtom();
    const atomB = makeSpyAtom();
    const events: Event[] = [
      {type: 'FirstEvent', payload: {}, tags: []},
      {type: 'FirstEvent', payload: {}, tags: []},
    ];

    const combinedAtom = combineAtoms({a: atomA.atom, b: atomB.atom});
    combinedAtom.project(undefined, events);

    expect(atomA.receivedEvents())
      .toEqual(events);
    expect(atomB.receivedEvents())
      .toEqual(events);
  });

  it('filters events based on the sub-atom query', () => {
    const atomA = makeSpyAtom();
    const atomB = makeSpyAtom(Query.where({types: ['SecondEvent']}));
    const firstEvent = {type: 'FirstEvent', payload: {}, tags: []};
    const secondEvent = {type: 'SecondEvent', payload: {}, tags: []};

    const combinedAtom = combineAtoms({a: atomA.atom, b: atomB.atom});
    combinedAtom.project(undefined, [firstEvent, secondEvent]);

    expect(atomB.receivedEvents())
      .toEqual([secondEvent]);
  });

});

const makeSpyAtom = (query: Query = Query.all()) => {
  let receivedScope: unknown = undefined;
  const receivedEvents: Event[] = [];
  const atom = {
    query: () => query,
    project: (scope: unknown, events: readonly Event[]) => {
      receivedScope = scope;
      receivedEvents.push(...events);
    },
  };
  return {
    atom,
    receivedScope: () => receivedScope,
    receivedEvents: () => receivedEvents,
  };
};
