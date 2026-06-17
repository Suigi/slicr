import {describe, expect, it} from 'vitest';
import {Query} from './query.ts';
import type {Event} from './types.ts';
import {MemorySpecEventStore} from './memoryStore/specEventStore.ts';
import {AppendConditionFailedError, SequencedEvent} from './specStore.ts';
import {type Decider, handleCommand} from './deciders';

type Events = Event<'incremented', { amount: number }> | Event<'reset', void>;

const createIncrementedEvent = (number: number): Events => {
  return {type: 'incremented', payload: {amount: number}, tags: []};
};

describe('DCB command handler', () => {
  const decider: Decider<{ incrementBy: number }, Events, { currentCount: number }> = {
    query: () => Query.where({types: ['incremented', 'reset']}),
    project: (events) => {
      let currentCount = 0;
      events.forEach(event => {
        switch (event.type) {
          case 'incremented':
            currentCount += event.payload.amount;
            break;
          case 'reset':
            currentCount = 0;
            break;
        }
      });
      return {currentCount};
    },
    decide: (command, decisionModel) => {
      if (decisionModel.currentCount < 10) {
        return [
          {type: 'incremented', payload: {amount: command.incrementBy}, tags: []}
        ];
      }
      return [];
    },
  };

  it('appends emitted events to store', async () => {
    const command = {incrementBy: 10};
    const store = MemorySpecEventStore.create<Events>();

    const appendedEvents = await handleCommand(store, decider, command);

    const storedEvents = await store.query(Query.all(), {from: 0});
    const incrementedEvent = createIncrementedEvent(10);
    expect(appendedEvents)
      .toEqual(storedEvents);
    expect(storedEvents)
      .toEqual([
        SequencedEvent.wrap(incrementedEvent, 1)
      ]);
  });

  it('feeds decider with queried events', async () => {
    const command = {incrementBy: 10};
    const store = MemorySpecEventStore.create<Events>();
    await store.append([createIncrementedEvent(10)]);

    const appendedEvents = await handleCommand(store, decider, command);

    const storedEvents = await store.query(Query.all(), {from: 1});
    expect(appendedEvents)
      .toEqual([]);
    expect(storedEvents)
      .toEqual([]);
  });

  it('throws when new Events have been emitted between query and append', async () => {
    const command = {incrementBy: 1};
    const store = MemorySpecEventStore.create<Events>();
    await store.append([createIncrementedEvent(5)]);

    const query = decider.query(command);
    const sequencedEvents = await store.query(query);
    const decisionModel = decider.project(sequencedEvents.map((event) => event.event));
    const eventsToEmit = decider.decide(command, decisionModel);

    // Emitting extra event between query and append
    const extraEvent = await store.append([createIncrementedEvent(5)]);

    const appendCondition = {
      failIfEventsMatch: query,
      after: Math.max(...sequencedEvents.map((event) => event.position))
    };
    await expect(() => store.append(eventsToEmit, appendCondition))
      .rejects
      .toThrow(new AppendConditionFailedError(appendCondition, extraEvent));
  });

});
