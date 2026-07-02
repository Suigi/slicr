import {describe, expect, it} from 'vitest';
import {MemorySpecEventStore} from '../memoryStore/specEventStore';
import {Query} from '../query';
import type {Event} from '../types';
import {subscribeProjectorToStore, type ProjectorDefinition} from './index';

type CounterEvent = Event<'CounterIncremented' | 'CounterRenamed', {readonly counterId: string; readonly amount?: number; readonly name?: string}>;
type CounterScope = {readonly counterId: string};
type CounterState = {readonly total: number};

const incremented = (counterId: string, amount: number): CounterEvent => ({
  type: 'CounterIncremented',
  payload: {counterId, amount},
  tags: [`counterId:${counterId}`],
});

const renamed = (counterId: string, name: string): CounterEvent => ({
  type: 'CounterRenamed',
  payload: {counterId, name},
  tags: [`counterId:${counterId}`],
});

const counterProjector: ProjectorDefinition<CounterEvent, CounterScope, CounterState, number> = {
  query: ({counterId}) => Query.where({types: ['CounterIncremented'], tags: [`counterId:${counterId}`]}),
  initialState: () => ({total: 0}),
  evolve: (state, event) => ({total: state.total + (event.payload.amount ?? 0)}),
  projection: (state) => state.total,
};

const subscribeCounter = async (store: MemorySpecEventStore<CounterEvent>) => {
  const deliveredProjections: number[] = [];
  const subscription = await subscribeProjectorToStore(store, counterProjector, {counterId: 'counter-1'}, projection => {
    deliveredProjections.push(projection);
  });
  return {deliveredProjections, subscription};
};

describe('subscribeProjectorToStore', () => {
  it('delivers the current projection after initial catch-up', async () => {
    const store = MemorySpecEventStore.create<CounterEvent>();
    await store.append([
      incremented('counter-1', 2),
      incremented('counter-2', 100),
      incremented('counter-1', 5),
    ]);

    const {deliveredProjections} = await subscribeCounter(store);

    expect(deliveredProjections).toEqual([7]);
  });

  it('ignores appends that do not match the projector query', async () => {
    const store = MemorySpecEventStore.create<CounterEvent>();
    await store.append([incremented('counter-1', 2)]);
    const {deliveredProjections} = await subscribeCounter(store);

    await store.append([renamed('counter-1', 'still-ignored')]);
    await store.append([incremented('counter-2', 50)]);

    expect(deliveredProjections).toEqual([2]);
  });

  it('delivers updated projections after matching appends', async () => {
    const store = MemorySpecEventStore.create<CounterEvent>();
    await store.append([incremented('counter-1', 2)]);
    const {deliveredProjections} = await subscribeCounter(store);

    await store.append([incremented('counter-1', 3)]);

    expect(deliveredProjections).toEqual([2, 5]);
  });

  it('does not replay already-applied events on later matching appends', async () => {
    const store = MemorySpecEventStore.create<CounterEvent>();
    await store.append([incremented('counter-1', 2)]);
    const {deliveredProjections} = await subscribeCounter(store);

    await store.append([incremented('counter-1', 3)]);
    await store.append([incremented('counter-1', 4)]);

    expect(deliveredProjections).toEqual([2, 5, 9]);
  });

  it('stops delivering projections after unsubscribe', async () => {
    const store = MemorySpecEventStore.create<CounterEvent>();
    await store.append([incremented('counter-1', 2)]);
    const {deliveredProjections, subscription} = await subscribeCounter(store);

    subscription.unsubscribe();
    await store.append([incremented('counter-1', 8)]);

    expect(deliveredProjections).toEqual([2]);
  });

  it('observes matching appends that happen while the initial projection is being delivered', async () => {
    const store = MemorySpecEventStore.create<CounterEvent>();
    await store.append([incremented('counter-1', 2)]);
    const deliveredProjections: number[] = [];
    let appendedDuringInitialDelivery = false;

    await subscribeProjectorToStore(store, counterProjector, {counterId: 'counter-1'}, async projection => {
      deliveredProjections.push(projection);
      if (!appendedDuringInitialDelivery) {
        appendedDuringInitialDelivery = true;
        await store.append([incremented('counter-1', 3)]);
      }
    });

    expect(deliveredProjections).toEqual([2, 5]);
  });
});
