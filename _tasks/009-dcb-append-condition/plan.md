# DCB Append Condition and Spec-Aligned IndexedDB Event Store

## Goal

Implement a spec-aligned event store in `packages/event-sourcing` that supports DCB-style append conditions and sequence positions, with an IndexedDB-backed implementation that enforces optimistic locking correctly.

The initial target is correctness and API shape, not premature indexing/performance tuning.

## Why this work is needed

The current IndexedDB event store is append-only but not spec-aligned:

- it returns raw events rather than sequenced events
- it does not expose sequence positions
- it cannot read/query from a sequence position
- it does not support append conditions
- it cannot atomically check a conflict condition and append in one operation

Because of that, callers currently have to implement concurrency control outside the store, which is fragile for:

- React Strict Mode remounts
- multiple event store wrapper instances
- multiple browser tabs
- future worker/process boundaries

A correct DCB-style store should move optimistic locking into the persistence boundary.

## Scope

This task adds a new spec-aligned async store API alongside the existing synchronous store API.

In scope:

- add sequence-positioned reads
- add append conditions
- add append-condition failure signaling
- implement a memory-backed spec store
- implement an IndexedDB-backed spec store
- add tests for optimistic locking behavior
- document how bootstrap/default initialization should use conditional append

Out of scope for this slice:

- migrating all existing sync command handlers to the new API
- deleting the old `Store<E>` interface
- building advanced secondary indexes for query speed
- cross-tab notification/subscription features
- full import/export migration unless needed by tests

## Spec-aligned model

### Sequence position

A sequence position is assigned by the event store when an event is appended.

Properties:

- unique within the store
- monotonically increasing
- gaps allowed

Type:

```ts
type SequencePosition = number;
```

### Sequenced event

Reads should return sequence positions together with events.

```ts
type SequencedEvent<E extends Event> = {
  position: SequencePosition;
  event: E;
};
```

### Read options

The store should support reading after a known position.

```ts
type ReadOptions = {
  from?: SequencePosition;
};
```

Semantics:

- if `from` is omitted, return from the beginning
- if `from` is present, return only events with `position > from`

### Append condition

Append conditions provide optimistic locking.

```ts
type AppendCondition = {
  failIfEventsMatch: Query;
  after?: SequencePosition;
};
```

Semantics:

- evaluate `failIfEventsMatch` against stored events
- if `after` is omitted, all stored events are considered
- if `after` is provided, ignore events with `position <= after`
- if any remaining event matches, the append must fail
- otherwise append all provided events

### Append failure

The store should throw a dedicated error when a condition fails.

```ts
class AppendConditionFailedError extends Error {
  constructor(
    readonly condition: AppendCondition,
    readonly conflictingEvents: readonly SequencedEvent<Event>[],
  )
}
```

This allows callers to distinguish concurrency conflicts from storage failures.

## Proposed API

Add a new file such as `packages/event-sourcing/src/specStore.ts`:

```ts
import type {Query} from './query';
import type {Event} from './types';

export type SequencePosition = number;

export type SequencedEvent<E extends Event> = {
  position: SequencePosition;
  event: E;
};

export type ReadOptions = {
  from?: SequencePosition;
};

export type AppendCondition = {
  failIfEventsMatch: Query;
  after?: SequencePosition;
};

export class AppendConditionFailedError extends Error {
  constructor(
    readonly condition: AppendCondition,
    readonly conflictingEvents: readonly SequencedEvent<Event>[],
  ) {
    super('Append condition failed');
  }
}

export interface SpecEventStore<E extends Event> {
  read(options?: ReadOptions): Promise<SequencedEvent<E>[]>;
  query(query: Query, options?: ReadOptions): Promise<SequencedEvent<E>[]>;
  append(events: readonly E[], condition?: AppendCondition): Promise<SequencedEvent<E>[]>;
  replace?(events: readonly E[]): Promise<void>;
  clear?(): Promise<void>;
}
```

## Relationship to the existing API

Keep the current synchronous `Store<E>` interface intact for now.

Reasoning:

- existing graph projector and command handlers already use it
- append-condition support introduces a meaningful async boundary
- trying to retrofit sequence positions and optimistic locking into the old API would create churn
- a parallel API lets us migrate correctness-sensitive paths first

