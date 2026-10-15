# Step 5.1 scope changes

Step 5.1 adds explicit `slicr init`, refusing any pre-existing `.slicr/` directory so reads never initialize storage and initialization cannot overwrite an existing store. CLI inspection now uses the shared `slicr-core` workspace and graph projections. Mutations (`add-project`, `add-chapter`, `add-node`, `rename-node`, `connect-nodes`, and the prior `rename-project`) run through shared deciders and `handleCommand` with `NdjsonSpecEventStore`; output includes generated IDs where applicable and the revision hash of the exact resulting event-log bytes.

Node 24's transform-types runtime is used for the shared TypeScript module graph. A type-only import in the shared graph projector was made explicit to support this runtime. The NDJSON store projects missing query tags in memory from event-type-specific payload fields for compatible legacy histories, including project, chapter, node, and connection tags. These projected tags are never written back to existing batches.

Tests cover new and existing-store initialization, scoped mutations, invalid references and inputs, no-op decisions, generated IDs, exact revisions, reopening in another process, conditional conflicts across independent shared-handler workers, and fully tagless legacy history reads and edits (including project rename, chapter add, node mutation, duplicate-connection no-op, and preservation of original serialized batches).

Verification on Node 24.21.0: `node --test apps/slicr-cli/slicr.test.mjs` passed 16/16; `npm run format` passed; `npm run validate:llm` passed (lint, all workspace LLM tests including the browser tests, and typecheck). Existing React `act(...)` and Vite native-config warnings were non-fatal.

Review: final independent `gpt-6-sol` review found no blockers. Residual limitations: concurrency coverage races separate shared-handler workers, not full simultaneous CLI processes; no-op decisions return before conditional append/CAS; and the init close-failure cleanup path has no injected-failure test. Browser IndexedDB remains unchanged and separate from project `.slicr/`. No Step 6/7 behavior is included.
