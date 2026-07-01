import type {Query} from '../query';
import type {ReadOptions, SpecEventStore} from '../specStore';
import type {Event as EventBase} from '../types';

export type ProjectorDefinition<Event extends EventBase, Scope, State, Projection> = {
  query(scope: Scope): Query;
  initialState(scope: Scope): State;
  evolve(state: State, event: Event, scope: Scope): State;
  projection(state: State, scope: Scope): Projection;
};

export type ProjectorInstance<Event extends EventBase, Projection> = {
  query(): Query;
  evolve(event: Event): void;
  projection(): Projection;
};

export const createProjectorInstance = <Event extends EventBase, Scope, State, Projection>(
  definition: ProjectorDefinition<Event, Scope, State, Projection>,
  scope: Scope,
): ProjectorInstance<Event, Projection> => {
  let state = definition.initialState(scope);

  return {
    query: () => definition.query(scope),
    evolve: (event) => {
      state = definition.evolve(state, event, scope);
    },
    projection: () => definition.projection(state, scope),
  };
};

export const replayProjector = <Event extends EventBase, Projection>(
  instance: ProjectorInstance<Event, Projection>,
  events: readonly Event[],
): Projection => {
  events.forEach((event) => instance.evolve(event));
  return instance.projection();
};

export const projectFromStore = async <Event extends EventBase, Scope, State, Projection>(
  store: SpecEventStore<Event>,
  definition: ProjectorDefinition<Event, Scope, State, Projection>,
  scope: Scope,
  options?: ReadOptions,
): Promise<Projection> => {
  const instance = createProjectorInstance(definition, scope);
  const sequencedEvents = await store.query(instance.query(), options);
  return replayProjector(instance, sequencedEvents.map(({event}) => event));
};
