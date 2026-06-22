import type {Event as EventBase} from '../types';
import type {Atom} from './index';

export const rescopeAtom = <Event extends EventBase, OuterScope, InnerScope, Model>(
  atom: Atom<Event, InnerScope, Model>,
  scope: (outerScope: OuterScope) => InnerScope,
): Atom<Event, OuterScope, Model> => ({
  query: (outerScope) => atom.query(scope(outerScope)),
  project: (outerScope, events) => atom.project(scope(outerScope), events),
});
