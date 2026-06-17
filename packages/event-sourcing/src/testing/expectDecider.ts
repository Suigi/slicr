import {expect} from 'vitest';
import {handleCommand, type Decider} from '../deciders';
import {MemorySpecEventStore} from '../memoryStore/specEventStore';
import type {Event} from '../types';

export function expectDecider<
  Command,
  ExistingEvent extends Event,
  DecisionModel,
  EmittedEvent extends ExistingEvent = ExistingEvent,
>(decider: Decider<Command, ExistingEvent, DecisionModel>) {
  return {
    given(...givenEvents: ExistingEvent[]) {
      const seededStore = (async () => {
        const store = MemorySpecEventStore.create<ExistingEvent>();
        await store.append(givenEvents);
        return store;
      })();

      return {
        when(command: Command) {
          return {
            async thenEmits(...expectedEvents: EmittedEvent[]) {
              const appendedEvents = await handleCommand(await seededStore, decider, command);

              expect(appendedEvents.map((event) => event.event)).toEqual(expectedEvents);
            },

            async thenThrows(expected: string | RegExp | Error) {
              await expect(handleCommand(await seededStore, decider, command)).rejects.toThrow(expected);
            },
          };
        },
      };
    },
  };
}
