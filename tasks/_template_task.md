# `*-tasks.md` Structure Template

Use this file as the reference for task breakdown documents in this directory.

## Purpose

A `*-tasks.md` file turns a plan or feature into an ordered implementation checklist. These files describe the work as a sequence of concrete tasks, where each task has:

* a status marker
* a short description of the intended change
* acceptance criteria phrased as observable outcomes
* explicit dependencies on earlier tasks
* optional notes for scope control or implementation guidance

## Naming

Use the `*-tasks.md` suffix for files that break work into ordered implementation tasks.

Examples:

* `project-overview-tasks.md`
* `overview-diagram-layout-tasks.md`
* `overview-slice-scenarios-tasks.md`

## Required Shape

Each file follows this structure:

```md
# <Feature Name> Tasks

## Feature Description
<short summary of the feature, including a link to feature plan document>

## Workflow

Tasks should move through these status values in order:

* `[created]`: the task was described, but no work was done to implement it
* `[started]`: an agent sets this status before starting to work on a task
* `[done]`: an agent sets this status once a task is completed

**IMPORTANT**: Only **ONE** (1) task should be in the `[started]` status at a time.
Agents must update the task file as they work: set a task to `[started]` immediately before implementation begins, and set it to `[done]` as soon as that task is complete.

## Task 1: <Short task title>
### Status
[created]

### Description
<1 short paragraph describing the change>

### Acceptance Criteria
* <observable outcome>
* <observable outcome>

### Dependencies
* None

### Notes
* <optional scope guidance>

## Task 2: <Short task title>
### Status
[created]

### Description
<1 short paragraph describing the change>

### Acceptance Criteria
* <observable outcome>

### Dependencies
* Task 1

### Notes
* <optional scope guidance>
```

## Section Rules

### Title

Use a single H1 in the form:

```md
# <Feature Name> Tasks
```

### Task heading

Each task starts with an H2 in the form:

```md
## Task <N>: <Short task title>
```

Tasks are ordered numerically to show intended implementation sequence.

### Status

Use a `### Status` subsection with a bracketed marker on the next line.

Observed convention in this directory:

* `[created]` for planned work with no implementation started
* `[started]` for work in progress
* `[done]` for completed work

## Workflow

Tasks should move through these status values in order:

* `[created]`: the task was described, but no work was done to implement it
* `[started]`: an agent sets this status before starting to work on a task
* `[done]`: an agent sets this status once a task is completed

Agents must update the task file as they work: set a task to `[started]` immediately before implementation begins, and set it to `[done]` as soon as that task is complete.

### Description

Use one concise paragraph explaining:

* what should change
* where it applies
* any important constraint that defines the task boundary

### Acceptance Criteria

Write these as bullet points describing externally verifiable outcomes.

Good criteria:

* describe behavior, not implementation steps
* are specific enough to test
* stay scoped to the task

### Dependencies

List prerequisite tasks explicitly.

Use:

* `* None` when the task can start immediately
* `* Task <N>` when the task depends on an earlier task

If a task depends on multiple earlier tasks, list each one as its own bullet.

### Notes

Use notes for guardrails, not for restating the description.

Typical note content:

* scope limits
* invariants to preserve
* implementation hints
* things intentionally excluded from the task

## Writing Conventions

Keep tasks aligned with the existing files in this directory:

* Order tasks in the sequence they should be implemented.
* Keep task titles short and action-oriented.
* Keep descriptions brief but concrete.
* Prefer acceptance criteria that can map cleanly to tests or observable UI behavior.
* Use dependencies to make sequencing explicit instead of burying order inside prose.
* Use notes to prevent scope creep.

## Starter Copy

Copy this block when creating a new `*-tasks.md` file:

```md
# <Feature Name> Tasks

## Feature Description
<short summary of the feature, including a link to feature plan document>

## Workflow

Tasks should move through these status values in order:

* `[created]`: the task was described, but no work was done to implement it
* `[started]`: an agent sets this status before starting to work on a task
* `[done]`: an agent sets this status once a task is completed

**IMPORTANT**: Only **ONE** (1) task should be in the `[started]` status at a time.
Agents must update the task file as they work: set a task to `[started]` immediately before implementation begins, and set it to `[done]` as soon as that task is complete.

## Task 1: <Short task title>
### Status
[created]

### Description
<Describe the change in one short paragraph.>

### Acceptance Criteria
* <Observable outcome>
* <Observable outcome>

### Dependencies
* None

### Notes
* <Optional guidance or scope boundary>
```
