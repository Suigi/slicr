import type {Event, Store} from '../types';
import {Query, type QueryItem} from '../query';

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
    if (query.kind === 'none') {
      return [];
    }

    if (query.kind === 'all') {
      return [...this.storedEvents];
    }

    return this.storedEvents.filter(e => query.items.some(qi => this.matches(qi, e)));
  }

  private matches(queryItem: QueryItem, event: E): boolean {
    const typeMatches = queryItem.types?.some(type => event.type === type) ?? true;
    const tagsMatch = queryItem.tags?.every(tag => event.tags.includes(tag)) ?? true;
    return typeMatches && tagsMatch;
  }
}