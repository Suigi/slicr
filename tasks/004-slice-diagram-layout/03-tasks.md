# Slice Diagram Layout Tasks

## Feature Description

Implement the async slice diagram layout migration described in [02-plan.md](/Users/daniel/src/private/slicr/tasks/004-slice-diagram-layout/02-plan.md).

## Workflow

Tasks should move through these status values in order:

* `[created]`: the task was described, but no work was done to implement it
* `[started]`: an agent sets this status before starting to work on a task
* `[done]`: an agent sets this status once a task is completed

**IMPORTANT**: Only **ONE** (1) task should be in the `[started]` status at a time.
Agents must update this file as they work: set a task to `[started]` immediately before implementation begins, and set it to `[done]` as soon as that task is complete.

## Learnings

Add any learnings about the feature to [05-learnings.md](/Users/daniel/src/private/slicr/tasks/004-slice-diagram-layout/05-learnings.md).
Add any learnings about the project overall to the documents in the `knowledge` directory.

## Task 1: Derive slice layout-lib requests
### Status
[done]

### Description

Add an adapter that converts a diagram-only slice `Parsed` structure plus measured node dimensions into a `layout-lib` request with derived lanes, ordered groups for `---`, and compatible spacing defaults.

### Acceptance Criteria

* Focused tests prove the adapter derives the expected lane ordering from slice semantics.
* Focused tests prove parsed `---` boundaries become ordered groups.
* Focused tests prove measured node widths and heights are forwarded into the request.

### Dependencies

* None

### Notes

* Keep overview-specific concepts out of this adapter.
* Reuse existing lane-derivation logic rather than re-encoding semantics in a second place.

## Task 2: Replace the async slice layout engine
### Status
[done]

### Description

Update the async slice layout path to call `layout-lib` through the new adapter and translate the library output back into the existing `DiagramEngineLayout` contract used by the rest of the app.

### Acceptance Criteria

* `computeDiagramLayout` uses `layout-lib` for slice diagrams.
* Existing consumers still receive `layout.pos`, `laneByKey`, `rowStreamLabels`, and `precomputedEdges`.
* Overview layout code paths remain unchanged.

### Dependencies

* Task 1

### Notes

* Do not replace the provisional synchronous slice layout path in this task.
* Keep translation logic isolated so it can be reused later if we migrate the provisional path.

## Task 3: Lock in slice behavior with regression coverage
### Status
[done]

### Description

Add or update async slice layout tests so the migration is protected by representative slice scenarios, including multi-section slices and event-stream lane behavior.

### Acceptance Criteria

* Async slice layout tests cover a representative chain, branch or merge, and a multi-section slice.
* At least one regression proves later `---` sections stay to the right of earlier sections.
* Overview tests continue to pass unchanged, demonstrating that scope stayed isolated.

### Dependencies

* Task 2

### Notes

* Favor observable layout behavior over exact coordinate snapshots unless the coordinate is itself the rule being protected.
* Current state after the `layout-lib` migration:
  * `src/domain/diagramEngine.test.ts` passes and confirms the Task 2 engine contract.
  * `src/application/hooks/useDiagramViewState.sliceLayoutStability.test.tsx` passes and confirms the measured async slice path stays stable in the app hook.
  * The remaining failures were all in `src/testing/diagramHarness.test.ts` and have been temporarily skipped so the suite can run while Task 3 re-establishes the right regression shape.
* The skipped harness tests fall into two buckets:
  * Likely rebaseline-only layout shifts:
    * `renders single, simple node`
    * `renders simple flow with three lanes`
    * `renders multiple event lanes`
    * `renders slice dividers`
    * `moves nodes horizontally to avoid edges crossing them`
    * `avoids crossover of fan-out down-stream edges`
  * Likely real regressions to investigate before rebaselining:
    * `renders nodes with big height`
    * `matches DSL with source node with multiple edges`
    * `renders multiple edges from same source without collisions`
    * `renders multiple edges to same target without collisions`
    * `renders multiple edges to same target without collision and node avoidance`
    * `does not cause edges crossing by avoiding sharing paths with other edges`
    * `orders edge y values based on source node x values`
* The clearest regression signal is height handling in unmeasured harness paths:
  * Data-bearing nodes that used to be taller (for example `80/96/112/128`) collapse to the default `42` height in the harness.
  * In the real app, nodes look correct after DOM measurement. This suggests the new contract is "measure first, then async layout", and the harness needs to model that explicitly.
* Recommended Task 3 approach:
  * Keep a small number of exact-coordinate tests only where the exact coordinate is the rule.
  * For the rest, prefer asserting ordering, section separation, lane assignment, endpoints, and collision/crossover properties.
  * Update harness helpers to pass explicit `nodeDimensions` for height-sensitive cases, rather than relying on old implicit content-based height behavior.
  * Revisit the routing-heavy cases individually after height handling is clarified, because some failures may disappear once measured dimensions are supplied.

## Task 4: Render engine-provided slice edge geometry
### Status
[done]

### Description

Update the slice render path so it renders the routed edge polylines produced by `layout-lib` through `precomputedEdges`, instead of recomputing slice edge geometry with the legacy in-repo router.

### Acceptance Criteria

* The normal slice app render path prefers `engineLayout.precomputedEdges` when async slice layout is active.
* A regression proves an upward slice edge keeps the `layout-lib` anchor-side behavior in the rendered path, including the target-side approach.
* Manual edge-point overrides still take precedence when the user has explicitly edited an edge.
* Overview rendering remains on its existing path and is unchanged by this task.

### Dependencies

* Task 2

### Notes

* This task closes the current gap where `computeDiagramLayout` translates `layout-lib` edge geometry correctly, but `useDiagramViewState` still rebuilds rendered slice edges via `buildRenderedEdges(...)` without passing through `engineLayout.precomputedEdges`.
* Keep the fallback router available for provisional layout and any code paths that still lack engine-provided edge geometry.
