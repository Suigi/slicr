# Handover: Project-Owned Event Models, Steps 4–7

Updated: 2026-10-15

## Worktree and commits

- Worktree: `/Users/daniel/.herdr/worktrees/slicr/project-owned-steps4-7`
- Branch: `project-owned-steps4-7`
- Latest implementation commit: `cd739e4 refactor(slicr-core): use erasable TypeScript constructor`
- Base includes the two storage spikes:
  - `bc7950f feat(event-sourcing): add SQLite project store spike`
  - `7336aef feat(event-sourcing): add NDJSON outbox spike`
- Steps 4 and 5 are committed. The CLI workspace relocation is committed as `3a3562b`. Step 10 packaging work remains future work; Steps 6 and 7 have not started.

## Completed

### Storage spikes (Steps 3 investigation)

- SQLite and NDJSON/outbox experiments and reports are committed in the base history.
- NDJSON was selected provisionally for Steps 4–7; this is not a final format decision. The NDJSON report documents that the outbox cannot be deleted while a batch is pending.

### Step 4 — read-only CLI

- This historical Step 4 implementation exposed `slicr` through the repository package `bin`; it has since moved to the dedicated `apps/slicr-cli/` workspace package.
- Read commands list projects/chapters and show a scoped slice as JSON or Markdown with revision and stable IDs.
- Reads do not initialize or rewrite model history; incompatible event types fail.
- Graph projection handles schemas/examples, disconnections, chapter slicing, project-scoped IDs, and delimiter-containing IDs.
- Scope record: `09-step4-scope-changes.md`.
- Commit: `c234816`.
- Verification: `node --test scripts/slicr.test.mjs` passed 7/7; root `npm run validate:llm` passed after the final Step 4 changes.
- Review: final `gpt-6-sol` review found no blockers. Residual: CLI reads the NDJSON file directly and does not coordinate with adapter recovery/locking during an in-flight write.

## Step 5 — CLI edits (implemented and reviewed)

The committed Step 5 implementation adds `rename-project PROJECT_ID NEW_NAME` using the shared `deciders().renameProject`, shared `handleCommand`, and `NdjsonSpecEventStore`. A Node 24 type-stripping loader resolves extensionless TypeScript imports; some shared imports were changed to explicit type-only imports so Node can strip them. The CLI reports append count and hashes the exact NDJSON bytes for its returned revision.

**Step 5 implementation is complete in this worktree, reviewed with no blockers, and committed as `e398f6b`.** Fixture tags now match the shared event constructors. Regression tests verify missing-project rejection leaves the log byte-for-byte unchanged, successful rename is visible to a new CLI process, and output revision is SHA-256 of exact log bytes. Two independent Node worker processes invoke the shared handler; a read barrier ensures both query the initial state before conditional append, yielding one success and one `AppendConditionFailedError` with actionable re-read/retry guidance.

Historical focused CLI verification: `node --test scripts/slicr.test.mjs` passed 9/9. Root `npm run format` and `npm run validate:llm` passed on Node 24.21.0 (lint, all workspace LLM tests, editor browser tests 3/3, and typecheck). A first validation run exposed an existing exact-message assertion after improving the conflict message; the assertion was updated, then the full validation passed. Temporary `node_modules` symlink to `/Users/daniel/src/slicr/node_modules` was removed.

Scope record: `10-step5-scope-changes.md`. No Step 6/7 work started. The workspace relocation is recorded below. No manual editor smoke check was needed for this CLI-only change. IndexedDB remains unchanged and unsynchronized with project `.slicr/`.

## Step 5 review blockers and fixes

The second Step 5 review identified three blockers; fixes are applied and verified. Workspace dependencies were temporarily symlinked from `/Users/daniel/src/slicr/node_modules` and the symlink was removed after validation.

1. **Installed bin dispatch:** Internal Node runtime detection now finds `rename-project` after optional `--path DIR`; package-bin integration covers both explicit path and cwd invocation.
2. **History validation:** Rename loads/projects the existing history before appending, rejecting unknown event types. Regression verifies unknown history does not change log bytes.
3. **Race harness:** Preserved the deterministic read/release barrier; worker completion is bounded, statuses are checked so unexpected child failures fail the test, and cleanup kills then awaits child closure before removing fixtures.

