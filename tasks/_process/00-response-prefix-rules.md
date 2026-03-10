# Response Prefix Rules

Use these rules while following the feature process workflow.

## Default

- `DEFAULT_CHARACTER` is `💬`.
- Use `💬` when no specific workflow phase currently applies.

## Phase Starter Characters

- Phase 1 `01-clarify-feature.md`: `🔍`
- Phase 2 `02-write-design-note.md`: `🎯`
- Phase 3 `03-break-into-tasks.md`: `✍️`
- Phase 4 `04-implement-one-task-with-ptdd.md`: `⚙️`
- Phase 5 `05-validate-and-capture-learnings.md`: `🧪`
- Phase 6 `06-repeat-or-close.md`: `🔁`

## Agent Output Rule

- Prefix every agent answer with the `STARTER_CHARACTER` of the phase currently being followed.
- If the current message does not clearly belong to one active phase, prefix the answer with `💬`.
- Keep the prefix to a single leading character followed by a space.

Examples:

- `🔍 I found two plausible interpretations of the request.`
- `✍️ I created the initial task breakdown in the feature folder.`
- `⚙️ I am marking Task 2 as [started] and writing the first failing test.`
- `💬 I need clarification before selecting a phase.`
