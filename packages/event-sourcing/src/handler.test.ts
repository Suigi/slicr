import {expect, describe, it} from 'vitest';
import {Handler} from './handler.ts';
import {MemoryStore} from './memoryStore/memoryStore.ts';
import {type Event, type Store} from './types.ts';
import {Query} from './query.ts';

type IncrementCounterCommand = { counterId: string; };
type DecrementCounterCommand = { counterId: string; };
type Events = Event<'incremented', { counterId: string }> | Event<'decremented', { counterId: string }>

const counterQuery = (counterId: string) => Query.where({tags: [`counterId:${counterId}`]});
const currentCountProjection = (events: readonly Events[]) => events.reduce((acc, event) => {
  if (event.type === 'incremented') {
    return acc + 1;
  } else if (event.type === 'decremented') {
    return acc - 1;
  }
  return acc;
}, 0);

const incrementCommandHandler = (store: Store<Events>) =>
  Handler.create<IncrementCounterCommand, Events, number>({
    store,
    query: command => counterQuery(command.counterId),
    project: currentCountProjection,
    decide: (command, currentCount) => {
      if (currentCount < 10) {
        return [{
          type: 'incremented',
          payload: {counterId: command.counterId},
          tags: [`counterId:${command.counterId}`]
        }];
      } else {
        throw new Error(`Counter is at max value (${currentCount})`);
      }
    }
  });

const decrementCommandHandler = (store: Store<Events>) =>
  Handler.create<DecrementCounterCommand, Events, number>({
    store,
    query: c => counterQuery(c.counterId),
    project: currentCountProjection,
    decide: (command, currentCount) => {
      if (currentCount > 0) {
        return [decrementedEvent(command.counterId)];
      }
      throw new Error(`Counter ${command.counterId} is at min value (${currentCount})`);
    }
  });

const incrementedEvent = (counterId: string): Events => {
  return {type: 'incremented', payload: {counterId: counterId}, tags: [`counterId:${counterId}`]};
};

const decrementedEvent = (counterId: string): Events => {
  return {type: 'decremented', payload: {counterId: counterId}, tags: [`counterId:${counterId}`]};
};

describe('CommandHandler', () => {
  it('increments new counter', () => {
    const store = MemoryStore.create<Events>();

    incrementCommandHandler(store).handle({counterId: 'my_counter'});

    expect(store.query(Query.all()))
      .toEqual([
        incrementedEvent('my_counter')
      ]);
  });

  it('increments existing counter', () => {
    const store = MemoryStore.create<Events>();
    store.append(incrementedEvent('my_counter'));

    incrementCommandHandler(store).handle({counterId: 'my_counter'});

    expect(store.query(Query.all()))
      .toEqual([
        incrementedEvent('my_counter'),
        incrementedEvent('my_counter')
      ]);
  });

  it('fails to increment counter above maximum of 10', () => {
    const store = MemoryStore.create<Events>();
    for (let i = 0; i < 10; i++) {
      store.append(incrementedEvent('my_counter'));
    }

    expect(() => incrementCommandHandler(store).handle({counterId: 'my_counter'}))
      .toThrow(new Error('Counter is at max value (10)'));
  });

  it('fails to decrement non-existent counter', () => {
    const store = MemoryStore.create<Events>();

    const handler = decrementCommandHandler(store);

    expect(() => handler.handle({counterId: 'my_counter'}))
      .toThrow(new Error('Counter my_counter is at min value (0)'));
  });

  it('decrements existing counter', () => {
    const store = MemoryStore.create<Events>();
    store.append(incrementedEvent('my_counter'));

    const handler = decrementCommandHandler(store);
    handler.handle({counterId: 'my_counter'});

    expect(store.query(Query.where({types: ['decremented']})))
      .toEqual([
        decrementedEvent('my_counter')
      ]);
  });
});