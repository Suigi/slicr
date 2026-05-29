import {Query} from './query';
import type {Event, Store} from './types';
import {MemoryStore} from './memoryStore/memoryStore';

export type CommandQuery<Command> = Query | ((command: Command) => Query);

export type ProjectionFunction<Command, ExistingEvent extends Event, DecisionModel> = (
  events: readonly ExistingEvent[],
  command: Command,
) => DecisionModel;

export type DecisionFunction<Command, DecisionModel, EmittedEvent extends Event> = (
  command: Command,
  decisionModel: DecisionModel,
) => EmittedEvent | readonly EmittedEvent[];

export type CommandHandler<Command, EmittedEvent extends Event> = {
  handle(command: Command): EmittedEvent[];
};

export type CommandHandlerConfig<Command, EventType extends Event, DecisionModel> = {
  store: Store<EventType>;
  query: CommandQuery<Command>;
  project: ProjectionFunction<Command, EventType, DecisionModel>;
  decide: DecisionFunction<Command, DecisionModel, EventType>;
};

export function createCommandHandler<Command, EventType extends Event, DecisionModel>(
  config: CommandHandlerConfig<Command, EventType, DecisionModel>,
): CommandHandler<Command, EventType> {
  return {
    handle(command: Command): EventType[] {
      const store = config.store ?? MemoryStore.create();
      const query = typeof config.query === 'function' ? config.query(command) : config.query;
      const existingEvents = store.query(query);
      const decisionModel = config.project(existingEvents, command);
      const decidedEvents = config.decide(command, decisionModel);
      const eventsToAppend = Array.isArray(decidedEvents) ? decidedEvents : [decidedEvents];

      if (eventsToAppend.length > 0) {
        store.append(eventsToAppend);
      }

      return [...eventsToAppend];
    },
  };
}

export const Handler = {
  create: createCommandHandler,
};
