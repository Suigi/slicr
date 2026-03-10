---
name: spec-02-review-docs
description: Use this skill after a feature folder already has `02-plan.md` and `03-tasks.md`, but before implementation starts, when the goal is to review those documents, identify ambiguities or weak assumptions, ask clarifying questions, and incorporate the user's answers back into the documents.
---

# Spec 02 Review Docs

Use this skill when a feature already has a process folder and you want to repeat the review-and-refine session pattern before coding starts.

This skill is for document refinement only. It does not implement feature code or execute tasks.

## When To Use It

Use this skill when:

- `02-plan.md` and `03-tasks.md` already exist
- the feature definition is mostly formed but still needs a review pass
- you want to ask follow-up questions about labels, scope boundaries, persistence, ownership, interaction details, unsupported cases, or task wording
- the user wants the answers folded back into the docs immediately

## Workflow

1. Read [tasks/_process/README.md](../../../tasks/_process/README.md).
2. Follow [tasks/_process/00-response-prefix-rules.md](../../../tasks/_process/00-response-prefix-rules.md).
3. Read the target feature folder's `02-plan.md` and `03-tasks.md`.
4. Review them for ambiguity, missing decisions, weak wording, and task-plan misalignment.
5. Ask as many clarifying questions as needed, following the spirit of [tasks/_process/01-clarify-feature.md](../../../tasks/_process/01-clarify-feature.md).
6. Do not make unresolved product or design decisions on your own.
7. After the user answers, update `02-plan.md` and `03-tasks.md` directly to capture the decisions.
8. If the answers reveal a durable lesson about planning or task shaping, update `05-learnings.md` too.

## Review Focus

Look for issues such as:

- exact control labels or user-visible text still being vague
- persistence or lifecycle rules not being explicit
- scope boundaries not clearly stated
- unsupported cases missing from the plan
- tasks that no longer match the agreed behavior
- acceptance criteria that cannot be tested cleanly
- plan details that would force an implementation choice the user has not approved

## Output

At the end of the skill:

- the clarified decisions should be written back into `02-plan.md`
- any affected tasks should be updated in `03-tasks.md`
- `05-learnings.md` should be updated if the review exposed a reusable lesson

## Stop Conditions

Stop and ask the human instead of continuing if:

- the review reveals a new feature rather than a refinement of the current one
- the plan would need a major redesign rather than clarification
- the user's answers conflict with earlier approved design decisions in a way that should be resolved explicitly
- the next step should be implementation, but the user has not approved the refined docs yet

## Response Prefix

- Use `🔍` while asking review questions and restating your understanding.
- Use `🎯` while updating or tightening the design note.
- Use `✍️` while updating task wording, acceptance criteria, or dependencies.
- If no single phase clearly applies: `💬`

## Completion

Finish by summarizing:

- which documents were updated
- which decisions were incorporated
- whether any blockers remain before implementation starts
