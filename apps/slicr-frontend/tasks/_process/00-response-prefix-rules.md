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

## Skill Starter Characters

- `$ptdd`: `1️⃣`
- `$ptdd2`: `2️⃣`

## Agent Output Rule

- Prefix every agent answer with the applicable `STARTER_CHARACTER` values.
- If both a phase and a skill apply, place the phase character first and the skill character second.
- If multiple skills apply at the same time, place the phase character first and then list the active skill characters in a stable left-to-right order.
- If only a phase applies, use only the phase character.
- If only a skill applies, use only the skill character.
- If the current message does not clearly belong to any active phase or skill, prefix the answer with `💬`.
- Keep the prefix characters together at the start of the answer, followed by a space.

Examples:

- `🔍 I found two plausible interpretations of the request.`
- `⚙️1️⃣ I am writing the first failing test for this task.`
- `⚙️2️⃣ I am updating the implementation after the predicted failure matched.`
- `1️⃣ I need approval on the next PTDD behavior slice before writing the test.`
- `✍️ I created the initial task breakdown in the feature folder.`
- `💬 I need clarification before selecting a phase.`