## Memory implementation

Add a new in-memory implementation, e.g.:

- `packages/event-sourcing/src/memoryStore/memorySpecEventStore.ts`

Behavior:

- store `SequencedEvent<E>[]`
- assign incrementing numeric positions starting at `1`
- `read({from})` filters by `position > from`
- `query(query, {from})` filters the read result by query
- `append(events, condition)`:
  - checks conflicts against in-memory sequenced events
  - throws `AppendConditionFailedError` if any conflict matches
  - otherwise assigns positions and stores the new events
  - returns appended sequenced events

This implementation becomes the semantic reference used by unit tests.

## IndexedDB implementation

### File

Create a spec-aligned IndexedDB store implementation, e.g.:

- `packages/event-sourcing/src/indexedDBSpecEventStore.ts`

### Storage schema

Use one object store, likely still named `events`.

Stored row shape:

```ts
type StoredEventRow<E extends Event> = {
  position?: number;
  streamName: string;
  event: E;
};
```

Configuration:

- `keyPath: 'position'`
- `autoIncrement: true`

This lets IndexedDB assign sequence positions.

### Position semantics

`autoIncrement` satisfies the needed properties well enough:

- unique positions
- monotonic increase
- gaps permitted

### Correct append algorithm

This is the critical design requirement.

`append(events, condition)` must perform all of the following in a single `readwrite` transaction:

1. read existing rows for the target stream
2. evaluate the append condition within that transaction
3. abort if any conflict matches
4. append all new events within that same transaction
5. return appended events with assigned positions

Why this matters:

- the conflict check and append must be atomic
- separate read-then-write steps outside one transaction are not sufficient
- correctness must hold across multiple wrappers, tabs, and concurrent callers

### Conflict evaluation

Within the transaction:

- consider only rows whose `streamName` matches the current stream
- if `condition.after` is present, ignore rows with `position <= after`
- evaluate `condition.failIfEventsMatch` using the existing query semantics
- if any row matches, abort and throw `AppendConditionFailedError`

### Read/query behavior

`read(options)` should:

- return all sequenced events in append order for the configured stream
- support filtering by `position > from`

`query(query, options)` should:

- start from `read(options)`
- filter by existing query matching semantics

### Performance note

The first implementation may scan all stream rows in the transaction.

That is acceptable for this slice because:

- correctness is the priority
- the current store already scans all rows
- indexes can be added later once behavior is stable

Possible future indexes:

- `streamName`
- `streamName + type`
- tag-oriented indexes if needed

## Query matching semantics

Centralize query matching into a reusable helper if possible.

Current semantics to preserve:

- `none` matches nothing
- `all` matches everything
- item-list queries match if any item matches
- an item matches when:
  - type matches one of `types` if `types` is present
  - all tags in `tags` are present if `tags` is present

A shared helper would reduce drift between:

- sync memory store
- async memory spec store
- IndexedDB spec store

## Bootstrap/default initialization pattern

Once this store exists, default workspace initialization should stop relying on in-memory locks.

Instead, callers should use conditional append.

Example:

```ts
await store.append(
  [Events.projectAdded('default-project', 'Default Project')],
  {
    failIfEventsMatch: {
      kind: 'any',
      items: [{types: ['ProjectAdded'], tags: ['projectId:default-project']}],
    },
  },
);
```

If the append fails with `AppendConditionFailedError`, treat it as:

- another caller already initialized that logical record
- no additional recovery needed

The same pattern applies for the default chapter.

This is closer to the DCB spec than app-level locking.

## Recommended migration path in this repo

### Phase 1: introduce the new store API

Add:

- `specStore.ts`
- `memorySpecEventStore.ts`
- `indexedDBSpecEventStore.ts`
- tests for both implementations
- exports from package entrypoints

### Phase 2: prove correctness with tests

Add tests for:

- sequence positions assigned in append order
- `read({from})` returns only later events
- `query(query, {from})` respects both query and position filter
- append succeeds when no conflict exists
- append fails when a conflicting event exists
- append with `after` ignores older matching events
- append returns assigned positions
- IndexedDB implementation preserves append order
- overlapping append attempts against the same stream cannot both pass a conflicting condition

