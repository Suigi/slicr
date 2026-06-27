# Learnings

- Projection refresh tests can distinguish canonical command-store reads from legacy graph-store reads by allowing the bootstrap read and making later `graphStore.readAll()` calls fail.
- When asserting refresh after a mutation, wrap the real `commandStore.read` implementation so appended events are visible to the refreshed projection.
- To prove a refresh really rereads the store, let the command-store append inject a concurrent event and assert the refreshed projection sees it.
- The migration went farther than the original task status suggested: graph commands, project commands, and initial-workspace bootstrap now all route through `commandRouter` and `handleCommand`.
- Making `setScope(scope)` async allowed it to refresh from the canonical command store and remove the local `DcbEvent[]` cache from `eventSourcedGraphModel.ts`.
- Moving backup/restore into `application/eventBackup.ts` keeps React responsible for clipboard/confirmation orchestration and keeps graph-model APIs focused on graph projections and graph commands.
- Production React code currently avoids direct event-sourcing primitives; event fixtures remain in tests and are acceptable unless a test becomes over-coupled to implementation details.
- The remaining separation risks are mostly second-order: projection/read-model ownership around the temporary projection `MemoryStore`, narrowing the admin backup store abstraction, and auditing DCB query scopes for each decider.
