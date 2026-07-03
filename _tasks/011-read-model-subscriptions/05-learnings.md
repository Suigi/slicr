# Learnings

- Keep graph projection as one pure `projectGraph(events, projectId, chapterId?)` entry point, and let store-backed compatibility wrappers delegate to it so projection behavior stays testable without temporary stores.
- Do not rely on scoped graph views synchronously recomputing from a projection-service event cache; the newer store-backed direction is for `setScope(...)` to catch up a scoped projector asynchronously and resolve with the ready `RendererGraph`.
- Store-backed projector subscriptions should use the projector-owned `Query` for both initial catch-up and live append matching, with `lastAppliedPosition()` kept internal to avoid double replay.
- For async `setScope(...)`, keep a per-view activation/version counter so stale projector catch-up results can be ignored until the newer scoped subscription becomes current.
- `emitCurrent` on read-model subscriptions should mean the first delivered value is the caught-up snapshot; buffer pre-ready subscribers until initial projector catch-up completes instead of emitting placeholder state first.
