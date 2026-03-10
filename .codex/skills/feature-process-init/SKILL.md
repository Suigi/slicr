---
name: feature-process-init
description: Use this skill when starting a new feature with the repo's feature-process workflow. It clarifies the request, suggests a slug, creates the next `tasks/_process/<three-digit-id>-<slug>/` folder, writes `02-plan.md`, and creates `03-tasks.md` from the process templates before any implementation starts.
---

# Feature Process Init

Use this skill when the user wants to start a new feature using the workflow in [tasks/_process/README.md](./tasks/_process/README.md).

This skill covers phases 1 to 3 only. It does not implement feature code.

## Workflow

1. Read [tasks/_process/README.md](./tasks/_process/README.md).
2. Follow [tasks/_process/00-response-prefix-rules.md](./tasks/_process/00-response-prefix-rules.md).
3. Run Phase 1 from [tasks/_process/01-clarify-feature.md](./tasks/_process/01-clarify-feature.md).
4. Run Phase 2 from [tasks/_process/02-write-design-note.md](./tasks/_process/02-write-design-note.md).
5. Use [tasks/_process/00-folder-id-and-slug-rules.md](./tasks/_process/00-folder-id-and-slug-rules.md) to choose the folder name.
6. Write `02-plan.md` in the new feature folder.
7. Run Phase 3 from [tasks/_process/03-break-into-tasks.md](./tasks/_process/03-break-into-tasks.md).
8. Create `03-tasks.md` using [tasks/_process/03-tasks_template.md](./tasks/_process/03-tasks_template.md).
9. Create `05-learnings.md` if the workflow calls for it.

## Required Outputs

At the end of this skill, the feature folder should usually contain:

- `02-plan.md`
- `03-tasks.md`
- `05-learnings.md`

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
