# Step 7 scope changes

Step 7 implements a bounded served-editing slice, not the planned IndexedDB migration/cutover.

- Added a loopback-only `POST /api/command` endpoint to `slicr serve`. It accepts allowlisted, project-scoped shared commands (`RenameNode`, `AddNode`, `ConnectNodes`, `AddChapter`, `RenameProject`) and routes them through the same `NdjsonSpecEventStore`, shared deciders and `handleCommand` used by CLI operations. Invalid command shapes/references are rejected; the store's conditional append guards remain authoritative. Append-condition conflicts are reported as HTTP 409.
- The dedicated project frontend can add a node and rename a node through this API. The normal editor entry and its IndexedDB default write path were not changed.
- Project projection/model reads are recomputed from disk. The served frontend polls these read APIs, so independent CLI/store writes become visible without relying on process-local subscriptions; subsequent CLI reads observe browser appends in the shared NDJSON history.
- Regression coverage exercises served command persistence, invalid reference rejection, and visibility of both served-editor and independently appended changes on the next API read. Existing independent-process conditional-append race coverage remains in the CLI suite.

## Explicitly deferred

The migration from existing IndexedDB histories, destination collision policy, backup/import verification, rollback path, migration smoke tests, and removal/replacement of the default IndexedDB write path are **not implemented**. This follows the user's explicit decision to defer migration/cutover. The regular editor remains IndexedDB-backed, separate from the `.slicr/` store; it is not synchronized with `slicr serve`, and no synchronization or completed cutover is claimed. Do not migrate users or remove the old write path based on this step.

The served editing surface is intentionally incomplete: current UI mutation controls expose node creation and node rename; the API additionally supports a small set of other scoped commands but does not yet expose full editing parity (for example property editing, node removal/type changes, and connection gestures). The browser E2E and API integration tests cover editing/catch-up and a server restart. A human visual smoke check, migration/recovery, and an HTTP-level forced race/conflict test remain outstanding.
