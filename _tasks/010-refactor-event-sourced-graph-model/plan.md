# Refactor event sourced graph model migration plan

## Target state

`apps/slicr-dcb/src/graph/eventSourcedGraphModel.ts` should become an application-facing projection/model adapter, not an event construction or event mirroring layer.

Target invariants:

- Normal user mutations go through the application `commandRouter`.
- `eventSourcedGraphModel.ts` does not construct domain events for normal commands.
- `eventSourcedGraphModel.ts` does not manually append emitted events to a local `events` array.
- Projection refreshes read from the canonical `config.commandStore` / `SpecEventStore<DomainEvent>`.
- `config.store` is not used for non-admin tasks.
- `config.store` remains only for admin/import-export style operations that require capabilities not exposed by `SpecEventStore`, such as `replace` / `clear`.

## Current state

Implemented since this plan was first written:

- `addProject` and `renameProject` route through `commandRouter`.
- Bootstrap is owned by `apps/slicr-dcb/src/application/initialWorkspace.ts` and routes `EnsureInitialWorkspace` through `commandRouter`.
- Graph mutations route through `commandRouter` from `eventSourcedGraphModel.ts`:
  - `addNewSlice` -> `AddNode`
  - `addChapter` -> `AddChapter`
  - `addConnection` -> `ConnectNodes`
  - `deleteConnection` -> `DisconnectNodes`
  - `addConnectedNode` -> `AddConnectedNode`
  - `renameNode` -> `RenameNode`
  - `setNodeType` -> `ChangeNodeType`
  - `deleteNode` -> `DeleteNode`
  - `changeNodeSchema` -> `ChangeNodeSchema`
  - `changeNodeExampleValues` -> `ChangeNodeExampleValues`
- `eventSourcedGraphModel.ts` no longer imports or constructs `Events.*` for normal user mutations.
- Projection refreshes read from `config.commandStore.read()` after command execution.
- Backup/restore is split into `apps/slicr-dcb/src/application/eventBackup.ts`; graph model backup APIs were removed.

Remaining concerns:

- `eventSourcedGraphModel.ts` still builds graph projections by loading freshly read events into a `MemoryStore` for `GraphProjector`; this is projection-only, not command decision-making.
- The backup/admin abstraction still exposes more capabilities than `eventBackup` needs; it can be narrowed/renamed in a follow-up.
- DCB query scope and append-condition coverage should still get a final audit.

## Process

- always start the first task marked as `[WIP]` or `[OPEN]` in its header, unless requested otherwise by the user
- when starting a task, mark it as `[WIP]` in its header
- after finishing a task, mark it as `[DONE]` in its header

## Step-by-step migration

### 1. [DONE] Centralize command-store reads

Add a local helper in `createEventSourcedGraphModel`:

```ts
const readAllEvents = async () => (await config.commandStore.read()).map(({event}) => event);
```

Use this helper anywhere projection refresh needs all events.

Acceptance criteria:

- `load` projects from `readAllEvents()`.
- `addProject` refreshes from `readAllEvents()` after routing the command.
- `renameProject` refreshes from `readAllEvents()` after routing the command.
- `readEvents()` returns `readAllEvents()`.
- No behavior changes.

### 2. [DONE] Make append-and-refresh use `config.commandStore`

Update the newly introduced `appendAndRefreshProjection` helper so it appends via `config.commandStore.append(...)` and refreshes via `readAllEvents()`.

Do not switch call sites yet unless covered by the next steps.

Acceptance criteria:

- The helper uses only `config.commandStore` for append/read.
- Existing behavior remains unchanged because call sites are not yet migrated.

### 3. [DONE] Replace direct append call sites with `appendAndRefreshProjection`

Replace `appendAndProject(...)` usage with `appendAndRefreshProjection(...)`.

Suggested order:

1. `addConnection` (done)
2. `deleteConnection`
3. `renameNode`
4. `setNodeType`
5. `deleteNode`
6. `addChapter`
7. `addConnectedNode`
8. `addNewSlice`
9. `changeNodeSchema`
10. `changeNodeExampleValues`

This step still permits direct event construction temporarily, but removes manual local event-list extension.

