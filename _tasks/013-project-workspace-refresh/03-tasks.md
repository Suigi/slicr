# Project Workspace Refresh Tasks

## Feature Description

Keep project and chapter navigation in the served editor current when the project workspace changes through another client. See [./02-plan.md](./02-plan.md).

## Workflow

Tasks should move through these status values in order:

- `[created]`: the task was described, but no work was done to implement it
- `[started]`: an agent sets this status before starting work
- `[done]`: an agent sets this status once the task is complete

**IMPORTANT**: Only ONE task should be `[started]` at a time.

## Learnings

Add feature learnings to `./05-learnings.md` when implementation begins.

## Task 1: Refresh navigation from external workspace changes

### Status

[created]

### Description

Update the served editor's project/chapter navigation when a separate client, such as the CLI, adds or renames workspace entities while the editor is open. Keep the current selected-chapter graph scope and revision safeguards intact.

### Acceptance Criteria

- A project or chapter added or renamed through another client becomes visible in the served editor without a page reload.
- Delayed workspace or graph reads for an old scope cannot overwrite the currently selected project/chapter.
- Navigation and displayed graph data do not combine incompatible revisions.
- Browser regression tests cover external workspace changes and preserve existing CLI/browser graph catch-up behavior.

### Dependencies

- None

### Notes

- An All Chapters view is not required; an unset chapter continues to select the first chapter.
- Keep project reads non-mutating and initialization explicit.
- Preserve separate standalone and project storage authorities.
