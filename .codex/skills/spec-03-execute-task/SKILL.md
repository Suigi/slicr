---
name: spec-03-execute-task
description: Use this skill when a feature already has a `tasks/<three-digit-id>-<slug>/` folder with `02-plan.md` and `03-tasks.md`, and the next step is to implement exactly one task using PTDD, validate it, update `05-learnings.md`, and decide whether to loop or close.
---

# Spec 03 Execute Task

Use this skill when a feature folder already exists and the next step is to execute one planned task.

This skill covers phases 4 to 6 only. It should complete at most one task per run.

## Workflow

1. Read [tasks/_process/README.md](./tasks/_process/README.md).
2. Follow [tasks/_process/00-response-prefix-rules.md](./tasks/_process/00-response-prefix-rules.md).
3. Read the feature folder's `02-plan.md` and `03-tasks.md`.
4. Run Phase 4 from [tasks/_process/04-implement-one-task-with-ptdd.md](./tasks/_process/04-implement-one-task-with-ptdd.md).
5. Run Phase 5 from [tasks/_process/05-validate-and-capture-learnings.md](./tasks/_process/05-validate-and-capture-learnings.md).
6. Run Phase 6 from [tasks/_process/06-repeat-or-close.md](./tasks/_process/06-repeat-or-close.md).

## Execution Rules

- Implement exactly one `[created]` task.
- Mark it `[started]` immediately before implementation.
- Mark it `[done]` only after required validation passes.
- Update `05-learnings.md` when the task reveals durable guidance.
- Do not silently broaden the plan or absorb adjacent cleanup.

## Validation

Follow the repo's required validation workflow and the validation matrix in Phase 5.

If a required validation step cannot be run, say so explicitly and do not claim full completion.

## Stop Conditions

Stop and ask the human instead of continuing if any stop signal in phases 4 to 6 applies.

Common examples:

- the current task would force a scope change
- the plan or task list appears materially wrong
- validation fails and the cause is unclear
- completing the feature would require a new design decision

## Response Prefix

- Phase 4 messages: `⚙️`
- Phase 5 messages: `🧪`
- Phase 6 messages: `🔁`
- If no single phase clearly applies: `💬`

## Completion

Finish by summarizing:

- the task completed
- the main files changed
- the validation results
- whether the feature should loop to the next task or stop for human input
