# Phase 4: Implement One Task With PTDD2 (autonomous mode)

## Response Prefix

- `STARTER_CHARACTER`: `⚙️`
- Prefix each agent answer in this phase with `⚙️`.
- If this phase no longer clearly applies, fall back to `DEFAULT_CHARACTER` `💬`.

## Goal

Complete exactly one task from the task list using predictive test-driven development.

## What To Do

1. Resolve the feature folder from `tasks/_process/current-feature.toml`, unless the user explicitly names a different folder.
2. Validate that the pointer is usable for implementation by checking that `feature_dir`, `02-plan.md`, and `03-tasks.md` exist.
3. Read `tasks/<three-digit-id>-<slug>/02-plan.md`.
4. Read `tasks/<three-digit-id>-<slug>/03-tasks.md` and pick the next unfinished task.
5. Mark that task `[started]` immediately before implementation.
6. Update `tasks/_process/current-feature.toml` to keep the same `feature_dir`, set `phase = "implementation"`, set `current_task` to the selected task id, and keep `status = "active"`.
7. Read only the code needed for that task and its direct dependencies.
8. Re-check the task against the plan so you do not miss constraints that were omitted from the task summary.
9. Predict the smallest missing behavior.
10. Add or adjust a focused test first.
11. Run the relevant test and confirm it fails for the expected reason when possible.
12. Implement the smallest code change that moves the behavior forward.
13. Re-run the focused test.
14. Repeat in small steps until the task acceptance criteria are satisfied.

## Expected Agent Behavior

- Keep updates short and concrete.
- State what seam you are testing before editing code.
- Prefer the smallest viable surface area.
- If an expected failure does not occur, treat that as information:
  - verify whether the behavior already exists
  - if so, add the missing regression coverage instead of forcing a code change

## Files To Update

- the implementation files for the task
- the relevant test files
- `tasks/<three-digit-id>-<slug>/02-plan.md` if constraints need clarification
- `tasks/<three-digit-id>-<slug>/03-tasks.md`
- `tasks/_process/current-feature.toml`
- optional scratch tracking files such as `test-list.md` if useful locally

## Guardrails

- Do not implement more than one task in a single pass.
- Do not mark a task `[done]` before validation completes.
- Do not broaden scope because nearby cleanup is tempting.

## Stop Signals

Stop and ask the human before continuing if:

- the next task cannot be completed without changing the agreed feature scope
- implementation reveals that the plan or task file is wrong in a way that affects more than the current task
- the smallest viable change would still require crossing multiple unrelated seams
- you encounter user-authored changes that directly conflict with the current task
- the required behavior cannot be tested or implemented safely without a new design decision

## Exit Criteria

Move to the next phase only when:

- the task behavior is implemented
- focused tests for the task pass
- the task is ready for repo-level validation
