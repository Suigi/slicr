# Task 003: Implement in-memory spec event store

Use the **pi-ptdd** skill for this task. Assume tasks 001 and 002 are complete.

## Goal

Implement a memory-backed `SpecEventStore` that becomes the semantic reference for sequence positions and append-condition behavior.

## Scope

Add the in-memory spec store and its tests.

Do **not** yet:

- implement the IndexedDB-backed spec store
- migrate app code to the new store

## Relevant files

- `packages/event-sourcing/src/specStore.ts`
- new file(s) under `packages/event-sourcing/src/memoryStore/`
- `packages/event-sourcing/src/index.ts`
- related tests under `packages/event-sourcing/src/`

## Required behavior

The new in-memory store must:

- assign increasing sequence positions starting at `1`
- return sequenced events from `read()`
- support `read({from})`
- support `query(query, {from})`
- support conditional `append(events, condition)`
- throw `AppendConditionFailedError` when a conflict matches
- honor `condition.after` by ignoring earlier matching events

## Acceptance criteria

- Appended events receive deterministic increasing positions.
- `read()` returns all sequenced events in append order.
- `read({from})` returns only later events.
- `query(..., {from})` applies both query and position filtering.
- Conditional append fails on conflicts and exposes conflicting sequenced events.
- Conditional append succeeds when only pre-`after` matching events exist.
- The store is exported from `@slicr/event-sourcing`.

## PTDD notes

- Work in `packages/event-sourcing`.
- Refresh `packages/event-sourcing/test-list.md` for this task before the first iteration.
- Favor small semantic tests that document one rule at a time.
- Reuse the shared query-matching helper from task 002.

## Suggested validation commands

Use focused Vitest commands during PTDD, then finish with:

- `npm run test --workspace @slicr/event-sourcing`
- `npm run typecheck --workspace @slicr/event-sourcing`

## Done when

A memory-backed spec store exists and proves the intended DCB-style append-condition semantics in fast unit tests.
