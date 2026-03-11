---
name: spec-01-init
description: Use this skill when starting a new feature with the repo's feature-process workflow. It clarifies the request, suggests a slug, creates the next `tasks/<three-digit-id>-<slug>/` folder, writes `02-plan.md`, and creates `03-tasks.md` from the process templates before any implementation starts.
---

# Spec 01 Init

Use this skill when the user wants to start a new feature using the workflow in [tasks/_process/README.md](tasks/_process/README.md).

This skill covers phases 1 to 3 only. It does not implement feature code.

## Phase Boundary Guard

This skill spans Phases 1 to 3, but the agent must pause after Phase 1 until the user explicitly approves moving to Phase 2.
Do not assume that asking to "start the skill" is approval for later phases.

## Workflow

1. Read [tasks/_process/README.md](tasks/_process/README.md).
2. Follow [tasks/_process/00-current-feature-rules.md](tasks/_process/00-current-feature-rules.md).
3. Follow [tasks/_process/00-response-prefix-rules.md](tasks/_process/00-response-prefix-rules.md).
4. Run Phase 1 from [tasks/_process/01-clarify-feature.md](tasks/_process/01-clarify-feature.md).
5. Stop after Phase 1 and wait for explicit user approval to continue.
6. After approval, run Phase 2 from [tasks/_process/02-write-design-note.md](tasks/_process/02-write-design-note.md), create `02-plan.md`, and update `tasks/_process/current-feature.toml`.
7. Run Phase 3 from [tasks/_process/03-break-into-tasks.md](tasks/_process/03-break-into-tasks.md), create `03-tasks.md` plus `05-learnings.md` if needed, and keep `tasks/_process/current-feature.toml` current.

## Required Outputs

After Phases 2 and 3, the feature folder should usually contain `02-plan.md`, `03-tasks.md`, and `05-learnings.md`.
`tasks/_process/current-feature.toml` should point at that folder.

## Stop Conditions

Stop and ask the human instead of continuing if any stop signal in phases 1 to 3 applies.

Common examples:

- the feature still has multiple plausible interpretations
- the architecture choice is still unresolved
- the design note is not precise enough to decompose into tasks

## Response Prefix

- Phase 1 messages: `🔍`
- Phase 2 messages: `🎯`
- Phase 3 messages: `✍️`
- If no single phase clearly applies: `💬`

## Completion

Finish by summarizing:

- the chosen folder name
- the files created
- the recommended next step, which is usually Phase 4 via the execution skill
