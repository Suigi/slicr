---
name: validate
description: "Run the slicr repository validation workflow for a change or task closeout. Use when the user asks to validate work, run repo checks, confirm a task is ready to close, or execute the feature-process validation phase."
---

# Validate Skill

Use this skill to run and report the repository's required validation flow.

## When To Use

- the user asks to validate a change
- a task is ready for closeout
- a workflow phase requires repo validation
- you need to distinguish new failures from pre-existing or unrelated ones

## Commands

Run npm-based checks inside `nix-shell`.

Use this order for full validation:

1. `nix-shell --run 'npm run lint'`
2. `./scripts/test.sh`
3. `nix-shell --run 'npx tsc -b'`
4. `nix-shell --run 'npm run build'`

## Iteration Rules

- During implementation, focused test runs are allowed for speed.
- Use `./scripts/test.sh` for focused tests too; it forwards arguments to `vitest`.
- Before declaring completion, run the full validation sequence above unless the user explicitly says not to.

## Reporting Rules

- Report each validation command and whether it passed, failed, or was skipped.
- If a failure appears pre-existing or unrelated, say that explicitly and include the evidence you have.
- If a required step cannot be run in the current environment, say so and do not claim full completion.
- Do not compress partial validation into "validated" or "all checks passed".

## Closeout Standard

A task is ready to close only when:

- required validation finished
- any failures are clearly categorized
- the summary states the exact commands run
