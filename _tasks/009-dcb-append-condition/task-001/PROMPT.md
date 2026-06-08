# Task 001: Add spec-store types and exports

Use the **pi-ptdd** skill for this task.

## Goal

Add a new parallel async store API in `packages/event-sourcing` that models the DCB concepts needed for append conditions and sequence positions.

## Scope

Implement only the public API/types and exports for the new spec-aligned store layer.

Do **not** yet:

- implement the memory-backed spec store
- implement the IndexedDB-backed spec store
- migrate existing callers

## Relevant files

- `packages/event-sourcing/src/types.ts`
- `packages/event-sourcing/src/index.ts`
- new file(s) under `packages/event-sourcing/src/` such as `specStore.ts`
- related tests under `packages/event-sourcing/src/`

## Required behavior

Add a public API that includes:

- `SequencePosition`
- `SequencedEvent<E>`
- `ReadOptions`
- `AppendCondition`
- `AppendConditionFailedError`
- `SpecEventStore<E>`

The new API must be exported from `@slicr/event-sourcing`.

## Acceptance criteria

- A new spec-store API file exists in `packages/event-sourcing/src/`.
- `SpecEventStore<E>` is async and supports `read`, `query`, and conditional `append`.
- `AppendConditionFailedError` carries the failed condition and conflicting sequenced events.
- The new API is exported from the package entrypoint.
- Tests prove the new public contract is importable and the failure error exposes the expected fields.

## PTDD notes

- Work in `packages/event-sourcing`.
- Refresh `packages/event-sourcing/test-list.md` before the first iteration.
- Prefer the smallest tests that lock down the public API shape and error behavior.
- Keep the old synchronous `Store<E>` API intact.

## Suggested validation commands

Use focused Vitest commands during PTDD, then finish with:

- `npm run test --workspace @slicr/event-sourcing`
- `npm run typecheck --workspace @slicr/event-sourcing`

## Done when

The package exposes a new spec-aligned async event store contract without breaking the existing synchronous store API.
