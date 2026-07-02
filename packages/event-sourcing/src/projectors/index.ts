import type {Query, SequencePosition} from '../query';
import type {ReadOptions, SequencedEvent, SpecEventStore, StoreSubscription} from '../specStore';
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

export type SequencedProjectorInstance<Event extends EventBase, Projection> = {
  query(): Query;
  evolve(event: SequencedEvent<Event>): void;
  projection(): Projection;
  lastAppliedPosition(): SequencePosition | undefined;
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

export const createSequencedProjectorInstance = <Event extends EventBase, Scope, State, Projection>(
  definition: ProjectorDefinition<Event, Scope, State, Projection>,
  scope: Scope,
): SequencedProjectorInstance<Event, Projection> => {
  const instance = createProjectorInstance(definition, scope);
  let lastAppliedPosition: SequencePosition | undefined;

  return {
    query: instance.query,
    evolve: (sequencedEvent) => {
      instance.evolve(sequencedEvent.event);
      lastAppliedPosition = sequencedEvent.position;
    },
    projection: instance.projection,
    lastAppliedPosition: () => lastAppliedPosition,
  };
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

export const catchUpProjectorFromStore = async <Event extends EventBase, Projection>(
  store: SpecEventStore<Event>,
  instance: SequencedProjectorInstance<Event, Projection>,
): Promise<Projection> => {
  const sequencedEvents = await store.query(instance.query(), {from: instance.lastAppliedPosition()});
  sequencedEvents.forEach((sequencedEvent) => instance.evolve(sequencedEvent));
  return instance.projection();
};

export type ProjectorStoreSubscription = StoreSubscription;

export const subscribeProjectorToStore = async <Event extends EventBase, Scope, State, Projection>(
  store: SpecEventStore<Event>,
  definition: ProjectorDefinition<Event, Scope, State, Projection>,
  scope: Scope,
  listener: (projection: Projection) => void | Promise<void>,
): Promise<ProjectorStoreSubscription> => {
  const instance = createSequencedProjectorInstance(definition, scope);
  let catchUpQueue: Promise<void> = Promise.resolve();
  let isCatchingUp = false;
  const scheduleCatchUp = (): Promise<void> => {
    const scheduledCatchUp = catchUpQueue.then(async () => {
      isCatchingUp = true;
      try {
        await listener(await catchUpProjectorFromStore(store, instance));
      } finally {
        isCatchingUp = false;
      }
    });
    catchUpQueue = scheduledCatchUp;
    return scheduledCatchUp;
  };

  const subscription = store.subscribe(instance.query(), () => {
    const wasAlreadyCatchingUp = isCatchingUp;
    const scheduledCatchUp = scheduleCatchUp();
    return wasAlreadyCatchingUp ? undefined : scheduledCatchUp;
  });
  await scheduleCatchUp();
  await catchUpQueue;
  return subscription;
};
