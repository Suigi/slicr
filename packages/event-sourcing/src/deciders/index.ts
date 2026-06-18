import type {Decider} from './types';
import type {Event} from '../types';
import type {SpecEventStore} from '../specStore';

export * from './types';

export async function handleCommand<Command, E extends Event, DecisionModel>(
  store: SpecEventStore<E>,
  decider: Decider<Command, E, DecisionModel>,
  command: Command
) {

  const query = decider.query(command);
  const sequencedEvents = await store.query(query);
  const decisionModel = decider.project(sequencedEvents.map((event) => event.event));
  const eventsToEmit = decider.decide(command, decisionModel);
  if (eventsToEmit.length === 0) {
    return [];
  }
  const lastSeenPosition = sequencedEvents.length === 0 ? 0 : Math.max(...sequencedEvents.map((event) => event.position));
  return await store.append(eventsToEmit, {
    failIfEventsMatch: query,
    after: lastSeenPosition
  });
}