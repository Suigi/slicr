import {type Query, type SequencePosition} from './query';
import type {Event} from './types';

export type SequencedEvent<E extends Event> = {
  readonly position: SequencePosition;
  readonly event: E;
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
    super('Append condition failed');
    this.name = 'AppendConditionFailedError';
    this.condition = condition;
    this.conflictingEvents = conflictingEvents;
  }
}

export interface SpecEventStore<E extends Event> {
  read(options?: ReadOptions): Promise<readonly SequencedEvent<E>[]>;
  query(query: Query, options?: ReadOptions): Promise<readonly SequencedEvent<E>[]>;
  append(events: readonly E[], condition?: AppendCondition): Promise<readonly SequencedEvent<E>[]>;
}
