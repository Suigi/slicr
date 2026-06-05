# DCB Node Size Measurement Learnings

- During planning, explicitly decide whether measurement should reflect stable content or the currently visible node UI. For this feature, measurement must follow the current visible `GraphNodeView` state while still running off-canvas and unzoomed.
- When measured dimensions feed layout and export, define a settled-state rule up front so export behavior is deterministic after graph changes.
- Keep the DCB measurement helper pure and app-specific: use a shared selector plus `data-node-id`, and filter invalid DOMRect values before they can influence layout state.
- When reusing `GraphNodeView` for off-canvas measurement, suppress focus-only classes, menus, add buttons, and edit handlers instead of forking the stable label/box markup.
- Keep the measurement layer mounted as a sibling outside `InfiniteCanvas`; if it lives inside the canvas subtree, DOM size reads can inherit zoom/pan behavior instead of true unzoomed node size.
- When measurement state is derived from just-rendered DOM, queue the React state update after the render commit instead of setting it synchronously inside the effect body; this keeps the measurement pass lint-clean and avoids cascading-render warnings.
- In App-level measurement regression tests, reuse the same `nodes`, `edges`, and `lanes` references across focus/menu-only rerenders. The real `useGraphModel` keeps graph collections stable for transient UI state changes, and recreating those arrays in tests can fake extra layout churn that is not a real remeasurement trigger.
