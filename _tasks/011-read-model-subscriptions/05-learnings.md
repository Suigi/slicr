# Learnings

- Keep graph projection as one pure `projectGraph(events, projectId, chapterId?)` entry point, and let store-backed compatibility wrappers delegate to it so projection behavior stays testable without temporary stores.
- Do not rely on scoped graph views synchronously recomputing from a projection-service event cache; the newer store-backed direction is for `setScope(...)` to catch up a scoped projector asynchronously and resolve with the ready `RendererGraph`.
