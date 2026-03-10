# Phase 3: Break The Design Into Tasks

## Response Prefix

- `STARTER_CHARACTER`: `✍️`
- Prefix each agent answer in this phase with `✍️`.
- If this phase no longer clearly applies, fall back to `DEFAULT_CHARACTER` `💬`.

## Goal

Turn the design note into an ordered implementation queue with narrow, testable milestones.

## What To Do

1. Re-use the folder created in Phase 2: `tasks/_process/<three-digit-id>-<slug>`.
2. Create a `03-tasks.md` file in that folder and make it follow [03-tasks_template.md](./tasks/_process/03-tasks_template.md).
3. Decompose the feature into sequential tasks that each change one layer or behavior at a time.
4. Order tasks so later tasks depend on earlier scaffolding rather than mixing concerns.
5. Give each task:
   - a short action-oriented title
   - one focused description
   - acceptance criteria phrased as observable outcomes
   - explicit dependencies
   - notes that prevent scope creep
6. Create a `learnings.md` file in the same folder if the workflow expects one.

## Good Task Shapes

- derive domain data
- extend a contract
- implement one visible behavior
- add one rerouting or interaction refinement
- add regression coverage

## Writing Rules

- Follow [03-tasks_template.md](./tasks/_process/03-tasks_template.md) for structure and section naming.
- Keep each task small enough that one agent run can usually finish it end-to-end.
- Prefer one layer or one observable behavior per task.
- Keep tasks small enough to complete in one agent run.
- Avoid combining architecture work, rendering work, and regression coverage into one task unless the change is trivial.
- Use acceptance criteria that can map directly to tests.
- Make dependencies explicit instead of implied.
- Only one task may be `[started]` at a time.

## Output

Create or update:

- `tasks/_process/<three-digit-id>-<slug>/03-tasks.md`
- `tasks/_process/<three-digit-id>-<slug>/05-learnings.md` when applicable

## Guardrails

- Do not start implementation in this phase.
- Do not write tasks as vague intentions.
- Do not create a single giant task for the whole feature.
- If a task would require several unrelated red-green cycles, split it before implementation starts.

## Stop Signals

Stop and ask the human before continuing if:

- the design note is too vague to derive a deterministic task sequence
- you cannot tell whether a proposed task boundary preserves the intended behavior
- the task order depends on a product decision that was not made in the plan
- the task list would require bundling unrelated work just to make progress
- you find hidden prerequisite work that should probably be called out as its own feature or design update

## Exit Criteria

Move to the next phase only when:

- the task list is ordered
- every task has acceptance criteria
- dependencies are explicit
- the path from first task to final regression coverage is clear
