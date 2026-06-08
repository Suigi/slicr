import {matchesQueryItem} from '../queryMatcher';
import {Query, type SequencePosition} from '../query';
import {
  AppendConditionFailedError,
  type AppendCondition,
  type ReadOptions,
  type SequencedEvent,
  type SpecEventStore,
} from '../specStore';
import type {Event} from '../types';

export class MemorySpecEventStore<E extends Event> implements SpecEventStore<E> {
  private readonly sequencedEvents: SequencedEvent<E>[] = [];

  static create<E extends Event>() {
    return new MemorySpecEventStore<E>();
  }

  async read(options: ReadOptions = {}): Promise<readonly SequencedEvent<E>[]> {
    return this.readSequencedEvents(options.from);
  }

  async query(query: Query, options: ReadOptions = {}): Promise<readonly SequencedEvent<E>[]> {
    const events = this.readSequencedEvents(options.from);
    if (query.kind === 'none') {
      return [];
    }

    if (query.kind === 'all') {
      return events;
    }

    return events.filter(sequencedEvent => query.items.some(queryItem => matchesQueryItem(queryItem, sequencedEvent.event)));
  }

  async append(events: readonly E[], condition?: AppendCondition): Promise<readonly SequencedEvent<E>[]> {
    const conflictingEvents = condition === undefined ? [] : this.findConflictingEvents(condition);
    if (condition !== undefined && conflictingEvents.length > 0) {
      throw new AppendConditionFailedError(condition, conflictingEvents);
    }

    const startingPosition = this.sequencedEvents.length > 0
      ? this.sequencedEvents[this.sequencedEvents.length - 1]?.position ?? 0
      : 0;
    const appendedEvents = events.map((event, index) => ({
      position: (startingPosition + index + 1) as SequencePosition,
      event,
    }));
    this.sequencedEvents.push(...appendedEvents);
    return appendedEvents;
  }

  private readSequencedEvents(from?: SequencePosition): readonly SequencedEvent<E>[] {
    return from === undefined
      ? [...this.sequencedEvents]
      : this.sequencedEvents.filter(sequencedEvent => sequencedEvent.position > from);
  }

  private findConflictingEvents(condition: AppendCondition): readonly SequencedEvent<E>[] {
    return this.sequencedEvents.filter(sequencedEvent => {
      if (condition.after !== undefined && sequencedEvent.position <= condition.after) {
        return false;
      }
      return condition.failIfEventsMatch.kind === 'none'
        ? false
        : condition.failIfEventsMatch.kind === 'all'
          ? true
          : condition.failIfEventsMatch.items.some(queryItem => matchesQueryItem(queryItem, sequencedEvent.event));
    });
  }
}
