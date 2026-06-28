# DCB Node Size Measurement Tasks

## Feature Description

Implement actual graph node size measurement in `apps/slicr-dcb` so measured DOM node dimensions are passed into `layout-lib`. See [02-plan.md](./02-plan.md).

## Workflow

Tasks should move through these status values in order:

* `[created]`: the task was described, but no work was done to implement it
* `[started]`: an agent sets this status before starting to work on a task
* `[done]`: an agent sets this status once a task is completed

**IMPORTANT**: Only **ONE** (1) task should be in the `[started]` status at a time.
Agents must update the task file as they work: set a task to `[started]` immediately before implementation begins, and set it to `[done]` as soon as that task is complete.

## Learnings

Add any learnings about the feature to ./05-learnings.md.
Add any learnings about the project overall to the documents in the ./_knowledge directory.

## Task 1: Add node measurement utility
### Status
[done]

### Description
Add a DCB DOM measurement helper that finds graph node measurement targets by shared selector/data attribute and returns validated `{width, height}` values keyed by node id.

### Acceptance Criteria
* The helper measures only elements matching the DCB measurement selector and carrying a node id.
* Width and height are positive finite integers derived from `getBoundingClientRect()`.
* Invalid, missing, zero, negative, `NaN`, or infinite dimensions are ignored.

### Dependencies
* None

### Notes
* Keep this utility independent of React.
* Match the validation style used by `apps/slicr-frontend/src/nodeMeasurement.ts` where practical.

## Task 2: Extract stable node box rendering
### Status
[done]

### Description
Refactor `GraphNodeView` so the stable node box/content can be rendered without transient focus/menu/add-button controls, allowing visible and measurement nodes to share equivalent markup.

### Acceptance Criteria
* Visible graph nodes preserve current interactions and styling.
* Measurement reuses real `GraphNodeView` rendering with the same node props used for visible graph nodes.
* The measurement render path can be rendered non-interactively/off-screen for measurement.
* Focus-only controls, node menus, and add buttons do not affect measured dimensions.

### Dependencies
* Task 1

### Notes
* Do not implement property-grid content in this task.
* Avoid changing graph behavior beyond the rendering extraction.

## Task 3: Render hidden measurement layer
### Status
[done]

### Description
Add a `NodeMeasureLayer` for `apps/slicr-dcb` that renders one hidden off-screen measurement target per graph node outside the canvas transform using the real `GraphNodeView` measurement render path.

### Acceptance Criteria
* The layer renders one measurable element for every current graph node.
* Measurement elements include the selector/data attributes consumed by the measurement utility.
* The layer is rendered outside the zoomed/panned canvas so dimensions are measured unzoomed.
* The layer is hidden from users and accessibility navigation.
* The layer does not interfere with visible graph interactions.

### Dependencies
* Task 2

### Notes
* CSS should keep measured elements renderable by layout engine APIs; avoid `display: none`.

## Task 4: Feed measurements into layout-lib
### Status
[done]

### Description
Add measurement state and settled/not-settled layout state in the DCB app flow, run measurement after committed graph node DOM renders, derive layout nodes with measured dimensions, and pass those nodes to `compactLayout`.

### Acceptance Criteria
* `compactLayout` receives measured node width/height when valid measurements exist.
* Nodes without measurements continue using `NODE_WIDTH` and `NODE_HEIGHT`.
* Updating measurement state does not loop when measured dimensions have not changed.
* Measurement can reflect the currently visible node UI, including editing mode when active.
* Visible rendered node dimensions match the dimensions returned from layout-lib.

### Dependencies
* Task 3

### Notes
* Keep measured dimensions transient and separate from persisted graph state.

## Task 5: Trigger remeasurement from graph changes
### Status
[done]

### Description
Ensure committed graph/store changes that can alter node content trigger a fresh measurement pass after the updated node DOM has rendered, using existing React graph state updates unless a minimal subscription/version mechanism is proven necessary.

### Acceptance Criteria
* Appending committed graph events that change node content causes measurement to run again.
* Focus changes, menu open state, and canvas zoom do not by themselves trigger remeasurement.
* Recomputed layout uses the latest measured size after the graph change.
* The chosen trigger does not require persisting measured dimensions or rewriting the event store.

### Dependencies
* Task 4

### Notes
* If existing React state updates already provide the trigger, document that in the implementation and keep the change small.

## Task 6: Use measured dimensions in visual graph export
### Status
[done]

### Description
Update the visual graph export path so it waits for settled measurement/layout state and then serializes the same layout node dimensions that were used in the current `compactLayout` request.

### Acceptance Criteria
* Export is blocked or deferred until measurement/layout state is settled.
* Exported visual graph tests include measured node dimensions when measurements are available.
* Export falls back to default dimensions for unmeasured nodes once settled.
* Existing export behavior for edges, lanes, spacing, and layout result remains unchanged.

### Dependencies
* Task 4

### Notes
* This is about export consistency only; do not change the import/event format.
