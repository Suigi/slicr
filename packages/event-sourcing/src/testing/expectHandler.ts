import {expect} from 'vitest';
import type {CommandHandler} from '../handler.ts';
import {MemoryStore} from '../memoryStore/memoryStore';
import type {Event, Store} from '../types.ts';

export type CommandHandlerFactory<Command, ExistingEvent extends Event, EmittedEvent extends ExistingEvent> = (
  store: Store<ExistingEvent>,
) => CommandHandler<Command, EmittedEvent>;

export function expectHandler<
  Command,
  ExistingEvent extends Event,
  EmittedEvent extends ExistingEvent = ExistingEvent,
>(createHandler: CommandHandlerFactory<Command, ExistingEvent, EmittedEvent>) {
  return {
    given(...givenEvents: ExistingEvent[]) {
      const store = MemoryStore.create<ExistingEvent>();
      store.append(givenEvents);

      return {
        when(command: Command) {
          return {
            thenEmits(...expectedEvents: EmittedEvent[]) {
              const emittedEvents = createHandler(store).handle(command);

              expect(emittedEvents).toEqual(expectedEvents);
            },

            thenThrows(expected: string | RegExp | Error) {
              expect(() => createHandler(store).handle(command)).toThrow(expected);
            },
          };
        },
      };
    },
  };
}
