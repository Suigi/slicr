# Task 005: Adopt conditional append for slicr-dcb default workspace bootstrap

Use the **pi-ptdd** skill for this task. Assume tasks 001 through 004 are complete.

## Goal

Replace the current in-memory bootstrap locking in `apps/slicr-dcb` with spec-aligned conditional append using the new IndexedDB-backed spec store.

## Scope

Update only the default workspace bootstrap path first.

Do **not** yet:

- migrate all graph command handling to the spec store
- redesign broader app persistence APIs unless needed for bootstrap correctness

## Relevant files

- `apps/slicr-dcb/src/graph/eventSourcedGraphModel.ts`
- `apps/slicr-dcb/src/graph/useGraphModel.ts`
- any adapter/helper files needed to bridge old and new store usage
- `apps/slicr-dcb/src/graph/eventSourcedGraphModel.test.ts`
- relevant app tests
- `packages/event-sourcing` exports used by slicr-dcb

## Required behavior

Default workspace bootstrap should:

- attempt to append the default `ProjectAdded` event with an append condition
- treat `AppendConditionFailedError` as a benign race loss
- attempt to append the default `ChapterAdded` event with an append condition
- treat `AppendConditionFailedError` as a benign race loss
- re-read final events after bootstrap

This should eliminate duplicate bootstrap events on reload after clearing IndexedDB, even under React Strict Mode.

## Acceptance criteria

- In-memory initialization locking for default workspace bootstrap is removed.
- Default project bootstrap uses conditional append.
- Default chapter bootstrap uses conditional append.
- Duplicate bootstrap events are no longer produced on reload after clearing IndexedDB.
- Regression tests cover the duplicate-bootstrap case.
- Existing graph loading behavior remains correct.

## PTDD notes

- Work in `apps/slicr-dcb`, using the new `packages/event-sourcing` API where needed.
- Refresh `apps/slicr-dcb/test-list.md` for this task before the first iteration.
- Start with the smallest failing regression test that reproduces duplicate bootstrap events through the app/model bootstrap path.
- Prefer adapting only the bootstrap path rather than forcing a full store migration in one slice.

## Suggested validation commands

Use focused Vitest commands during PTDD, then finish with:

- `npm run test --workspace slicr-dcb`
- `npm run typecheck --workspace slicr-dcb`

## Done when

Default workspace initialization is protected by store-level optimistic locking rather than app-level memory locking, and the duplicate-bootstrap reload bug is gone.
