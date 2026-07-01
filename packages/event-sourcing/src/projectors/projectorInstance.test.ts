import {describe, expect, it} from 'vitest';

import {Query} from '../query';
import {MemorySpecEventStore} from '../memoryStore/specEventStore';
import {createProjectorInstance, projectFromStore, replayProjector, type ProjectorDefinition, type ProjectorInstance} from './index';
import type {Event} from '../types';

type CounterEvent = Event<'Incremented' | 'Renamed', {amount?: number; name?: string}>;
type CounterScope = {counterId: string};
type CounterState = {total: number; label: string};

describe('createProjectorInstance', () => {
  it('exposes the scoped query and evolves internal state one event at a time', () => {
    const projector: ProjectorDefinition<CounterEvent, CounterScope, CounterState, string> = {
      query: (scope) => Query.where({types: ['Incremented', 'Renamed'], tags: [`counterId:${scope.counterId}`]}),
      initialState: (scope) => ({total: 0, label: scope.counterId}),
      evolve: (state, event, scope) => {
        if (!event.tags.includes(`counterId:${scope.counterId}`)) {
          return state;
        }
        if (event.type === 'Incremented') {
          return {...state, total: state.total + (event.payload.amount ?? 1)};
        }
        if (event.type === 'Renamed') {
          return {...state, label: event.payload.name ?? state.label};
        }
        return state;
      },
      projection: (state, scope) => `${scope.counterId}:${state.label}:${state.total}`,
    };

    const instance = createProjectorInstance(projector, {counterId: 'counter-1'});

    expect(instance.query())
      .toEqual(Query.where({types: ['Incremented', 'Renamed'], tags: ['counterId:counter-1']}));
    expect(instance.projection())
      .toBe('counter-1:counter-1:0');

    instance.evolve({type: 'Incremented', payload: {amount: 2}, tags: ['counterId:counter-1']});
    instance.evolve({type: 'Renamed', payload: {name: 'Primary'}, tags: ['counterId:counter-1']});

    expect(instance.projection())
      .toBe('counter-1:Primary:2');
  });

  it('replays events into a projector instance in order and returns the final projection', () => {
    const evolvedEvents: string[] = [];
    const instance: ProjectorInstance<CounterEvent, string> = {
      query: () => Query.none(),
      evolve: (event) => {
        evolvedEvents.push(`${event.type}:${event.payload.amount ?? event.payload.name}`);
      },
      projection: () => evolvedEvents.join('|'),
    };

    const projection = replayProjector(instance, [
      {type: 'Incremented', payload: {amount: 1}, tags: []},
      {type: 'Renamed', payload: {name: 'after-first'}, tags: []},
      {type: 'Incremented', payload: {amount: 3}, tags: []},
    ]);

    expect(projection)
      .toBe('Incremented:1|Renamed:after-first|Incremented:3');
  });

  it('queries a spec store with the projector query and returns the replayed projection', async () => {
    const store = MemorySpecEventStore.create<CounterEvent>();
    await store.append([
      {type: 'Incremented', payload: {amount: 1}, tags: ['counterId:counter-1']},
      {type: 'Renamed', payload: {name: 'ignored'}, tags: ['counterId:counter-1']},
      {type: 'Incremented', payload: {amount: 5}, tags: ['counterId:counter-2']},
      {type: 'Incremented', payload: {amount: 2}, tags: ['counterId:counter-1']},
    ]);
    const projector: ProjectorDefinition<CounterEvent, CounterScope, CounterState, number> = {
      query: (scope) => Query.where({types: ['Incremented'], tags: [`counterId:${scope.counterId}`]}),
      initialState: () => ({total: 0, label: ''}),
      evolve: (state, event) => ({...state, total: state.total + (event.payload.amount ?? 0)}),
      projection: (state) => state.total,
    };

    await expect(projectFromStore(store, projector, {counterId: 'counter-1'})).resolves.toBe(3);
  });

  it('creates a fresh projector instance for each store projection', async () => {
    const store = MemorySpecEventStore.create<CounterEvent>();
    await store.append([
      {type: 'Incremented', payload: {amount: 1}, tags: ['counterId:counter-1']},
      {type: 'Incremented', payload: {amount: 2}, tags: ['counterId:counter-1']},
    ]);
    const projector: ProjectorDefinition<CounterEvent, CounterScope, CounterState, number> = {
      query: (scope) => Query.where({types: ['Incremented'], tags: [`counterId:${scope.counterId}`]}),
      initialState: () => ({total: 0, label: ''}),
      evolve: (state, event) => ({...state, total: state.total + (event.payload.amount ?? 0)}),
      projection: (state) => state.total,
    };

    await expect(projectFromStore(store, projector, {counterId: 'counter-1'})).resolves.toBe(3);
    await expect(projectFromStore(store, projector, {counterId: 'counter-1'})).resolves.toBe(3);
  });
});