### Phase 3: adopt in one correctness-sensitive path

First target:

- default workspace bootstrap in `apps/slicr-dcb`

That migration should:

- use the spec-aligned IndexedDB store
- append default project with an append condition
- append default chapter with an append condition
- treat append-condition failure as a benign race loss

This gives immediate value without migrating the whole command stack.

### Phase 4: later migration opportunities

Future candidates:

- import/export replace semantics
- concurrency-sensitive command handlers
- async event-sourced command pipeline

## File-by-file implementation plan

### `packages/event-sourcing/src/specStore.ts`

Add:

- `SequencePosition`
- `SequencedEvent<E>`
- `ReadOptions`
- `AppendCondition`
- `AppendConditionFailedError`
- `SpecEventStore<E>`

### `packages/event-sourcing/src/queryMatch.ts` or similar

Extract shared matching logic from current stores into a helper usable by:

- existing memory store
- memory spec store
- IndexedDB spec store

### `packages/event-sourcing/src/memoryStore/memorySpecEventStore.ts`

Implement spec-aligned in-memory store.

### `packages/event-sourcing/src/indexedDBSpecEventStore.ts`

Implement IndexedDB-backed spec store with atomic conditional append.

### `packages/event-sourcing/src/index.ts`

Export the new API and implementations.

### `packages/event-sourcing/src/*.test.ts`

Add unit tests for:

- read/query semantics
- append-condition semantics
- `after` filtering semantics
- failure error details

### `packages/event-sourcing/src/*.browser.test.ts`

Add browser-mode tests for IndexedDB-specific behavior:

- assigned positions
- read/query order
- conditional append failure
- overlapping initialization-style append attempts

## Testing strategy

### Memory spec store tests

Run in normal Vitest/node.

Suggested cases:

1. appends assign positions `1, 2, 3...`
2. `read()` returns all sequenced events in order
3. `read({from: 2})` returns only positions greater than `2`
4. `query()` respects existing type/tag semantics
5. `query(..., {from})` applies both filters
6. append fails when an existing matching event conflicts
7. append succeeds when only older-than-`after` matches exist
8. append failure exposes conflicting sequenced events

### IndexedDB browser tests

Run in browser mode.

Suggested cases:

1. appending one event returns position `1`
2. appending additional events returns increasing positions
3. reads return sequenced events in order
4. `read({from})` filters correctly
5. `query(..., {from})` filters correctly
6. conditional append fails with `AppendConditionFailedError`
7. two overlapping append attempts with the same conflict condition cannot both append
8. separate streams remain isolated

## Design decisions

### Decision: add a parallel API instead of mutating `Store<E>`

Chosen because:

- optimistic locking is inherently async here
- sequence positions are a new concept not present in current call sites
- incremental adoption reduces risk

### Decision: use numeric sequence positions from IndexedDB auto-increment

Chosen because:

- simple
- browser-native
- satisfies the spec’s monotonic uniqueness needs

### Decision: prioritize correctness over indexing

Chosen because:

- the current problem is correctness under concurrency
- query/index optimization can follow once semantics are stable

## Risks and mitigations

### Risk: transaction implementation details in IndexedDB are subtle

Mitigation:

- keep conflict check and append inside one transaction
- add browser tests for overlapping writers
- avoid multi-transaction append flows

### Risk: existing app code still expects raw events

Mitigation:

- keep old store API intact
- adapt only the first migration target at first

### Risk: bootstrap requires two logical records

Mitigation:

- use one conditional append per logical invariant initially
- if needed later, add a higher-level command or invariant-specific condition set

## Acceptance criteria

This task is done when:

- a new spec-aligned async event store API exists in `packages/event-sourcing`
- the API supports sequence-positioned reads and append conditions
- a memory implementation passes semantic unit tests
- an IndexedDB implementation enforces append-condition checks atomically in a single transaction
- browser tests prove conflicting conditional appends cannot both succeed
- the plan for adopting the store in `apps/slicr-dcb` is documented

## Follow-up after this task

After this task lands, the next logical implementation slice is:

- migrate default workspace bootstrap in `apps/slicr-dcb` to use conditional append instead of in-memory initialization locking

That will directly address the duplicate-bootstrap issue at the persistence boundary in a spec-aligned way.
