# Overview Node Data Toggle Learnings

- Record only durable implementation guidance discovered during execution.
- Prefer learnings about shared node-card rendering and overview measurement behavior over narrative recap.
- Clarify whether a shared rendering seam should stay generic and what its default behavior is before task execution; that prevents later ambiguity about whether a feature belongs in the shared component or only in overview callers.
- Keep overview-only UI preferences in `useAppLocalState` and thread them through `DiagramSection` plus renderer adapter props before renderer-specific work; that preserves same-session behavior across mode switches without coupling renderers to app globals.
- When overview layout depends on a measurement toggle, include that toggle in the diagram-view cache key and measurement-effect dependencies; otherwise the DOM can update while the computed overview geometry stays stale.
- Shared dialog inputs that defer focus, blur, or scrolling work should track and clear their timer handles on unmount; otherwise unrelated jsdom teardown can turn leftover callbacks into repo-wide unhandled test failures.
