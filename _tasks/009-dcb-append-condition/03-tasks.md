# DCB Append Condition Tasks

## Feature Description

Implement a spec-aligned async event store in `packages/event-sourcing` with sequence positions and DCB append conditions, including an IndexedDB-backed implementation that evaluates append conditions atomically.

See [plan.md](./plan.md).

## Workflow

Tasks should move through these status values in order:

* `[created]`: the task was described, but no work was done to implement it
* `[started]`: an agent sets this status before starting to work on a task
* `[done]`: an agent sets this status once a task is completed

**IMPORTANT**: Only **ONE** (1) task should be in the `[started]` status at a time.

## Learnings

Add feature learnings to `./05-learnings.md` if needed.

## Task 1: Add spec-store types and exports
### Status
[created]

### Description
Add a parallel async spec-aligned store API with sequence positions, sequenced reads, append conditions, and a dedicated append-condition failure error.

### Acceptance Criteria
* A new spec-store API exists in `packages/event-sourcing`.
* The API includes `SequencePosition`, `SequencedEvent`, `ReadOptions`, `AppendCondition`, `AppendConditionFailedError`, and `SpecEventStore`.
* The new API is exported from the package entrypoint.
* Type-level or small unit tests prove the public contract compiles and behaves as expected for the error type.

### Dependencies
* None

## Task 2: Extract shared query-matching logic
### Status
[created]

### Description
Extract reusable query-matching helpers so sync and async store implementations share the same `Query` semantics.

### Acceptance Criteria
* Query matching is implemented in one shared helper module.
* Existing `MemoryStore` behavior remains unchanged.
* Tests prove `all`, `none`, and filtered type/tag queries still behave the same.

### Dependencies
* Task 1

## Task 3: Implement in-memory spec event store
### Status
[created]

### Description
Implement a memory-backed `SpecEventStore` with sequence positions, `read({from})`, `query(..., {from})`, and conditional append.

### Acceptance Criteria
* Appended events receive increasing positions.
* `read({from})` returns only events after the given position.
* `query(..., {from})` applies both query and position filtering.
* Conditional append throws `AppendConditionFailedError` on conflict.
* Conditional append honors `after` by ignoring earlier matching events.

### Dependencies
* Task 1
* Task 2

## Task 4: Implement IndexedDB spec event store with atomic conditional append
### Status
[created]

### Description
Implement an IndexedDB-backed `SpecEventStore` whose append-condition check and append happen in one `readwrite` transaction.

### Acceptance Criteria
* Appended events receive IndexedDB-assigned increasing positions.
* Reads and queries return sequenced events in append order.
* `read({from})` and `query(..., {from})` work correctly.
* Conflicting conditional appends fail with `AppendConditionFailedError`.
* Browser tests prove overlapping conflicting appends cannot both succeed.
* The implementation is exported from `@slicr/event-sourcing`.

### Dependencies
* Task 1
* Task 2
* Task 3

## Task 5: Adopt conditional append for slicr-dcb default workspace bootstrap
### Status
[created]

### Description
Replace the current in-memory bootstrap locking in `apps/slicr-dcb` with spec-aligned conditional append using the new IndexedDB store.

### Acceptance Criteria
* Default project initialization uses conditional append.
* Default chapter initialization uses conditional append.
* Benign append-condition conflicts are handled as expected race losses.
* Reloading after clearing IndexedDB no longer duplicates bootstrap events under React Strict Mode.
* Regression tests cover the duplicate-bootstrap case.

### Dependencies
* Task 4
