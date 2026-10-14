# Learnings

- Keep graph projection as one pure `projectGraph(events, projectId, chapterId?)` entry point, and let store-backed compatibility wrappers delegate to it so projection behavior stays testable without temporary stores.
- Do not rely on scoped graph views synchronously recomputing from a projection-service event cache; the newer store-backed direction is for `setScope(...)` to catch up a scoped projector asynchronously and resolve with the ready `RendererGraph`.
- Store-backed projector subscriptions should use the projector-owned `Query` for both initial catch-up and live append matching, with `lastAppliedPosition()` kept internal to avoid double replay.
- For async `setScope(...)`, keep a per-view activation/version counter so stale projector catch-up results can be ignored until the newer scoped subscription becomes current.
- `emitCurrent` on read-model subscriptions should mean the first delivered value is the caught-up snapshot; buffer pre-ready subscribers until initial projector catch-up completes instead of emitting placeholder state first.
- Facade tests that rely on projection subscriptions need a SpecEventStore double whose `subscribe(...)` actually notifies matching appends; a no-op subscribe stub will make the service look stale even when the implementation is correct.
- Once the store append path awaits matching listeners, the facade can drop mutation-path `refresh()` calls and still expose fresh snapshots after command appends; direct append tests are a good proof of that boundary.
- `load()` can remain a bootstrap-only compatibility hook, but normal `setScope()` does not need to re-run projection refresh when the scoped view subscription already settles the new scope.
- The React hook should treat command return graphs as transient-only data; the rendered graph state should come from workspace/scoped projection subscriptions so updates stay aligned with the event-driven read model.
- Reload paths must tear down old workspace/scoped subscriptions before wiring the fresh application instance, otherwise stale listeners can keep driving hook state after a reset.
- `createGraphApplication` should be the graph application composition/bootstrap owner: create/open stores, ensure initial workspace, create command executor, create projection service, create the initial scoped graph view, and perform initial projection catch-up before returning the application.
- `eventSourcedGraphModel` is now compatibility/adaptation code; keep it receiving composed dependencies from the application boundary instead of letting it own command-router, projection-service, or bootstrap refresh creation.
- Share one scoped graph view between explicit graph commands and the React bridge so commands always target the scope the UI observes; additional scoped views remain read-only observers.
- When a cached application is loaded for a changed React scope, await the explicit graph view's `setScope` before attaching listeners and applying its snapshot; otherwise an earlier scope's graph may overwrite the newly selected project during async load.
