# Overview Node Data Toggle Tasks

## Feature Description

Implement the overview-only node-data visibility control described in [02-plan.md](tasks/002-overview-node-data-toggle/02-plan.md).

## Workflow

Tasks should move through these status values in order:

* `[created]`: the task was described, but no work was done to implement it
* `[started]`: an agent sets this status before starting to work on a task
* `[done]`: an agent sets this status once a task is completed

**IMPORTANT**: Only **ONE** (1) task should be in the `[started]` status at a time.
Agents must update this file as they work: set a task to `[started]` immediately before implementation begins, and set it to `[done]` as soon as that task is complete.

## Learnings

Add any learnings about the feature to [05-learnings.md](tasks/002-overview-node-data-toggle/05-learnings.md).
Add any learnings about the project overall to the documents in the `knowledge` directory.

## Task 1: Add overview node-data visibility state
### Status
[done]

### Description

Add the new overview-only UI state and thread it through the app/diagram view-model so later renderer and measurement changes can branch without touching slice-mode behavior.

### Acceptance Criteria

* App state exposes a boolean flag for overview node-data visibility with a default visible value.
* The flag is owned at app-session scope so leaving overview mode and returning later in the same session preserves the user's last choice.
* Diagram renderer plumbing can read the flag and invoke a toggle action without relying on implicit globals.
* Existing slice-mode tests continue to pass without behavior changes.

### Dependencies

* None

### Notes

* Keep the state local to app UI concerns; do not introduce persistence across page reloads in this task.

## Task 2: Render the overview toolbar checkbox and compact cards
### Status
[done]

### Description

Add the checkbox in a vertical stack to the left of the camera zoom controls and update overview rendering plus node measurement so toggling the checkbox hides node data rows and recomputes overview card heights.

### Acceptance Criteria

* In overview mode, the toolbar shows a checked `Show Node Data` checkbox in a vertical stack to the left of the zoom buttons.
* Unchecking the control removes `.node-fields` from all overview cards while preserving card headers and interactions.
* Overview nodes become shorter when data is hidden because measurement/layout uses header-only cards for all overview node measurement paths.
* Slice mode continues showing node data and does not render the overview-only checkbox.

### Dependencies

* Task 1

### Notes

* Reuse the shared `NodeCard` seam rather than duplicating node markup inside the overview renderer.
* Implement the shared seam as a generic `hideData` prop whose default or absence preserves all current non-overview behavior.
* The checkbox behavior should consume the session-scoped state from Task 1 rather than resetting on each mode switch.

## Task 3: Add regression coverage and finish validation
### Status
[done]

### Description

Close the feature with focused regression coverage around the new toggle behavior and complete the repo-required validation pass.

### Acceptance Criteria

* Automated tests cover the overview checkbox placement, generic `hideData` rendering behavior, hidden-data rendering across all overview cards, compacted overview layout behavior, and same-session state retention after leaving and re-entering overview.
* Full validation passes under the repo workflow: lint, full tests, typecheck, and build.
* Any implementation learnings needed for future agents are recorded in `05-learnings.md`.

### Dependencies

* Task 2

### Notes

* Keep the final regression assertions behavior-focused and avoid coupling tests to incidental DOM structure beyond the control and node-data visibility seams.
