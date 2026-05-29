import {describe, it} from 'vitest';
import {Handler} from '../handler.ts';
import {Query} from '../query.ts';
import type {Event, Store} from '../types.ts';
import {expectHandler} from './expectHandler.ts';

type IncrementCounterCommand = {counterId: string};
type CounterEvent = Event<'incremented', {counterId: string}>;

const incrementedEvent = (counterId: string): CounterEvent => ({
  type: 'incremented',
  payload: {counterId},
  tags: [`counterId:${counterId}`],
});

const incrementCommandHandler = (store: Store<CounterEvent>) =>
  Handler.create<IncrementCounterCommand, CounterEvent, number>({
    store,
    query: command => Query.where({tags: [`counterId:${command.counterId}`]}),
    project: events => events.length,
    decide: (command, currentCount) => {
      if (currentCount >= 1) {
        throw new Error(`Counter is at max value (${currentCount})`);
      }

      return incrementedEvent(command.counterId);
    },
  });

describe('expectHandler', () => {
  it('asserts emitted events from a command handler', () => {
    expectHandler(incrementCommandHandler)
      .given()
      .when({counterId: 'my_counter'})
      .thenEmits(incrementedEvent('my_counter'));
  });

  it('asserts appended events after the given events', () => {
    expectHandler(incrementCommandHandler)
      .given()
      .when({counterId: 'my_counter'})
      .thenEmits(incrementedEvent('my_counter'));
  });

  it('asserts thrown errors', () => {
    expectHandler(incrementCommandHandler)
      .given(incrementedEvent('my_counter'))
      .when({counterId: 'my_counter'})
      .thenThrows(new Error('Counter is at max value (1)'));
  });
});
