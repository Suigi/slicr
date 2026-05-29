# Phase 4: Implement One Task With Pi-Enforced PTDD

## Response Prefix

- `STARTER_CHARACTER`: `⚙️`
- Prefix each agent answer in this phase with `⚙️`.
- If this phase no longer clearly applies, fall back to `DEFAULT_CHARACTER` `💬`.

## Goal

Complete exactly one task from the task list using the project-local `pi-ptdd` skill and the project-local Pi PTDD guard extension.

## Required Skill And Extension

Use the `pi-ptdd` skill for implementation.

The project-local extension `.pi/extensions/ptdd-guard.ts` must be loaded. It exposes these required tools:

- `ptdd_start_iteration`
- `ptdd_record_prediction`
- `ptdd_record_actual`
- `ptdd_finish_iteration`
- `ptdd_status`

Do not treat prose-only predictions as sufficient. Test commands in a PTDD iteration must be guarded by the extension tools.

## What To Do

1. Resolve the feature folder from `../_process/current-feature.toml`, unless the user explicitly names a different folder.
2. Validate that the pointer is usable for implementation by checking that `feature_dir`, `02-plan.md`, and `03-tasks.md` exist.
3. Read `../<three-digit-id>-<slug>/02-plan.md`.
4. Read `../<three-digit-id>-<slug>/03-tasks.md` and pick the next unfinished task.
5. Mark that task `[started]` immediately before implementation.
6. Update `../_process/current-feature.toml` to keep the same `feature_dir`, set `phase = "implementation"`, set `current_task` to the selected task id, and keep `status = "active"`.
7. Read only the code needed for that task and its direct dependencies.
8. Re-check the task against the plan so you do not miss constraints that were omitted from the task summary.
9. Invoke the `pi-ptdd` skill for the selected task.
10. Predict and implement the smallest missing behavior through the required PTDD extension-tool sequence.
11. Add or adjust exactly one focused test first for each PTDD iteration.
12. Call `ptdd_record_prediction` before every test command in the iteration.
13. Run exactly the predicted test command.
14. Call `ptdd_record_actual` immediately after each test command.
15. Implement the smallest code change only after `ptdd_record_actual` confirms a matching red failure.
16. Re-run tests only after recording a green prediction through `ptdd_record_prediction`.
17. Call `ptdd_finish_iteration` after green is confirmed.
18. Repeat in small steps until the task acceptance criteria are satisfied.

## Expected Agent Behavior

- Keep updates short and concrete.
- State what seam you are testing before editing code.
- Prefer the smallest viable surface area.
- Use the PTDD extension tools as the auditable source of truth for prediction and actual-result tracking.
- Do not run test commands from memory after writing prose predictions; the prediction must be recorded with `ptdd_record_prediction`.
- If an expected failure does not occur, treat that as information:
  - call `ptdd_record_actual` with `match: false` and `outcome: "unexpected"`
  - verify whether the behavior already exists
  - if so, add the missing regression coverage instead of forcing a code change

## Files To Update

- the implementation files for the task
- the relevant test files
- `../<three-digit-id>-<slug>/02-plan.md` if constraints need clarification
- `../<three-digit-id>-<slug>/03-tasks.md`
- `../_process/current-feature.toml`
- optional scratch tracking files such as `../../test-list.md` if useful locally

## Guardrails

- Do not implement more than one task in a single pass.
- Do not mark a task `[done]` before validation completes.
- Do not broaden scope because nearby cleanup is tempting.
- Do not bypass or ignore the PTDD guard extension if it blocks a tool call.
- Do not mark the task complete unless the conversation contains extension-tool evidence for each red-green cycle.

## Stop Signals

Stop and ask the human before continuing if:

- the next task cannot be completed without changing the agreed feature scope
- implementation reveals that the plan or task file is wrong in a way that affects more than the current task
- the smallest viable change would still require crossing multiple unrelated seams
- you encounter user-authored changes that directly conflict with the current task
- the required behavior cannot be tested or implemented safely without a new design decision
- the PTDD guard extension is unavailable or blocks a required tool call and the correct next state transition is unclear
- a prediction/actual step was skipped and cannot be reconstructed honestly

## Exit Criteria

Move to the next phase only when:

- the task behavior is implemented
- focused tests for the task pass
- the PTDD extension-tool transcript shows valid prediction/actual records for each behavior
- the task is ready for repo-level validation
