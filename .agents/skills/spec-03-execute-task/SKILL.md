---
name: spec-03-execute-task
description: Use this skill when a feature already has a `_tasks/<three-digit-id>-<slug>/` folder with `02-plan.md` and `03-tasks.md`, and the next step is to implement exactly one task using PTDD, validate it, update `05-learnings.md`, and decide whether to loop or close.
---

# Spec 03 Execute Task

Use this skill when a feature folder already exists under the global `_tasks/` directory and the next step is to execute one planned task.

This skill covers phases 4 to 6 only. It should complete at most one task per run.

## Workflow

1. Read [_tasks/_process/README.md](_tasks/_process/README.md).
2. Follow [_tasks/_process/00-current-feature-rules.md](_tasks/_process/00-current-feature-rules.md).
3. Follow [_tasks/_process/00-response-prefix-rules.md](_tasks/_process/00-response-prefix-rules.md).
4. Resolve the `_tasks/<three-digit-id>-<slug>/` feature folder from `_tasks/_process/current-feature.toml` unless the user explicitly names a different folder.
5. Read the feature folder's `02-plan.md` and `03-tasks.md`.
6. Run Phase 4 from [_tasks/_process/04-implement-one-task-with-ptdd.md](_tasks/_process/04-implement-one-task-with-ptdd.md).
7. Run Phase 5 from [_tasks/_process/05-validate-and-capture-learnings.md](_tasks/_process/05-validate-and-capture-learnings.md).
8. Run Phase 6 from [_tasks/_process/06-repeat-or-close.md](_tasks/_process/06-repeat-or-close.md).

## Execution Rules

- Implement exactly one `[created]` task.
- Mark it `[started]` immediately before implementation.
- Mark it `[done]` only after required validation passes.
- Update `05-learnings.md` when the task reveals durable guidance.
- Do not silently broaden the plan or absorb adjacent cleanup.

## Validation

Follow the repo's required validation workflow and the validation matrix in Phase 5.

When running focused app tests, prefer the workspace-specific npm command, for example `npm run test --workspace slicr-dcb -- <path>`. Do not use `./scripts/test.sh <path>` for focused app tests because it is the full-suite wrapper and forwards extra args to every workspace.

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
