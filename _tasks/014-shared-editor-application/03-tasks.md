# Shared Editor Application Architecture Tasks

## Feature Description

Unify standalone and project-backed editor orchestration around separate projection and command ports, retaining each mode's storage and safety policies. See [./02-plan.md](./02-plan.md).

## Workflow

Tasks should move through these status values in order:

- `[created]`: the task was described, but no work was done to implement it
- `[started]`: an agent sets this status before starting work
- `[done]`: an agent sets this status once the task is complete

**IMPORTANT**: Only ONE task should be `[started]` at a time.

## Learnings

Add feature learnings to `./05-learnings.md` when implementation begins.

## Task 1: Define projection and command contracts

### Status

[created]

### Description

Split the combined editor port into application-facing projection and command contracts. Define a revision-consistent workspace/graph snapshot, update subscription shape, typed semantic command input, command receipt, and typed error/conflict outcomes.

### Acceptance Criteria

- Projection reads expose scope, workspace and graph data, and the revision that is the command basis.
- Subscriptions or refresh notifications identify the scope and revision of each delivered read model.
- Commands accept an expected revision and return committed revision/generated IDs or a typed failure.
- Contract tests cover stale bases, scope isolation, and command receipts without selecting a storage backend.

### Dependencies

- `_tasks/013-project-workspace-refresh` Task 1

### Notes

- Keep project and standalone histories independent.
- Do not weaken server-side atomic revision checks or silently rebase commands.

## Task 2: Adapt standalone reads and commands

### Status

[created]

### Description

Implement the new ports over the existing graph application, projection service, command router, and IndexedDB event store. Preserve local subscriptions, revision checks, command semantics, and standalone backup behavior.

### Acceptance Criteria

- The standalone composition obtains workspace/graph read models and submits all production editor actions through the new ports.
- Existing standalone persistence, scope changes, generated identities, and backup/restore behavior remain intact.
- Adapter contract and integration tests pass without exposing event-store primitives to shared UI code.

### Dependencies

- Task 1

### Notes

- Preserve the in-memory fallback outside browser environments.
- Keep admin/import-export operations separate from ordinary commands.

## Task 3: Adapt project API reads and commands

### Status

[created]

### Description

Implement the new ports over the project API and `slicr serve`. Preserve revision-paired reads, sequential polling, validated commands, atomic append, typed conflicts, and server-generated receipts.

### Acceptance Criteria

- Workspace and scoped graph reads are coherent at a known revision, including when fetched from separate API endpoints.
- Project mutations send the observed expected revision and return the committed revision and generated identities.
- Conflict and validation failures remain distinguishable to the application.
- API/adapter contract tests cover revision mismatch, stale writes, scope, receipts, and external updates.

### Dependencies

- Task 1

### Notes

- The project API and `.slicr/` store remain the authority; reads never initialize or rewrite the store.
- Preserve cross-process catch-up.

## Task 4: Compose both modes through the shared editor application

### Status

[created]

### Description

Extract the common editor-level orchestration from `App`/`useGraphModel` and `ReadOnlyProjectApp` into one shared production editor application. Make each entry point a composition root that supplies its adapters, mode-specific property/scope policy, and optional capabilities.

### Acceptance Criteria

- Both entry points use the same shared editor application, shell, graph view, and interaction controller.
- Shared UI/application code contains no direct IndexedDB writes or project API calls.
- Standalone property debounce and backup behavior remain intact; project queue, conflict guidance, and wait/discard/stay scope guard remain intact.
- Both modes pass integration coverage for navigation, graph/property reads, mutations, stale/conflicting writes, and their documented mode-specific behavior.

### Dependencies

- Task 2
- Task 3

### Notes

- Do not force equal persistence or conflict semantics.
- Keep standalone-only export/mockup tools and project-only identity/conflict controls as optional capabilities.
- Do not perform history migration or cutover.
