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
- Prefer behavioral tests that import and use the desired API naturally; do not write tests whose only purpose is to assert that symbols are exported.
- A compile/typecheck failure is an acceptable red outcome when a behavioral test cannot compile because the desired API is not exported or not typed yet.
- To run a test command during an active iteration, call `ptdd_record_prediction` with the exact command and a concrete, falsifiable prediction of the test outcome; this tool call runs the command itself and returns the result.
- A red prediction must state the specific failing assertion/behavior, the expected value/result, the current actual value/result, and the likely failure message or failing test name when known.
- For compile/typecheck reds, state the behavior the test is trying to exercise, the expected successful compile/behavioral result, the current compiler/typecheck error, and the exact likely diagnostic text.
- A green prediction must state the concrete behavior/assertion expected to pass and any related tests expected to remain passing.
- Do not run the predicted test command separately with `bash`; `ptdd_record_prediction` is the test runner for active PTDD iterations.
- After `ptdd_record_prediction` returns the command result, call `ptdd_record_actual` before editing production code or running another test, recording whether the observed output matched the concrete prediction.
- Do not edit production code until `ptdd_record_actual` confirms `failed-as-expected` with `match: true`.
- Multiple consecutive predictions are allowed and encouraged when they keep the same single behavior and make smaller implementation steps clearer.
- After a confirmed red, make the smallest production change that advances the behavior, then predict the next concrete outcome. That next prediction may be another fail, such as compile-red becoming assertion-red, or it may be pass.
- After production code changes, call `ptdd_record_prediction` again before running tests.
- After a green test run, call `ptdd_record_actual` with `passed-as-expected` and `match: true`.
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
   - `predictedReason`: a concrete prediction of the assertion/behavior that will fail and why
   - `predictedExpected`: the value/result the new test expects
   - `predictedActual`: the value/result the current implementation is predicted to produce
   - `predictedFailureMessage`: the expected failure message, matcher output, thrown error, or failing test name when known

   Bad red prediction: "This test fails because the method is not implemented."

   Good runtime red prediction: "`calculateTotalDiscount()` fails because the new test asserts the returned total is `25`, but the current implementation returns `7`; the matcher output should be equivalent to `expected 25 received 7`."

   Good compile/typecheck red prediction: "The behavioral test imports and calls `createInvoiceSummary()` to assert the summary total is `25`, but the package entrypoint currently does not export `createInvoiceSummary`; TypeScript should fail with `Module './index' has no exported member 'createInvoiceSummary'`."
5. Wait for `ptdd_record_prediction` to run the command and return the result. Do not run the command separately.
6. Call `ptdd_record_actual` with:
   - what happened, including the relevant failure/pass output
   - whether the observed output matched the predicted outcome, reason, expected value, and actual value
   - `outcome: "failed-as-expected"` only if the expected red failure occurred
   - `mismatchExplanation` when the result did not match
7. If the result did not match, do not implement production code. Diagnose, adjust the test or understanding, and repeat from step 4. Stop after five mismatches.
8. Implement the minimum production code needed to advance this behavior by one step.
9. Call `ptdd_record_prediction` with the exact focused/full-enough test command and the next concrete expected outcome:
   - use `expectedOutcome: "fail"` when the minimal change should move from one predicted failure mode to another, such as compile/typecheck failure becoming a runtime assertion failure
   - use `expectedOutcome: "pass"` when the minimal change should satisfy the behavior
   - include `predictedReason`, and for fail predictions include `predictedExpected`, `predictedActual`, and `predictedFailureMessage` when known
10. Wait for `ptdd_record_prediction` to run that command and return the result. Do not run the command separately.
11. Call `ptdd_record_actual` with:
   - what happened, including the relevant failure/pass output
   - whether it matched the concrete prediction
   - `outcome: "failed-as-expected"` for matching fail predictions or `outcome: "passed-as-expected"` for matching pass predictions
   - `mismatchExplanation` when the result did not match
12. If the result is another confirmed red, repeat from step 8 for the same behavior. If green is confirmed, mark the test `[done]` and call `ptdd_finish_iteration`.
13. Refactor only after green. If refactoring, use the same prediction/actual discipline around each test run.

## Behavioral Test Guidance

Write tests for the behavior being added, not for the mechanics of exposing that behavior. If the desired behavior requires a new public API, import and use that API in the behavioral test. If the symbol is missing, predict the compile/typecheck failure as the red outcome instead of adding an export-shape assertion.

Positive example:

```ts
import {describe, expect, it} from 'vitest';
import {MemorySpecEventStore} from './specEventStore.ts';
import type {Event} from '../types.ts';

type TestEvent = Event<'Created', {readonly value: number}>;

const firstEvent: TestEvent = {type: 'Created', payload: {value: 1}, tags: []};
const secondEvent: TestEvent = {type: 'Created', payload: {value: 2}, tags: []};

describe('MemorySpecEventStore.append', () => {
  it('assigns increasing sequence positions starting at 1', async () => {
    const store = MemorySpecEventStore.create<TestEvent>();

    await expect(store.append([firstEvent, secondEvent])).resolves.toEqual([
      {position: 1, event: firstEvent},
      {position: 2, event: secondEvent},
    ]);
  });
});
```

This is preferred because it imports and uses the API naturally, asserts observable behavior, and would still produce a valid PTDD red if the API were not importable yet.

Example consecutive prediction flow for this one behavior:

1. Write the behavioral test above.
2. Predict `npm run typecheck --workspace=packages/event-sourcing` fails because `MemorySpecEventStore` is not importable/exported yet.
3. Add only the export/API skeleton needed for the test to compile.
4. Predict the focused Vitest command fails because `append([firstEvent, secondEvent])` returns the wrong result, such as `[]`, instead of positions `1` and `2`.
5. Implement the append sequencing behavior.
6. Predict the focused Vitest command passes because appended events are returned with increasing positions starting at `1`.

Avoid this pattern unless export shape is itself the behavior under test:

```ts
import * as publicApi from './index.ts';

expect(publicApi).toHaveProperty('MemorySpecEventStore');
```

## Test Command Guidance

- Prefer the smallest focused test command that exercises the current behavior.
- Typecheck commands such as `npm run typecheck --workspace=<workspace-name>` or `tsc --noEmit` count as test commands when they exercise the focused behavioral test or its imports.
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