Acceptance criteria:

- No normal mutation projects from `[...events, ...appendedEvents]`.
- After append, projections are refreshed from `config.commandStore`.
- `appendAndProject` is deleted once unused.

### 4. [DONE] Split bootstrap away from `config.store`

Change `ensureDefaultWorkspace` to operate on `SpecEventStore<DomainEvent>` instead of `AsyncGraphEventStore`.

Implementation direction:

- Read existing events via `commandStore.read()`.
- Append bootstrap events via `commandStore.append(events, condition)`.
- Keep idempotent append-condition behavior.

Acceptance criteria:

- `ensureInitialWorkspace({store: stores.commandStore})` is called during application startup before graph model load.
- Bootstrap no longer uses `eventSourcedGraphModel.ts` or an admin graph store.

### 5. [DONE] Keep admin-store capabilities out of the graph model

Restrict mutable/admin store usage to operations requiring capabilities outside `SpecEventStore`.

Current shape:

- `createEventSourcedGraphModel` only receives `commandStore`.
- Normal load/read/command refresh paths use `commandStore`.
- Backup restore uses `application/eventBackup.ts` and its `adminStore.restoreBackup(...)` dependency.

Follow-up:

- Narrow/rename the backup admin abstraction so it exposes only the methods the backup service needs.

### 6. [DONE] Add missing commands and store-free deciders

Add command types, deciders, and decider tests for all graph/workspace mutations that currently construct events in `eventSourcedGraphModel.ts`.

Missing command/decider list:

- `AddChapter`
  - emits `ChapterAdded`
- `AddNode` / `AddNewSlice`
  - emits `NodeAdded`
- `ConnectNodes`
  - emits `NodesConnected`
- `DisconnectNodes`
  - emits `NodesDisconnected`
- `AddConnectedNode`
  - emits `NodeAdded` + `NodesConnected`
- `RenameNode`
  - emits `NodeRenamed`
- `ChangeNodeType`
  - emits `NodeTypeChanged`
- `DeleteNode`
  - emits `NodeRemoved`
- `ChangeNodeSchema`
  - replaces legacy `changeNodeSchemaHandler`
  - emits `NodeSchemaChanged` only when valid and changed
- `ChangeNodeExampleValues`
  - replaces legacy `changeNodeExampleValuesHandler`
  - emits `NodeExampleValuesChanged` only when valid and changed

Acceptance criteria:

- Each new decider is store-free.
- Each decider has `expectDecider` tests.
- Legacy synchronous handlers are kept only until their call sites are migrated.

### 7. [DONE] Register new commands in `commandRouter`

Extend `SlicrCommand` and the router registry to include the new command types.

Acceptance criteria:

- Router can execute every command needed by `EventSourcedGraphModel`.
- Router tests cover at least representative graph commands with DCB append behavior.

### 8. [DONE] Route graph model methods through the command router

One method at a time, replace direct event construction in `eventSourcedGraphModel.ts` with calls to `routeCommand(...)` followed by projection refresh from `readAllEvents()`.

Suggested order:

1. `addChapter`
2. `addNewSlice`
3. `renameNode`
4. `setNodeType`
5. `deleteNode`
6. `addConnection`
7. `deleteConnection`
8. `addConnectedNode`
9. `changeNodeSchema`
10. `changeNodeExampleValues`

Acceptance criteria:

- No normal graph method imports/uses `Events.*` to construct mutation events.
- All normal graph mutations go through `commandRouter`.
- Projection refresh happens after command execution via `readAllEvents()`.

### 9. [DONE] Remove legacy synchronous decision path

Once `changeNodeSchema` and `changeNodeExampleValues` are routed through deciders, delete:

- `decideWithCurrentEvents`
- legacy handler imports from `eventSourcedGraphModel.ts`
- obsolete handler code/tests if no longer used elsewhere, or leave temporarily if still needed for compatibility

Acceptance criteria:

- `eventSourcedGraphModel.ts` no longer creates a `MemoryStore` for command decisions.
- Command decisions happen only in store-free deciders executed by `handleCommand`.

### 10. [DONE] Revisit the local `events` cache

After all commands use the router and all refreshes read from `config.commandStore`, reassess the remaining local `events` variable.