Historical validation: `node --test scripts/slicr.test.mjs` passed 10/10. `npm run format` passed. `npm run validate:llm` passed (lint, all workspace LLM tests including 3 browser tests, typecheck); existing React `act(...)` console warnings appeared, but tests passed. Keep browser IndexedDB separate/unsynchronized.

A subsequent review found cleanup inferred closure from `exitCode`, which can remain `null` after signal termination and lead to attaching a `close` listener too late. The race harness now tracks the `close` event explicitly, bounds shutdown awaiting, kills open children, and awaits child completions before fixture removal. Final independent `gpt-6-sol` review found no Step 5 blockers; remaining risk is the uncoordinated direct NDJSON read path from Step 4 during in-flight recovery/writes.

### CLI workspace relocation (committed)

The CLI files now live in `apps/slicr-cli/` as `@slicr/slicr-cli`, which owns the `slicr` bin. `package-lock.json` links the workspace bin under `node_modules/.bin`, and the root `slicr` script invokes it with npm argument forwarding (`npm run slicr -- projects`). The runtime loader and dynamic workspace imports are resolved relative to the application module rather than the caller's cwd. The focused test suite includes root-script forwarding and installed-bin use from an unrelated cwd. After relocation, `npm run format` and `npm run validate:llm` passed on Node 24.21.0 (402 Vitest tests, 11 CLI tests, and 3 browser tests); existing React `act(...)` warnings remained non-fatal. Commit: `3a3562b feat(slicr-cli): move CLI into workspace package`. Review confirmed the workspace integration but noted it is not yet independently installable outside this monorepo because the CLI/runtime workspace packages are private and source-relative. Step 10 now plans a Git-hosted package artifact. No Step 6/7 work is included.

### Step 5.1 — initialize models, share projections, expand CLI edits (implemented and reviewed)

Step 5.1 was implemented in `60a7b1f` and simplified in `62bf5a1` to remove unsupported missing-tag repair. The CLI adds explicit `init` with refusal of any existing `.slicr/` directory, reads through the shared `slicr-core` workspace and graph projections, and supports `add-project`, `add-chapter`, `add-node`, `rename-node`, and `connect-nodes` through shared deciders and `handleCommand` (alongside Step 5's `rename-project`). Mutations return generated IDs where applicable, append count, and exact-log-byte revision. The CLI uses Node 24's built-in TypeScript type stripping and a `register()`-registered resolver hook; `GraphProjector` uses an explicit field assignment so no non-erasable parameter-property transform is needed.

Event histories must contain valid query tags as emitted by the shared event constructors; the CLI does not infer or repair missing tags. CLI fixture events are created with those constructors. Tests cover initialization refusal, invalid inputs/references, no-ops, generated IDs, exact revisions, reopening, and conditional conflicts from independent shared-handler workers.

Scope record: `11-step5.1-scope-changes.md`. Verification on Node 24.21.0: CLI tests 14/14; `npm run format` and `npm run validate:llm` passed (including lint, workspace tests, browser tests 3/3, and typecheck). Final independent `gpt-6-sol` review found no blockers. Residual limitations: concurrency test uses separate shared-handler workers rather than simultaneous CLI invocations; no-op decisions return before conditional append/CAS; and init close-failure cleanup lacks an injected-failure test. IndexedDB remains unchanged and unsynchronized. No manual editor smoke check was needed for this CLI-only step.

### Step 6 — read-only `slicr serve`

Not started. Host the existing frontend and local read-only projection API against the selected project's `.slicr/`; show project/store identity; preserve existing frontend startup. Test start, projections, missing/corrupt store, and shutdown. Create/update a Step 6 scope-change document.

### Step 7 — served editing and explicit cutover

Not started. Route served edits through the local API and same project store as CLI; test cross-process catch-up in both directions and conflicts. Design and test an explicit backed-up, verified browser IndexedDB migration, including nonempty destination behavior and recovery. Do not remove the old frontend write path until migration/regression evidence justifies the cutover. Create/update a Step 7 scope-change document.

## Validation and environment notes

- Node 24.21.0 is required by the storage spikes and current CLI runtime hook.
- Worktrees do not contain their own dependencies. For validation, a temporary symlink to `/Users/daniel/src/slicr/node_modules` worked; remove it afterward. Do not install dependencies unless separately approved.
- Step 5 is committed as `e398f6b`; the CLI workspace relocation is committed as `3a3562b`. Step 10 packaging remains unimplemented.
