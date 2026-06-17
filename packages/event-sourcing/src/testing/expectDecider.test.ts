import {describe, it} from 'vitest';
import type {Decider} from '../deciders';
import {Query} from '../query';
import type {Event} from '../types';
import {expectDecider} from './expectDecider';

type IncrementCounterCommand = {counterId: string};
type CounterEvent = Event<'incremented', {counterId: string}>;

const incrementedEvent = (counterId: string): CounterEvent => ({
  type: 'incremented',
  payload: {counterId},
  tags: [`counterId:${counterId}`],
});

const incrementDecider: Decider<IncrementCounterCommand, CounterEvent, number> = {
  query: command => Query.where({tags: [`counterId:${command.counterId}`]}),
  project: events => events.length,
  decide: (command, currentCount) => {
    if (currentCount >= 1) {
      throw new Error(`Counter is at max value (${currentCount})`);
    }

    return [incrementedEvent(command.counterId)];
  },
};

describe('expectDecider', () => {
  it('asserts emitted events from a decider', async () => {
    await expectDecider(incrementDecider)
      .given()
      .when({counterId: 'my_counter'})
      .thenEmits(incrementedEvent('my_counter'));
  });

  it('feeds the decider with given events', async () => {
    await expectDecider(incrementDecider)
      .given(incrementedEvent('my_counter'))
      .when({counterId: 'my_counter'})
      .thenThrows(new Error('Counter is at max value (1)'));
  });
});
