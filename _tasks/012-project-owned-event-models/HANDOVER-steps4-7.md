# Handover: Project-Owned Event Models, Steps 4–7

Updated: 2026-10-15

## Worktree and commits

- Worktree: `/Users/daniel/.herdr/worktrees/slicr/project-owned-steps4-7`
- Branch: `project-owned-steps4-7`
- Latest implementation commits: `4db6e5d feat(slicr-editor): serve project model read-only` (Step 6), `ab22372 feat(slicr-cli): accept guarded served model commands`, and `6e684c2 feat(slicr-editor): edit project-backed models in served view` (Step 7 slice).
- Base includes the two storage spikes:
  - `bc7950f feat(event-sourcing): add SQLite project store spike`
  - `7336aef feat(event-sourcing): add NDJSON outbox spike`
- Steps 4–6 are committed. Step 7 has a bounded served-editing implementation; migration/cutover remains deferred. The CLI workspace relocation is committed as `3a3562b`. Step 10 packaging work remains future work.

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

Step 5.1 was implemented in `60a7b1f`, simplified in `62bf5a1` to remove unsupported missing-tag repair, and extended in `e46f706` with default-workspace initialization and named project selection. The CLI adds explicit `init`, which refuses non-empty or incompatible stores but can seed a valid existing empty event log; successful initialization records `Default Project` and `Default Chapter` through the shared initial-workspace decider. Project-scoped commands accept a named `--project PROJECT_ID`; it may be omitted for a single-project model and is required for a multi-project model. No project ID is positional. The CLI reads through shared `slicr-core` projections and supports `add-project`, `add-chapter`, `add-node`, `rename-node`, and `connect-nodes` through shared deciders and `handleCommand` (alongside Step 5's `rename-project`). Mutations return generated IDs where applicable, append count, and exact-log-byte revision. The CLI uses Node 24's built-in TypeScript type stripping and a `register()`-registered resolver hook; `GraphProjector` uses an explicit field assignment so no non-erasable parameter-property transform is needed.

Event histories must contain valid query tags as emitted by the shared event constructors; the CLI does not infer or repair missing tags. CLI fixture events are created with those constructors. Tests cover default project/chapter initialization and refusal to overwrite, named project selection, single-project inference, multi-project ambiguity errors, invalid inputs/references, no-ops, generated IDs, exact revisions, reopening, and conditional conflicts from independent shared-handler workers.

Scope record: `11-step5.1-scope-changes.md`. Verification on Node 24.21.0: CLI tests 15/15; `npm run format` and `npm run validate:llm` passed (including lint, workspace tests, browser tests 3/3, and typecheck). Final independent `gpt-6-sol` review found no blockers. Residual limitations: concurrency test uses separate shared-handler workers rather than simultaneous CLI invocations; no-op decisions return before conditional append/CAS; and init close-failure cleanup lacks an injected-failure test. IndexedDB remains unchanged and unsynchronized. No manual editor smoke check was needed for this CLI-only step.

### Step 6 — read-only `slicr serve` (project-backed editor)

The initial inline projection preview was committed as `5a298cf`; the project-backed editor canvas, node cards, properties, edges, measurement, and layout were committed as `4db6e5d`. The isolated served entry fetches `/api/model` and `/api/projection` and does not import normal App/IndexedDB startup. Store/project path and revision are visible. The project frontend remains a read-only view for Step 6; served editing was added separately in the Step 7 slice below. See `12-step6-scope-changes.md`. Browser tests cover real assets and projected content, missing/corrupt storage, and absence of IndexedDB initialization. Historical focused CLI tests (22/22), project browser tests (2/2), editor build, formatting, and root `npm run validate:llm` passed. Step 6 review follow-up identified two concerns: valid `NodeExampleValuesChanged` entries with property-only values could be rejected, and missing frontend assets were not checked before startup. The current uncommitted hardening changes address both. Direct NDJSON reads during an in-flight write remain a concurrency risk. Automated browser interaction smoke passed; human visual smoke and subprocess signal-shutdown testing remain outstanding.

### Step 7 — served editing (migration/cutover deferred)

A bounded served-editing slice is committed as `ab22372` and `6e684c2`. Follow-up hardening changes are currently uncommitted after review findings: command type/domain validation; same-origin JSON write protections; base-revision checking at the NDJSON store's atomic cross-process append boundary; polling cancellation/error handling; and the Step 6 property-only event and asset-preflight fixes. The UI supports add/rename node and polls disk-backed projections for cross-process catch-up. See `13-step7-scope-changes.md`.

Migration from browser IndexedDB is explicitly deferred per user decision. Normal editor startup/default IndexedDB writes remain intact; they are not synchronized with the project store. No migration, backup/import/rollback, or cutover claim is made. Served-editor UI mutation parity remains incomplete (property editing, deletion/type changes, and connection gestures are not exposed).

Verification of current changes: `npm ci --no-audit --no-fund` installed from the existing lockfile (package manifests and lockfile unchanged). Root `npm run format` and `npm run validate:llm` passed, including lint, all workspace LLM suites, the 26-test CLI suite, nine Playwright browser tests, and typechecking. Tests cover deterministic HTTP revision races, stale-conflict guidance and retry, out-of-order polling, superseded poll failures, and separate post-write refresh errors. Human visual smoke remains outstanding.

## Validation and environment notes

- Node 24.21.0 is required by the storage spikes and current CLI runtime hook.
- Worktrees may not contain dependencies. A frozen `npm ci` from the committed lockfile is allowed only with user approval. Do not add or change dependencies, versions, manifests, or lockfiles without explicit user approval; see `AGENTS.md`.
- Step 5 is committed as `e398f6b`; the CLI workspace relocation is committed as `3a3562b`. Step 10 packaging remains unimplemented.
