import type {Query, QueryItem} from './query.ts';
import type {Event} from './types.ts';

export const filterEventsByQuery = <E extends Event>(events: readonly E[], query: Query): E[] => {
  if (query.kind === 'none') {
    return [];
  }

  if (query.kind === 'all') {
    return [...events];
  }

  return events.filter(event => query.items.some(queryItem => matchesQueryItem(queryItem, event)));
};

export const matchesQueryItem = <E extends Event>(queryItem: QueryItem, event: E): boolean => {
  const typeMatches = queryItem.types?.some(type => event.type === type) ?? true;
  const tagsMatch = queryItem.tags?.every(tag => event.tags.includes(tag)) ?? true;
  return typeMatches && tagsMatch;
};
