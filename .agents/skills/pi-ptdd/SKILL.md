---
name: pi-ptdd
description: "Autonomously implement one software task using Pi-enforced Predictive Test-Driven Development. Use when a task must be implemented with PTDD in this repo. Requires the project-local ptdd-guard Pi extension tools."
---

# Pi PTDD

Use this skill to implement exactly one task autonomously with Predictive Test-Driven Development enforced by the project-local Pi extension `.pi/extensions/ptdd-guard.ts`.

## Response Prefix

- `STARTER_CHARACTER`: `π`
- If a workflow phase is also active, prefix responses with both starter characters in this order: phase first, then `π`.
- Example combined prefix: `⚙️π `

## Autonomy Rule

This skill has no collaborative mode. Run autonomously until either:

- the selected task is implemented and validated, or
- a stop condition is met.

Do not ask for approval between PTDD iterations.

## Required Extension Tools

The Pi PTDD guard extension provides these tools:

- `ptdd_start_iteration`
- `ptdd_record_prediction`
- `ptdd_record_actual`
- `ptdd_finish_iteration`
- `ptdd_status`

Use these tools as part of the workflow. Do not rely on prose-only predictions.

## Hard PTDD Rules

- Each iteration covers exactly one independently testable behavior.
- Write or adjust exactly one focused test before production code for that behavior.
- Before running any test command for the iteration, call `ptdd_record_prediction` with the exact command to be run.
- The immediately following test command must match the recorded command exactly.
- After the test command returns, call `ptdd_record_actual` before editing production code or running another test.
- Do not edit production code until `ptdd_record_actual` confirms `failed-as-expected` with `match: true`.
- After production code changes, call `ptdd_record_prediction` again for the green test run before running tests.
- After the green test run, call `ptdd_record_actual` with `passed-as-expected` and `match: true`.
- Call `ptdd_finish_iteration` only after green has been confirmed for that iteration.
- Repeat until the task acceptance criteria are satisfied.

## Test List

Before the first iteration for a task, create or refresh `./test-list.md` in the active package/app working directory.

Rules:

- Remove old `[done]`, `[wip ]`, and `[todo]` entries from prior work.
- Add anticipated test cases for the current task only.
- Use exactly this format:

```md
[todo] behavior description
[wip ] active behavior description
[done] completed behavior description
```

During each iteration:

1. Mark exactly one test `[wip ]`.
2. Complete the PTDD red-green cycle for that test.
3. Mark it `[done]` after green is confirmed.
4. Keep all other future tests `[todo]`.

## One Iteration Algorithm

For each `[todo]` behavior:

1. Mark the behavior `[wip ]` in `test-list.md`.
2. Call `ptdd_start_iteration` with:
   - the single behavior
   - observable acceptance criteria
3. Write exactly one focused failing test.
4. Call `ptdd_record_prediction` with:
   - the exact test command
   - `expectedOutcome: "fail"`
   - a specific prediction of the failure type/assertion
5. Run exactly that test command.
6. Call `ptdd_record_actual` with:
   - what happened
   - whether it matched
   - `outcome: "failed-as-expected"` only if the expected red failure occurred
7. If the result did not match, do not implement production code. Diagnose, adjust the test or understanding, and repeat from step 4. Stop after five mismatches.
8. Implement the minimum production code needed for this behavior.
9. Call `ptdd_record_prediction` with:
   - the exact focused/full-enough test command
   - `expectedOutcome: "pass"`
   - any existing tests likely affected
10. Run exactly that command.
11. Call `ptdd_record_actual` with:
   - what happened
   - whether it matched
   - `outcome: "passed-as-expected"` only if tests passed as predicted
12. If green is confirmed, mark the test `[done]` and call `ptdd_finish_iteration`.
13. Refactor only after green. If refactoring, use the same prediction/actual discipline around each test run.

## Test Command Guidance

- Prefer the smallest focused test command that exercises the current behavior.
- Use the repo-required test wrapper when it supports the focused run.
- If the wrapper cannot express a valid focused run, use the package/workspace test command and record that fact in the task closeout.
- Before closing the task, run the repo-required validation flow from the surrounding workflow phase.

## Stop Conditions

Stop and report instead of continuing if:

- the extension blocks a tool call and the correct next PTDD step is unclear
- five consecutive prediction mismatches occur in one iteration
- the current behavior cannot be tested without broadening the task
- production code would need to change before a matching red test
- the task acceptance criteria require a design decision not present in the plan
- validation fails and the cause is unclear

## Completion Requirements

A task implemented with this skill is not complete unless:

- every added behavior has a visible PTDD extension-tool transcript in the conversation
- every test in `test-list.md` is `[done]`
- task-focused tests pass
- required validation from the surrounding workflow passes or any pre-existing unrelated failures are explicitly identified
