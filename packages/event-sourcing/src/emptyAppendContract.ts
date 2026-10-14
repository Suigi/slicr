import {expect} from 'vitest';
import {Query} from './query.ts';
import type {SpecEventStore} from './specStore.ts';
import type {Event} from './types.ts';

/** Shared behavioral assertion for each SpecEventStore adapter. */
export async function expectEmptyAppendIsNoOp<E extends Event>(store: SpecEventStore<E>, event: E): Promise<void> {
  const notifications: unknown[] = [];
  const matchingQuery = Query.where({types: [event.type]});
  const subscription = store.subscribe(matchingQuery, (events) => {
    notifications.push(events);
  });
  try {
    const [existing] = await store.append([event]);
    expect(existing).toBeDefined();
    notifications.length = 0;
    const before = await store.read();
    // The condition conflicts with the already persisted event; an empty batch must not evaluate it.
    await expect(store.append([], {failIfEventsMatch: matchingQuery})).resolves.toEqual([]);
    expect(await store.read()).toEqual(before);
    expect(notifications).toEqual([]);
    const [next] = await store.append([event]);
    expect(next!.position).toBe(existing!.position + 1);
    expect(notifications).toEqual([[next]]);
  } finally {
    subscription.unsubscribe();
  }
}
