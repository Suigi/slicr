# Task 004: Implement IndexedDB spec event store with atomic conditional append

Use the **pi-ptdd** skill for this task. Assume tasks 001 through 003 are complete.

## Goal

Implement an IndexedDB-backed `SpecEventStore` whose append-condition check and append happen atomically in a single `readwrite` transaction.

## Scope

Add the IndexedDB spec store and browser-focused tests.

Do **not** yet:

- migrate `apps/slicr-dcb` to use the new store
- optimize with advanced indexes beyond what correctness requires

## Relevant files

- new file(s) under `packages/event-sourcing/src/` such as `indexedDBSpecEventStore.ts`
- `packages/event-sourcing/src/index.ts`
- existing IndexedDB browser tests and new browser tests under `packages/event-sourcing/src/`
- any small shared IndexedDB helper files needed for transaction/read code

## Required behavior

The new IndexedDB store must:

- assign sequence positions using IndexedDB persistence order
- return `SequencedEvent<E>` values from `read()` and `query()`
- support `read({from})`
- support `query(query, {from})`
- support conditional `append(events, condition)`
- evaluate the condition and append inside one `readwrite` transaction
- throw `AppendConditionFailedError` on conflicts
- preserve stream isolation by `streamName`

## Acceptance criteria

- Appended events receive increasing persisted positions.
- Reads and queries return sequenced events in append order.
- `read({from})` and `query(..., {from})` filter correctly.
- Conditional append fails when a conflicting event exists after the relevant position.
- Browser tests prove overlapping conflicting appends cannot both succeed.
- Separate streams remain isolated.
- The implementation is exported from `@slicr/event-sourcing`.

## PTDD notes

- Work in `packages/event-sourcing`.
- Refresh `packages/event-sourcing/test-list.md` for this task before the first iteration.
- Use browser-mode tests for IndexedDB-specific behavior.
- Keep the first implementation correctness-first even if it scans all rows in a transaction.

## Suggested validation commands

Use focused Vitest commands during PTDD, then finish with:

- `npm run test --workspace @slicr/event-sourcing`
- `npm run typecheck --workspace @slicr/event-sourcing`

## Done when

The package contains a spec-aligned IndexedDB store whose optimistic-locking behavior is enforced at the persistence boundary rather than in app memory.