Implemented outcome:

- `setScope(scope)` is now async and refreshes from `commandStore.read()` before projecting.
- The local `events: DcbEvent[]` cache was removed.
- A focused regression test proves scope switching sees events appended to the command store after initial load.

Acceptance criteria:

- `eventSourcedGraphModel.ts` does not store `DomainEvent[]` locally.
- Scope changes refresh from the canonical event store rather than an event mirror.

## Guideline conformance audit

After the main graph-model migration, audit the codebase against `_knowledge/event-sourcing-separation.md` for concerns outside the immediate `eventSourcedGraphModel.ts` refactor.

### UI / React imports [DONE]

React-facing code should render projections and issue commands only.

Audit for imports of:

- `DomainEvent`
- `Events`
- `@slicr/event-sourcing` primitives

Likely areas to check:

- `apps/slicr-dcb/src/App.tsx`
- `apps/slicr-dcb/src/graph/useGraphModel.ts`
- import/export UI integration paths
- component tests that may be over-coupled to domain events

Current status:

- Production React/UI code does not construct domain events or import event-sourcing primitives directly.
- React component tests do not use domain events or event-store primitives.
- `App.backupRestore.integration.test.tsx` uses `Events.*` fixtures intentionally because full event-log backup/restore is the behavior under test; this is acceptable and not ordinary UI setup coupling.

Acceptance criteria:

- React components do not construct domain events.
- React components do not read from or append to event stores.
- React components invoke application/model command functions and render projections/read models.
- React-facing tests only use domain event fixtures where event-log behavior is the subject of the test; otherwise prefer UI/application APIs or read-model fixtures.

### Projection/read-model ownership [OPEN]

Clarify where projections live after the local `events` cache is removed or constrained.

Possible follow-up design:

- A projection service that reads from `SpecEventStore` and returns workspace/graph read models.
- A read-model cache with explicit sequence-position tracking.
- Store-backed subscriptions/change feeds if performance requires incremental projection.

Acceptance criteria:

- Projection state is owned by application services/read-model services, not React components.
- Any cached projection has an explicit refresh path from the event store.
- No ad-hoc event mirrors are introduced in hooks or components.

### DCB query and append-condition review [OPEN]

For every new decider, verify that its `query(command)` covers the event slice required for the decision invariant.

Review especially:

- node existence checks
- removed-node checks
- duplicate connection checks
- schema/example-values no-op checks
- project/chapter existence checks

Acceptance criteria:

- Each decider has tests for the events it queries and projects.
- Router/handler tests prove appends use DCB append conditions through `handleCommand`.
- Queries are narrow enough to avoid unnecessary conflicts, but broad enough to protect invariants.

### Import/export and admin separation [DONE]

`replace` / `clear` style operations should be treated as admin/import-export orchestration, not normal application command handling.

Current status:

- Backup/restore orchestration lives in `application/eventBackup.ts`.
- `eventSourcedGraphModel.ts` no longer exposes backup/restore APIs.
- Normal command paths do not depend on admin-store capabilities.
- The backup service depends on a narrowed `EventBackupAdminStore` abstraction that exposes only `restoreBackup(...)`.

### Bootstrap ownership [DONE]

Default workspace bootstrap is now an application command/decider concern.

Current status:

- `createGraphApplication()` calls `ensureInitialWorkspace({store: stores.commandStore})` before loading the graph model.
- `ensureInitialWorkspace()` routes `EnsureInitialWorkspace` through `commandRouter`.
- The initial-workspace decider owns default `ProjectAdded` / `ChapterAdded` emission and remains tested with `expectDecider`.
- Bootstrap event construction is not hidden inside UI/React or graph model code.

## Testing strategy

For each step:

- Add or update focused tests first.
- Prefer `expectDecider` for new decider behavior.
- Keep existing `eventSourcedGraphModel.test.ts` coverage green to prove behavior-preserving migration.
- Run:

```sh
npm test --workspace=slicr-dcb -- <focused test files>
npm run typecheck --workspace=slicr-dcb
```

Before completing the migration, also run the full app test suite:

```sh
npm test --workspace=slicr-dcb
```
