import type {Query, SequencePosition} from './query.ts';
import type {Event} from './types';

export type SequencedEvent<E extends Event> = {
  readonly position: SequencePosition;
  readonly event: E;
};

export const SequencedEvent = {
  wrap<E extends Event>(event: E, position: SequencePosition): SequencedEvent<E> {
    return {position, event};
  },
};

export type ReadOptions = {
  readonly from?: SequencePosition;
};

export type AppendCondition = {
  readonly failIfEventsMatch: Query;
  readonly after?: SequencePosition;
};

export class AppendConditionFailedError extends Error {
  readonly condition: AppendCondition;
  readonly conflictingEvents: readonly SequencedEvent<Event>[];

  constructor(condition: AppendCondition, conflictingEvents: readonly SequencedEvent<Event>[]) {
    super('Append condition failed; the model changed concurrently. Re-read the model and retry the command.');
    this.name = 'AppendConditionFailedError';
    this.condition = condition;
    this.conflictingEvents = conflictingEvents;
  }
}

export type StoreSubscription = {
  unsubscribe(): void;
};

export type AppendedEventsListener<E extends Event> = (events: readonly SequencedEvent<E>[]) => void | Promise<void>;

export interface SpecEventStore<E extends Event> {
  read(options?: ReadOptions): Promise<readonly SequencedEvent<E>[]>;
  query(query: Query, options?: ReadOptions): Promise<readonly SequencedEvent<E>[]>;
  /** An empty batch is an unconditional no-op: no condition check, persisted events, or notifications. */
  append(events: readonly E[], condition?: AppendCondition): Promise<readonly SequencedEvent<E>[]>;
  subscribe(query: Query, listener: AppendedEventsListener<E>): StoreSubscription;
}
