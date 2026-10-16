# Agent Interaction Tasks

## Feature Description

Support the full agent-assisted project-model workflow: inspect, propose, preview, obtain human approval, and conditionally apply. See [./02-plan.md](./02-plan.md).

## Workflow

Tasks should move through these status values in order:

- `[created]`: the task was described, but no work was done to implement it
- `[started]`: an agent sets this status before starting work on a task
- `[done]`: an agent sets this status once the task is complete

**IMPORTANT**: Only ONE task should be `[started]` at a time.

## Learnings

Add feature learnings to `./05-learnings.md` when implementation begins.

## Task 1: Create and preview project proposals

### Status

[created]

### Description

Add project-local proposal draft storage and CLI operations to create, inspect, and preview an ordered set of typed commands against a specific project scope and base revision. Proposal creation and preview must remain outside the authoritative event history.

### Acceptance Criteria

- A proposal receives a stable ID and records its project, scope, base revision, and typed commands.
- CLI preview shows the proposed read-model change without appending events.
- Proposal data remains available by ID after process restart for the defined retention period.
- Tests prove proposal creation/preview do not change the project event history and cover unknown IDs and invalid proposal input.

### Dependencies

- None

### Notes

- Reuse the existing CLI read model and typed command vocabulary.
- Define proposal retention/cleanup before shipping the draft store.

## Task 2: Apply approved proposals conditionally

### Status

[created]

### Description

Add an explicit apply operation that accepts a proposal ID only after human approval and routes its commands through shared command handling against the proposal's original base revision.

### Acceptance Criteria

- Applying a current proposal uses shared deciders/`handleCommand` and atomic conditional append.
- Successful apply returns the committed revision and generated identities.
- A stale proposal returns an actionable conflict and is not automatically rebased or partially applied.
- Tests cover successful apply, stale conflict, invalid commands, and repeated apply behavior.

### Dependencies

- Task 1

### Notes

- Proposal creation or preview must never imply approval.
- The event history remains authoritative; proposal drafts remain separate.

## Task 3: Preview proposals in the browser

### Status

[created]

### Description

Allow a proposal ID to open a visual diff in the served editor. Display the current model and whether the proposal's base revision is stale, without applying it.

### Acceptance Criteria

- `slicr serve` can load a known proposal and current project projection and render the proposed difference.
- The preview clearly indicates a stale proposal and never modifies project history.
- Browser tests cover proposal-link creation/opening, refresh/restart, stale proposals, unknown IDs, and non-mutation during preview.

### Dependencies

- Task 1

### Notes

- Explicit approval/application remains a separate CLI command in Task 2.
- Keep proposal storage distinct from `.slicr/` event history.
