# Phase 4: Implement One Task With PTDD

## Response Prefix

- `STARTER_CHARACTER`: `⚙️`
- Prefix each agent answer in this phase with `⚙️`.
- If this phase no longer clearly applies, fall back to `DEFAULT_CHARACTER` `💬`.

## Goal

Complete exactly one task from the task list using predictive test-driven development.

## What To Do

1. Read `tasks/_process/<three-digit-id>-<slug>/02-plan.md`.
2. Read `tasks/_process/<three-digit-id>-<slug>/03-tasks.md` and pick the next unfinished task.
3. Mark that task `[started]` immediately before implementation.
4. Read only the code needed for that task and its direct dependencies.
5. Re-check the task against the plan so you do not miss constraints that were omitted from the task summary.
6. Predict the smallest missing behavior.
7. Add or adjust a focused test first.
8. Run the relevant test and confirm it fails for the expected reason when possible.
9. Implement the smallest code change that moves the behavior forward.
10. Re-run the focused test.
11. Repeat in small steps until the task acceptance criteria are satisfied.

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
- `tasks/_process/<three-digit-id>-<slug>/02-plan.md` if constraints need clarification
- `tasks/_process/<three-digit-id>-<slug>/03-tasks.md`
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
