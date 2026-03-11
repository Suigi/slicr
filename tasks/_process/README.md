# Feature Process Workflow

Use the files in this directory to design and implement a new feature in the same way the slice-connections feature was developed.

## Sequence

1. Start with [01-clarify-feature.md](tasks/_process/01-clarify-feature.md).
2. Then follow [02-write-design-note.md](tasks/_process/02-write-design-note.md).
3. Then follow [03-break-into-tasks.md](tasks/_process/03-break-into-tasks.md).
4. Then loop through:
   - [04-implement-one-task-with-ptdd.md](tasks/_process/04-implement-one-task-with-ptdd.md)
   - [05-validate-and-capture-learnings.md](tasks/_process/05-validate-and-capture-learnings.md)
   - [06-repeat-or-close.md](tasks/_process/06-repeat-or-close.md)

## Feature Folder Layout

For each new feature, create one folder:

`tasks/<three-digit-id>-<slug>/`

That folder should normally contain:

- `02-plan.md`
- `03-tasks.md`
- `05-learnings.md`

## Naming Rules

Follow [00-folder-id-and-slug-rules.md](tasks/_process/00-folder-id-and-slug-rules.md) before creating a new feature folder.

## Current Feature Pointer

Follow [00-current-feature-rules.md](tasks/_process/00-current-feature-rules.md).

`tasks/_process/current-feature.toml` is the single repo-level pointer to the active feature.
Workflow phases and spec skills should resolve the feature folder from that file unless the user explicitly names a different folder.
If the pointer is missing, empty, or stale, stop and ask instead of scanning `tasks/`.

## Response Prefix Rules

Follow [00-response-prefix-rules.md](tasks/_process/00-response-prefix-rules.md) while executing the workflow.

## Example

See [001-example-feature](tasks/001-example-feature) for a minimal example of the expected output files.

## Expected Outputs By Phase

- Phase 1: clarified scope, constraints, open questions, recommended direction
- Phase 2: `02-plan.md`
- Phase 3: `03-tasks.md`, optionally `05-learnings.md`
- Phase 4: one task implemented and marked `[started]`
- Phase 5: validation complete, task marked `[done]`, learnings captured
- Phase 6: either loop to the next task or close the feature

## Stop Conditions

- If the core feature rules are still ambiguous, stop after Phase 1 and ask the user.
- If the design note cannot explain the implementation shape clearly, do not start Phase 3.
- If a task is too large to complete in one focused PTDD cycle, split it before implementation.
- If required validation has not run, do not mark a task `[done]`.
