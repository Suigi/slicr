# Phase 6: Repeat Or Close

## Response Prefix

- `STARTER_CHARACTER`: `🔁`
- Prefix each agent answer in this phase with `🔁`.
- If this phase no longer clearly applies, fall back to `DEFAULT_CHARACTER` `💬`.

## Goal

Either start the next task in the queue or close the feature when the task list is exhausted.

## What To Do

1. Re-open `tasks/<three-digit-id>-<slug>/03-tasks.md`.
2. If any task remains `[created]`, return to Phase 4 and implement the next one.
3. If all tasks are `[done]`, review whether `02-plan.md` and `05-learnings.md` in the same folder still match the implemented result.
4. Summarize the feature status in terms of:
   - completed task sequence
   - final validation state
   - known deferred items
   - whether a commit should be proposed next under repo workflow

## Iteration Rule

The normal loop is:

1. Phase 4
2. Phase 5
3. Phase 6

Repeat that loop until every task is complete.

## Closeout Rules

- Do not reopen completed tasks unless validation or review proves they are incomplete.
- Keep deferred work out of the finished task list unless it is intentionally scheduled as a new task.
- If the repo requires explicit approval before commit, stop after summarizing and wait for that request.

## Stop Signals

Stop and ask the human before continuing if:

- all remaining work appears to belong in a new feature rather than the current folder
- finishing the feature would require silently changing the agreed plan
- the next task is blocked by a design gap that was not captured earlier
- you are unsure whether to close the feature or reopen earlier tasks because the evidence is mixed

## Exit Criteria

The workflow is complete only when:

- every task is `[done]`
- validations have been run for the latest change
- learnings are captured
- the remaining work, if any, is explicitly deferred rather than ambiguous
