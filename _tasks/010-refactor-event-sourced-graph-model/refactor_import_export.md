# Refactor import/export into event backup/restore

## Current working-tree context

A first pass of backup/restore exists in the current uncommitted working tree, but it intentionally needs architectural cleanup.

Current temporary state:

- Backup parsing/serialization currently lives in `apps/slicr-dcb/src/graph/backupRestore.ts`.
- Backup tests currently live in `apps/slicr-dcb/src/graph/backupRestore.test.ts`.
- App-level backup/restore integration tests currently live in `apps/slicr-dcb/src/App.backupRestore.integration.test.tsx`.
- The old graph import/export module `apps/slicr-dcb/src/graph/importExport.ts` has been deleted.
- The old import/export tests have been deleted/renamed.
- `App.tsx` currently has inline topbar backup/restore buttons.
- `EventSourcedGraphModel` currently exposes temporary backup APIs:

  ```ts
  readBackupEvents(): Promise<DcbEvent[]>;
  restoreBackup(events: readonly DcbEvent[]): Promise<RendererGraph>;
  ```

- `useGraphModel()` currently exposes temporary backup APIs:

  ```ts
  readBackupEvents(): Promise<DcbEvent[]>;
  restoreBackup(events: readonly DcbEvent[]): Promise<void>;
  ```

- The current temporary backup format is a bare event array. The target format in this plan is a versioned wrapper:

  ```ts
  {version: 1, events: DcbEvent[]}
  ```

- Current restore behavior reloads through default scope resolution. The target behavior is to preserve the current project/chapter if they still exist in the restored backup.
- The current implementation passed:

  ```sh
  npm test --workspace=slicr-dcb
  npm run typecheck --workspace=slicr-dcb
  ```

Use the current uncommitted implementation as the starting point, but refactor it toward the target shape in this document. Do not reintroduce the old graph import/export feature. Keep the visual graph acceptance-test export.

## Decisions

1. Service/module name: `eventBackup`.
2. File location/name: `apps/slicr-dcb/src/application/eventBackup.ts`.
3. Service API level: event-level API.
4. Clipboard ownership: UI owns clipboard read/write.
5. Restore confirmation ownership: UI owns `window.confirm`.
6. Application ownership shape: hooks.
7. `createGraphApplication()` should return the event backup service.
8. Hook name: `useEventBackup`.
9. Graph hook name: keep `useGraphModel()` for graph-only behavior.
10. Reload after restore: parent component orchestrates restore, then graph reload.
11. Restore scope behavior: preserve current project/chapter if still present.
12. Admin store abstraction: keep the current admin-store abstraction shape for now.
13. Restore implementation: abstract behind the admin restore operation.
14. Validation location: `application/eventBackup.ts`.
15. Event validation reuse: first identify any other duplicate event-shape validation before extracting. Known nearby source is the old `graph/importExport.ts`; if that is deleted, keep validation local to `eventBackup.ts` unless another production duplicate remains.
16. Tests: add new focused backup/restore tests rather than mechanically preserving old import/export tests.
17. Visual graph acceptance-test export: keep it in graph code.
18. Topbar buttons: extract `BackupRestoreButtons` component.
19. Error reporting: use `window.alert`.
20. Backup format: add version 1 metadata.

## Target backup format

Backups are not graph exports. They are full event-log backups.

Use a versioned wrapper:

```ts
type EventBackupV1 = {
  version: 1;
  events: DcbEvent[];
};
```

Backup serialization should output this wrapper, not a bare event array.

Restore should accept only this wrapper format. It should not accept:

- legacy graph snapshots
- bare event arrays
- visual graph/layout exports

## Target responsibilities

### Application layer

Owns event backup/restore mechanics:

- reading all events from the canonical `SpecEventStore`
- restoring events through the admin store abstraction
- serializing/parsing/version-validating backups

Proposed files:

