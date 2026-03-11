# Phase 5: Validate And Capture Learnings

## Response Prefix

- `STARTER_CHARACTER`: `🧪`
- Prefix each agent answer in this phase with `🧪`.
- If this phase no longer clearly applies, fall back to `DEFAULT_CHARACTER` `💬`.

## Goal

Prove the completed task is stable, then record what future work should remember.

## What To Do

1. Run the repository validation workflow required by local instructions. Use the local [$validate](.codex/skills/validate/SKILL.md) skill.
2. At minimum, follow the repo's expected closeout checks for behavior changes.
3. Record whether failures are new, expected, or unrelated pre-existing issues.
4. If validation passes, mark the task `[done]`.
5. Add any durable implementation lessons to `tasks/<three-digit-id>-<slug>/05-learnings.md`.
6. Keep learnings short and operational.

## Validation Matrix

- Run the focused test for the task while iterating.
- Before closing the task, run the repo's required full validation flow for behavior changes.
- Use `./scripts/test.sh` for both focused and full test runs; let [$validate](.codex/skills/validate/SKILL.md) drive the full closeout sequence.
- Include lint, full tests, typecheck, and build whenever local repo instructions require them.
- If one command is intentionally skipped, say so explicitly in the closeout summary.

## Learning Examples

- a contract must stay additive to avoid regressions
- an empty derived array must stay referentially stable
- a reroute is safest in the presentation layer, not the source model
- both renderers should share one helper to avoid drift

## Output

Produce a concise closeout summary that includes:

- what was implemented
- where the main code lives
- what tests were added or updated
- which validation commands passed
- any remaining known warnings or unrelated failures

## Handoff Shape

Use this order in the final summary for the task:

1. behavior implemented
2. main files changed
3. tests added or updated
4. validation results
5. remaining warnings, blockers, or deferred items

## Guardrails

- Do not hide pre-existing failures.
- Do not claim a task is complete without full required validation.
- Do not skip learnings when the task revealed a real constraint.

## Stop Signals

Stop and ask the human before continuing if:

- required validation fails and the failure source is unclear
- a validation failure suggests the completed task invalidates earlier finished tasks
- the repo instructions require a validation step you cannot perform in the current environment
- closing the task would require accepting a behavior regression or unresolved product compromise

## Exit Criteria

Move to the next phase only when:

- validation is complete
- the task file is updated
- relevant learnings are captured
- the current task is fully closed
