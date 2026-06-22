import type {Decider} from '../deciders';
import type {Query} from '../query';

export type Atom<Event, Scope, Model> = {
  query: (scope: Scope) => Query;
  project: (scope: Scope, events: readonly Event[]) => Model;
};

export const bindAtom = <Command, Event, Scope, Model>(
  atom: Atom<Event, Scope, Model>,
  scope: (command: Command) => Scope,
): Pick<Decider<Command, Event, Model>, 'query' | 'project'> => ({
  query: (command: Command) => atom.query(scope(command)),
  project: (command: Command, events: readonly Event[]) =>
    atom.project(scope(command), events),
});
