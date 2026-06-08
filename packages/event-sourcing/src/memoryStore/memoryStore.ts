import type {Event, Store} from '../types';
import {Query} from '../query';
import {filterEventsByQuery} from '../queryMatcher';

export class MemoryStore<E extends Event> implements Store<E> {
  private storedEvents: E[] = [];

  static create<E extends Event>() {
    return new MemoryStore<E>();
  }

  append(events: E | E[]) {
    if (!Array.isArray(events)) {
      this.storedEvents.push(events);
    } else {
      this.storedEvents.push(...events);
    }
  }

  query(query: Query): E[] {
    return filterEventsByQuery(this.storedEvents, query);
  }
}