import {filterEventsByQuery} from '../queryMatcher';
import {Query, type Query as QueryType} from '../query';
import type {Atom} from './index';

type AnyAtom = Atom<any, any, any>;

export type EventOf<A> = A extends Atom<infer Event, any, any> ? Event : never;
export type ScopeOf<A> = A extends Atom<any, infer Scope, any> ? Scope : never;
export type ModelOf<A> = A extends Atom<any, any, infer Model> ? Model : never;

export type UnionToIntersection<U> =
  (U extends unknown ? (arg: U) => void : never) extends (arg: infer I) => void
    ? I
    : never;

export type CombinedEvent<AtomsToCombine extends Record<string, AnyAtom>> =
  EventOf<AtomsToCombine[keyof AtomsToCombine]>;

export type CombinedScope<AtomsToCombine extends Record<string, AnyAtom>> =
  UnionToIntersection<ScopeOf<AtomsToCombine[keyof AtomsToCombine]>>;

export type CombinedModel<AtomsToCombine extends Record<string, AnyAtom>> = {
  [Key in keyof AtomsToCombine]: ModelOf<AtomsToCombine[Key]>
};

export const combineQueries = (queries: readonly QueryType[]): QueryType => {
  if (queries.some(query => query.kind === 'all')) {
    // eslint-disable-next-line no-restricted-syntax
    return Query.all();
  }

  const items = queries.flatMap(query => query.kind === 'items' ? query.items : []);

  if (items.length === 0) {
    return Query.none();
  }

  return Query.anyOf(...items);
};

export const combineAtoms = <
  AtomsToCombine extends Record<string, AnyAtom>
>(
  atoms: AtomsToCombine,
): Atom<CombinedEvent<AtomsToCombine>, CombinedScope<AtomsToCombine>, CombinedModel<AtomsToCombine>> => ({

  query: (scope) => combineQueries(
    Object.values(atoms).map(atom =>
      (atom as Atom<CombinedEvent<AtomsToCombine>, CombinedScope<AtomsToCombine>, unknown>).query(scope)
    )
  ),

  project: (scope, events) => Object.fromEntries(
    Object.entries(atoms).map(([key, atom]) => {
      const scopedAtom = atom as Atom<CombinedEvent<AtomsToCombine>, CombinedScope<AtomsToCombine>, unknown>;
      const atomQuery = scopedAtom.query(scope);
      const matchingEvents = filterEventsByQuery(events, atomQuery);

      return [
        key,
        scopedAtom.project(scope, matchingEvents),
      ];
    })
  ) as CombinedModel<AtomsToCombine>,
});
