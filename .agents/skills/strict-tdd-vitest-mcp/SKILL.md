---
name: strict-tdd-vitest-mcp
description: Execute strict TDD in this repo with explicit red/green/refactor gates and Vitest MCP test runs. Use when the user asks for TDD implementation, wants proof that tests fail first, requires phase-by-phase progression, or asks to use vitest MCP for all test execution.
---

# Skill: strict-tdd-vitest-mcp

Follow a strict red/green/refactor workflow and do not skip phase gates.

## Workflow

1. Define one small behavior change for the current step.
2. Write or update a test that captures only that behavior.
3. Run the targeted test through Vitest MCP.
4. Confirm red:
- The new assertion fails for the expected reason.
- If it passes unexpectedly, tighten or correct the test before moving on.
5. Implement the minimal production change.
6. Run the same targeted test through Vitest MCP.
7. Confirm green:
- The test now passes.
- If still red, keep implementation focused until green.
8. Refactor only when green:
- Remove duplication.
- Extract small utilities/types when it improves clarity.
- Keep behavior unchanged.
9. Re-run targeted tests after refactor and confirm still green.
10. Move to the next behavior step only after red->green->refactor is complete.

## Phase Gate Rules

- Do not move from red to green unless failure is observed and matches the expected failure.
- Do not move from green to next step unless target tests pass.
- Do not perform broad refactors during red phases.
- Keep each step small enough to isolate failures quickly.

## Test Execution Policy

- Use Vitest MCP for all test execution.
- Prefer narrow targets first (single file or directory under change).
- After meaningful milestones, run the full `./src` suite through Vitest MCP, and `just check` lint, typescript and build errors.
- Record whether each run is expected red or expected green.

## Commit Policy

- If the user requests step commits, commit only after a green phase.
- Keep commit scope limited to that TDD step.
- Do not include unrelated files.

## Communication Pattern

For each step, report in this order:
1. Red test added/updated.
2. Red run result and why failure is expected.
3. Minimal implementation change.
4. Green run result.
5. Refactor decision and post-refactor test result.
