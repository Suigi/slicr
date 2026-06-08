# Task 002: Extract shared query-matching logic

Use the **pi-ptdd** skill for this task. Assume task 001 is complete.

## Goal

Extract reusable query-matching helpers so all store implementations share the same `Query` semantics.

## Scope

Refactor matching logic into a shared helper used by the existing sync store first.

Do **not** yet:

- implement the memory-backed spec store
- implement the IndexedDB-backed spec store
- change query semantics

## Relevant files

- `packages/event-sourcing/src/query.ts`
- `packages/event-sourcing/src/memoryStore/memoryStore.ts`
- new helper file(s) under `packages/event-sourcing/src/`
- related tests under `packages/event-sourcing/src/`

## Required behavior

Preserve existing behavior for:

- `Query.none`
- `Query.all`
- item-list queries
- type filtering
- tag filtering

The extracted helper should be reusable by both sync and future async stores.

## Acceptance criteria

- Query matching exists in one shared helper module.
- `MemoryStore` delegates to the shared helper.
- Existing `MemoryStore` query behavior remains unchanged.
- Tests prove `all`, `none`, type filters, tag filters, and combined filters still behave the same.

## PTDD notes

- Work in `packages/event-sourcing`.
- Refresh `packages/event-sourcing/test-list.md` for this task before the first iteration.
- Favor focused unit tests over broad integration tests.
- Keep the helper generic over `Event`.

## Suggested validation commands

Use focused Vitest commands during PTDD, then finish with:

- `npm run test --workspace @slicr/event-sourcing`
- `npm run typecheck --workspace @slicr/event-sourcing`

## Done when

All store query semantics are centralized in one reusable helper without changing existing behavior.
