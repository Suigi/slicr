# Phase 2: Write The Design Note

## Response Prefix

- `STARTER_CHARACTER`: `🎯`
- Prefix each agent answer in this phase with `🎯`.
- If this phase no longer clearly applies, fall back to `DEFAULT_CHARACTER` `💬`.

## Goal

Convert the clarified feature definition into a durable design document that another agent can implement without re-discovering the intent.

## Preconditions

Start Phase 2 only if the Phase 1 thread contains an explicit user approval to proceed.
If that approval is missing, do not create the feature folder or write `02-plan.md`.

## What To Do

1. Suggest a short slug for the feature.
2. Follow [00-folder-id-and-slug-rules.md](tasks/_process/00-folder-id-and-slug-rules.md) to choose the folder name.
3. Choose the next available three-digit id and create a feature folder named `tasks/<three-digit-id>-<slug>`.
4. Update `tasks/_process/current-feature.toml` so `feature_dir` points to that folder, `phase = "design-note"`, `current_task = ""`, and `status = "active"`.
5. Create a `02-plan.md` file inside that folder.
6. Write the design note around observable behavior and architectural shape.
7. Include the decisions that came out of Phase 1.
8. Structure the note so it can drive implementation and testing.

## Required Sections

- summary
- goals
- non-goals
- core rules
- data model
- algorithm or derivation steps
- renderer or interaction behavior, if relevant
- implementation shape
- test plan
- deferred follow-up, if relevant

## Writing Rules

- State invariant rules explicitly.
- Prefer examples when a rule could be misread.
- Make ordering and directionality explicit.
- Record unsupported v1 cases instead of leaving them ambiguous.
- Keep plan content additive to the current architecture unless a rewrite is intentional.

## Output

Create or update `tasks/<three-digit-id>-<slug>/02-plan.md` with enough detail that task decomposition becomes mechanical.
Also update `tasks/_process/current-feature.toml` to point at that folder.

## Guardrails

- Do not bury important decisions in prose.
- Do not mix implementation status into the plan.
- Keep the plan focused on one feature, not adjacent cleanup.

## Stop Signals

Stop and ask the human before continuing if:

- you cannot state the core rule of the feature in precise terms
- the design requires choosing between multiple architectural directions with materially different long-term costs
- naming the slug would hide a still-unresolved scope question
- the plan would need to document unsupported behavior that the human may actually expect to be included
- the feature appears to require a rewrite rather than an additive change and that has not been explicitly approved

## Exit Criteria

Move to the next phase only when the design note clearly defines:

- what gets built
- what does not get built
- how the feature is derived or computed
- how it should render or behave
- what tests will prove it works
