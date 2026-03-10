# Example Feature Tasks

## Feature Description

Implement the example feature described in [02-plan.md](/Users/daniel/src/private/slicr/tasks/001-example-feature/02-plan.md).

## Workflow

Tasks should move through these status values in order:

* `[created]`: the task was described, but no work was done to implement it
* `[started]`: an agent sets this status before starting to work on a task
* `[done]`: an agent sets this status once a task is completed

**IMPORTANT**: Only **ONE** (1) task should be in the `[started]` status at a time.
Agents must update this file as they work: set a task to `[started]` immediately before implementation begins, and set it to `[done]` as soon as that task is complete.

## Learnings

Add any learnings about the feature to [05-learnings.md](/Users/daniel/src/private/slicr/tasks/001-example-feature/05-learnings.md).
Add any learnings about the project overall to the documents in the `./knowledge` directory.

## Task 1: Add the smallest missing behavior
### Status
[created]

### Description

Add the narrowest domain or UI change that proves the feature can exist.

### Acceptance Criteria

* One focused test demonstrates the new behavior.
* The change stays scoped to one layer or seam.

### Dependencies

* None

### Notes

* Do not include follow-up polish in this task.

## Task 2: Add regression coverage and polish
### Status
[created]

### Description

Close the remaining acceptance gap after the core behavior works.

### Acceptance Criteria

* The observable feature behavior is fully covered.
* Validation passes under the repo workflow.

### Dependencies

* Task 1

### Notes

* Keep final assertions focused on behavior, not incidental internals.
