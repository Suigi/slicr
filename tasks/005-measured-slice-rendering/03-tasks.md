# Measured Slice Rendering Tasks

## Feature Description

Implement the measured-only slice rendering behavior described in [02-plan.md](/Users/daniel/src/private/slicr/tasks/005-measured-slice-rendering/02-plan.md).

## Workflow

Tasks should move through these status values in order:

* `[created]`: the task was described, but no work was done to implement it
* `[started]`: an agent sets this status before starting to work on a task
* `[done]`: an agent sets this status once a task is completed

**IMPORTANT**: Only **ONE** (1) task should be in the `[started]` status at a time.
Agents must update this file as they work: set a task to `[started]` immediately before implementation begins, and set it to `[done]` as soon as that task is complete.

## Learnings

Add any learnings about the feature to [05-learnings.md](/Users/daniel/src/private/slicr/tasks/005-measured-slice-rendering/05-learnings.md).
Add any learnings about the project overall to the documents in the `knowledge` directory.

## Task 1: Gate slice async layout on measurement readiness
### Status
[created]

### Description

Refine the slice branch of `useDiagramViewState` so it does not start `computeDiagramLayout(...)` until the current slice node measurements are ready, while keeping overview behavior unchanged.

### Acceptance Criteria

* A hook-level regression proves slice async layout is not called before required node measurements are available.
* The slice path starts exactly one async layout request for a stable measured render cycle, excluding retries caused by later user edits.
* Overview mode keeps its current async layout timing behavior.

### Dependencies

* None

### Notes

* Prefer keeping any request-token or measurement-version bookkeeping local to the hook.
* Do not broaden this task into visible rendering changes beyond what is required to stop the premature async call.

## Task 2: Hold first slice render blank and preserve later settled snapshots
### Status
[created]

### Description

Update slice visible-state selection so the first unresolved slice render stays blank, while later unresolved slice edits continue showing the previous settled snapshot until the new measured async layout is ready.

### Acceptance Criteria

* A regression proves the first render for a slice exposes no scene model while measurement-plus-layout is pending.
* A regression proves a later slice edit keeps the previous settled scene visible until the replacement measured async result is ready.
* Drag and interaction enablement still stay tied to the settled measured slice scene.

### Dependencies

* Task 1

### Notes

* Keep the existing snapshot reuse pattern if possible instead of inventing a second fallback mechanism.
* The desired first-render UX is blank, not provisional.

## Task 3: Prevent stale measured results from marking a slice settled
### Status
[created]

### Description

Tighten slice readiness so only the latest measured async layout result for the current `layoutStateKey` can become the visible settled scene.

### Acceptance Criteria

* A regression proves an earlier async result for the current key cannot mark the slice settled once a newer measured request has started.
* A regression proves the displayed slice scene comes from the latest measurement set, not a stale earlier result.
* Existing slice edge-geometry regressions continue to pass under the new readiness rules.

### Dependencies

* Task 2

### Notes

* Keep the correlation signal as small and explicit as possible.
* Favor observable view-state behavior over assertions on internal refs.
