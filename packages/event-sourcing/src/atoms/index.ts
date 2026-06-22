import type {Decider} from '../deciders';
import type {Query} from '../query';
import type {Event as EventBase} from '../types';

export * from './combineAtoms';

export type Atom<Event extends EventBase, Scope, Model> = {
  query: (scope: Scope) => Query;
  project: (scope: Scope, events: readonly Event[]) => Model;
};

export const bindAtom = <Command, Event extends EventBase, Scope, Model>(
  atom: Atom<Event, Scope, Model>,
  scope: (command: Command) => Scope,
): Pick<Decider<Command, Event, Model>, 'query' | 'project'> => ({
  query: (command: Command) => atom.query(scope(command)),
  project: (command: Command, events: readonly Event[]) =>
    atom.project(scope(command), events),
});