```txt
apps/slicr-dcb/src/application/eventBackup.ts
apps/slicr-dcb/src/application/eventBackup.test.ts
```

Proposed service shape:

```ts
export type EventBackupService = {
  readBackupEvents(): Promise<DcbEvent[]>;
  restoreBackup(events: readonly DcbEvent[]): Promise<void>;
};

export function createEventBackupService(args: {
  store: SpecEventStore<DcbEvent>;
  adminStore: AsyncGraphEventStore; // keep current abstraction for now
}): EventBackupService;
```

Serialization/parsing utilities live in the same module:

```ts
export function serializeEventBackup(events: readonly DcbEvent[]): string;

export type ParseEventBackupResult =
  | {ok: true; events: DcbEvent[]}
  | {ok: false; error: string};

export function parseEventBackup(input: string): ParseEventBackupResult;
```

### Graph model

`eventSourcedGraphModel.ts` should not expose backup/restore.

Remove from `EventSourcedGraphModel`:

```ts
readBackupEvents(): Promise<DcbEvent[]>;
restoreBackup(events: readonly DcbEvent[]): Promise<RendererGraph>;
```

The graph model remains responsible for graph projections and graph commands only.

### Hooks

Split app-level backup/restore out of `useGraphModel()`.

Keep `useGraphModel()` for graph-only behavior:

- workspace projection
- active project/chapter
- graph nodes/edges/lanes
- graph commands
- graph transient editing/focus state
- a reload function for parent orchestration

Add:

```ts
useEventBackup(...)
```

Responsibilities:

- expose event-level backup/restore functions to UI
- call application `eventBackup` service
- no clipboard access
- no confirmation dialog
- no graph projection ownership

The parent `App` owns orchestration:

- backup button: call `eventBackup.readBackupEvents()`, serialize, write clipboard
- restore button: read clipboard, parse, confirm, call `eventBackup.restoreBackup(events)`, then call `graph.reload()`
- on parse/restore errors, use `window.alert`

### React UI

Extract:

```txt
apps/slicr-dcb/src/components/BackupRestoreButtons.tsx
```

Responsibilities:

- render icon-only topbar buttons
- use text tooltips/titles
- no store knowledge
- invoke callbacks passed from `App`

Suggested props:

```ts
type BackupRestoreButtonsProps = {
  onBackup: () => void;
  onRestore: () => void;
};
```

Tooltips:

- Backup: `Copy full event backup to clipboard`
- Restore: `Restore full event backup from clipboard`

Font Awesome icons:

- Backup: `faDownload`
- Restore: `faUpload`

## Step-by-step plan

### 1. Add application event backup module

Create `apps/slicr-dcb/src/application/eventBackup.ts`.

Acceptance criteria:

- Exports `EventBackupService`.
- Exports `createEventBackupService`.
- Exports `serializeEventBackup` and `parseEventBackup`.
- Serialized backup shape is `{version: 1, events}`.
- Parser accepts only `{version: 1, events: DcbEvent[]}`.
- Parser rejects bare event arrays and legacy graph snapshots.
- Parser validates event shape.

### 2. Add focused event backup tests

Create `apps/slicr-dcb/src/application/eventBackup.test.ts`.

Acceptance criteria:

- Serializes events with `version: 1`.
- Parses valid version 1 backups.
- Rejects invalid JSON.
- Rejects bare event arrays.
- Rejects legacy graph snapshots.
- Rejects unknown/malformed event types.
- Service reads all events from `SpecEventStore`.
- Service restores via admin abstraction.

### 3. Return event backup service from application creation

Update `createGraphApplication()` to return:

```ts
{
  model,
  graphModel,
  eventBackup,
}
```

Acceptance criteria:

- `eventBackup` uses the same canonical command/spec store for reads.
- `eventBackup` uses the existing admin store abstraction for restore.
- Graph model construction remains unchanged except backup/restore removal in later steps.

### 4. Remove backup/restore from `EventSourcedGraphModel`

