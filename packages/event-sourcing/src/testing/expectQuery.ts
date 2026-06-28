import {assert} from 'vitest';

import type {Query} from '../query';
import {filterEventsByQuery} from '../queryMatcher';
import type {Event} from '../types';

export function expectQuery<E extends Event>(query: Query) {
  const assertion = {
    toMatchEvent(event: E) {
      const matchedEvents = filterEventsByQuery([event], query);
      if (matchedEvents.length === 0) {
        assert.fail(`Expected query to match \n${JSON.stringify(event, null, 2)}\n`);
      }
      return assertion;
    },
    not: {
      toMatchEvent(event: E) {
        const matchedEvents = filterEventsByQuery([event], query);
        if (matchedEvents.length > 0) {
          assert.fail(`Expected query NOT to match \n${JSON.stringify(event, null, 2)}\n, but it did.`);
        }
        return assertion;
      },
    },
  };

  return assertion;
}
