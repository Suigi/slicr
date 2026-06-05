# DCB Node Size Measurement Plan

## Summary

`apps/slicr-dcb` should measure the actual rendered size of graph node DOM elements and pass those dimensions into `layout-lib` before computing graph layout. The current DCB graph uses fixed `NODE_WIDTH` and `NODE_HEIGHT` values for every node, which will become inaccurate as graph nodes gain dynamic content such as a property grid.

This feature mirrors the proven pattern in `apps/slicr-frontend`: render representative node DOM, measure it with `getBoundingClientRect()`, keep validated rounded dimensions in React state, and overlay those dimensions onto layout input nodes.


## Goals

- Measure actual graph node `<div>` dimensions in `apps/slicr-dcb`.
- Pass measured `{ width, height }` values into `layout-lib` node inputs before calling `compactLayout`.
- Use default node dimensions until a valid measurement is available.
- Re-measure when committed graph/store changes mean node content may have changed.
- Keep measurement transient; measured dimensions are layout/rendering state, not domain events or persisted model data.
- Preserve current graph interactions: focus, editing, node menus, connection mode, add buttons, visual graph export, and last-known-good layout storage.
- Export visual graphs only after measurement/layout has settled so the exported request matches the active measured layout.

## Non-goals

- Do not persist measured dimensions in the event store, local storage model, import/export events, or domain graph.
- Do not redesign `layout-lib` or change its API.
- Do not implement the upcoming property grid itself.
- Do not measure temporary interactive overlays such as node menus or add buttons as part of stable layout size.
- Do not update `_tasks/_process/current-feature.toml` for this feature unless the user later changes that instruction.

## Core Rules

1. **Measured size wins for layout.** If a node has a valid measured width and height, those values are used in the `compactLayout` request for that node.
2. **Defaults remain the fallback.** If a node has not yet been measured or measurement returns invalid dimensions, DCB continues to use `NODE_WIDTH` and `NODE_HEIGHT`.
3. **Measurements are rounded and positive.** Width and height are rounded up or otherwise normalized to integer positive finite numbers before they influence layout.
4. **Measurement is transient UI state.** Node size measurements are derived from rendered DOM and are not domain facts.
5. **Measure the actual node box shape.** The measurement target should represent the full stable graph node DOM box that affects spacing, including dynamic node content such as a future property grid.
6. **Measure current visible node UI.** The measurement render path should use real `GraphNodeView` components with the same node props as the visible graph, while still rendering measurement DOM off-canvas and hidden from users.
7. **Exclude transient canvas state and transforms.** Measurement must happen outside the zoomed/panned canvas so `getBoundingClientRect()` reflects unzoomed node size, and focus/menu/connection-only UI state must not trigger remeasurement.
8. **Committed graph changes trigger remeasurement.** The UI should run another measurement pass after committed graph/store changes render updated node DOM.
9. **Export waits for settled layout.** Visual graph export should use a settled measured layout, not an in-between default-size layout immediately after a graph change.

## Data Model

Add a transient measurement map in the DCB UI layer:

```ts
type NodeDimensions = {
  width: number;
  height: number;
};

type NodeMeasurementMap = Record<string, NodeDimensions>;
```

The source graph node type may continue to carry default dimensions because existing code and exports expect `GraphNode` to include `width` and `height`. The layout input should be derived from graph nodes plus measurement overrides instead of mutating persisted graph state.

## Algorithm Or Derivation Steps

1. Render graph nodes normally from the current graph model.
2. Render a measurement representation for graph nodes using the same stable node box/content markup as the visible graph node.
3. Select measurement elements by a shared class/data attribute, for example `[data-node-id]` on a measurement node box.
4. For each measurement element:
   - read `getBoundingClientRect()`;
   - normalize width and height to positive finite integers;
   - ignore missing, zero, negative, `NaN`, or infinite dimensions.
5. Store the resulting measurement map in React state only when it differs from the previous map.
6. Derive layout nodes before `compactLayout`:
   - start from the graph model nodes;
   - for each node, overlay measured width/height when available;
   - otherwise leave existing default width/height intact.
7. Call `compactLayout` with the derived layout nodes.
8. Render visible nodes from layout-lib result, so their positioned width/height match the dimensions layout-lib used.

## Renderer Or Interaction Behavior

- Initial render may use default node dimensions; after measurement settles, graph layout updates to reflect actual node sizes.
- The user should not see a separate measurement layer.
- The measurement layer should render off-screen outside the canvas transform so measured DOM stays unzoomed.
- Measurement should reflect the current visible graph node UI, including the currently visible editing UI when a node is in editing mode.
- Focus changes, opening node menus, add buttons, and other transient canvas-only controls should not by themselves trigger remeasurement.
- Label edits or future property-grid changes should be reflected after the graph/store change is applied and the node DOM is re-rendered.
- Existing keyboard/mouse interactions should continue to target visible graph nodes only.
- Visual graph export should wait until the measured layout has settled, then export the current layout input dimensions that were used for layout, including measured overrides when available.

## Implementation Shape

- Add a small DCB measurement utility similar to `apps/slicr-frontend/src/nodeMeasurement.ts`.
- Extract stable graph node content/box rendering from `GraphNodeView` so measurement and visible rendering can share equivalent markup without duplicating dynamic content rules.
- Add a `NodeMeasureLayer` component under `apps/slicr-dcb/src/components/` that renders hidden off-screen measurement nodes for all current graph nodes outside the canvas transform.
- Reuse real `GraphNodeView` rendering for measurement with the same node props as the visible graph, while suppressing user interaction and transient overlays in the measurement container.
- Add measurement state plus an explicit settled/not-settled state in `apps/slicr-dcb/src/App.tsx` or a focused hook extracted from it.
- Run a layout-effect measurement pass after committed graph model changes render the measurement DOM.
- Derive `layoutNodes` from `nodes` plus measured dimensions and pass `layoutNodes` to `compactLayout`.
- Treat existing React graph state updates as the v1 remeasurement trigger unless code inspection proves they are insufficient; avoid adding a broader store subscription unless needed.
- Gate visual graph export on settled measurement/layout state.

## Test Plan

- Unit-test measurement utility:
  - selects only intended measurement elements;
  - returns rounded positive dimensions;
  - ignores invalid measurements.
- Component-test measurement layer:
  - renders one measurement target per graph node;
  - renders off-screen outside the canvas transform;
  - uses real `GraphNodeView` rendering with the same node props as visible nodes;
  - excludes transient menu/add-button/focus-only overlays from affecting measurement.
- App/layout test:
  - mock DOM measurement for nodes with different sizes;
  - verify `compactLayout` receives measured dimensions instead of defaults;
  - verify layout falls back to defaults before measurement or when measurement is invalid;
  - verify editing-mode measurement reflects the currently visible node UI when editing is active.
- Regression test:
  - changing graph content through the graph model/event flow causes a new measurement pass and updates layout input dimensions.
- Export test:
  - visual graph export waits for settled measurement/layout state;
  - visual graph export serializes the dimensions currently used for layout, not stale fixed defaults.

## Deferred Follow-up

- Use `ResizeObserver` if future dynamic content changes size without a graph/store event.
- Broaden measurement invalidation if theme, font loading, zoom, or responsive CSS changes affect node sizes.
- Revisit whether node content should be virtualized or measured incrementally for very large graphs.