Delete backup/restore methods from `apps/slicr-dcb/src/graph/eventSourcedGraphModel.ts`.

Acceptance criteria:

- `EventSourcedGraphModel` has no backup/restore/read-all-events public API.
- `eventSourcedGraphModel.ts` no longer calls admin restore methods.
- Existing graph command/projection behavior remains green.

### 5. Split hooks

Update hook structure so `useGraphModel()` is graph-only and add `useEventBackup()`.

Proposed direction:

- application instance is owned by a hooks-level application loader
- `useGraphModel()` returns graph state/actions and a `reload()` function
- `useEventBackup()` returns event backup actions backed by application `eventBackup`

Acceptance criteria:

- `useGraphModel()` no longer returns backup/restore functions.
- `useEventBackup()` exposes event-level functions, e.g.

```ts
readBackupEvents(): Promise<DcbEvent[]>;
restoreBackup(events: readonly DcbEvent[]): Promise<void>;
```

- Clipboard and confirmation are not inside hooks.
- Parent can call `await restoreBackup(events); await graph.reload({preserveScope: true});` or equivalent.

### 6. Preserve scope on reload after restore

When parent reloads graph after restore, preserve current project/chapter if they still exist.

Acceptance criteria:

- If restored backup contains current project/chapter, they remain active.
- If current project/chapter are missing, normal scope resolution chooses a valid available scope.
- Tests cover both cases where practical.

### 7. Extract topbar backup/restore buttons

Create `apps/slicr-dcb/src/components/BackupRestoreButtons.tsx`.

Acceptance criteria:

- Renders two icon-only buttons.
- Buttons have `title` and `aria-label` text tooltips.
- Backup button calls `onBackup`.
- Restore button calls `onRestore`.
- Uses `faDownload` and `faUpload`.
- Buttons live on the far right of `app-topbar` via `AppShell` topbar actions.

### 8. Wire backup/restore in `App.tsx`

Update `App.tsx` orchestration.

Backup flow:

1. `const events = await eventBackup.readBackupEvents()`
2. `const serialized = serializeEventBackup(events)`
3. `await navigator.clipboard.writeText(serialized)`

Restore flow:

1. `const text = await navigator.clipboard.readText()`
2. `const parsed = parseEventBackup(text)`
3. if parse fails, `window.alert(parsed.error)`
4. `window.confirm('Restore backup? This will replace all local event data.')`
5. `await eventBackup.restoreBackup(parsed.events)`
6. `await graph.reload({preserveScope: true})` or equivalent
7. if restore/reload fails, `window.alert(...)`

Acceptance criteria:

- UI owns clipboard.
- UI owns confirmation.
- UI reports errors with `window.alert`.
- Restore reloads graph after replacing event log.

### 9. Remove old import/export code

Delete obsolete import/export modules and UI paths.

Acceptance criteria:

- No `graph/importExport.ts`.
- No `parseImportEvents` / `serializeDomainEvents` imports.
- No domain event import/export menu.
- No `replaceGraphEvents` / `readGraphEvents` graph-hook APIs.
- Visual graph acceptance-test export remains.

### 10. Add/update integration tests

Add new tests for app backup/restore behavior.

Acceptance criteria:

- Backup button writes version 1 event backup to clipboard.
- Restore button reads version 1 backup from clipboard, confirms, restores, and reloads graph.
- Restore cancellation does not mutate state.
- Invalid backup shows `window.alert` and does not restore.
- Existing visual graph acceptance-test export tests still pass.

## Validation commands

Run focused tests while iterating:

```sh
npm test --workspace=slicr-dcb -- src/application/eventBackup.test.ts src/App.backupRestore.integration.test.tsx src/graph/eventSourcedGraphModel.test.ts src/App.react.test.ts
npm run typecheck --workspace=slicr-dcb
```

Before considering the refactor complete:

```sh
npm test --workspace=slicr-dcb
npm run typecheck --workspace=slicr-dcb
```
