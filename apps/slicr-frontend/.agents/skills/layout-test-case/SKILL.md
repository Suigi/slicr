---
name: layout-test-case
description: Add and fix diagram layout harness tests in src/testing/diagramHarness.test.ts with a visual-verification workflow. Use when the user asks for a new diagram layout test case, wants to reproduce a layout bug in a harness test, or asks to iterate on routing/layout until a new test passes.
---

# Skill: layout-test-case

Use this skill when the user asks for a new diagram layout test case.

## Goal

Add a new harness test case and iterate on layout/routing behavior until it passes, while keeping expected-geometry edits gated by user visual approval.

## Workflow

1. Ask the user for the test body (DSL/scenario).
2. Propose a test name.
3. Wait for acceptance or a renamed test title from the user.
4. Add the test to `src/testing/diagramHarness.test.ts` with the accepted name.
5. Run harness tests first:
   - `nix-shell --run 'npm test -- --run src/testing/diagramHarness.test.ts'`
6. Attempt layout/routing fixes in code to make the new test pass.
7. Do not modify expected test geometry to make tests pass unless explicitly approved by the user.
8. If all tests pass after layout fixes, finish.
9. If layout appears fixed but failures look like offset/baseline mismatches, ask the user for visual inspection.
10. Only after user approval, update the offsets/expected geometry in that test.
11. Re-run harness tests and then full suite:
    - `nix-shell --run 'npm test -- --run src/testing/diagramHarness.test.ts'`
    - `nix-shell --run 'npm test -- --run'`
    - `nix-shell --run 'npm run build'`

## Guardrails

- Keep changes scoped to layout/routing and the new test unless user requests broader changes.
- Preserve existing passing tests unless behavior intentionally changes and user approves.
- Communicate each fix attempt briefly and ask for visual confirmation before expected-geometry changes.

## Command Policy (Strict)

- Use Nix shell for all npm commands in this repo.
- During iteration, run:
  - `nix-shell --run 'npm test -- --run src/testing/diagramHarness.test.ts'`
- Before closing the task, always run:
  - `nix-shell --run 'npm test -- --run'`
  - `nix-shell --run 'npm run build'`

## Visual Check Payload (After Every Fix Attempt)

After each layout/routing change, provide a short payload with:

- Test name.
- DSL snippet (minimal relevant excerpt).
- What changed in layout/routing logic.
- Visual checks (1-3 concrete checks the user should verify), for example:
  - whether target-sharing upward edges keep x/y order without crossing,
  - whether horizontal segments avoid collisions,
  - whether any edge was pushed into source/target nodes.

## Offset-Only Symptoms

Treat failures as potential offset-only mismatches (ask for visual inspection before updating expected geometry) when:

- Most or all failing nodes share the same consistent y delta (for example all `+8`).
- Node heights differ by a consistent constant across many nodes (for example all `+4`).
- Edge points differ mainly by those same uniform deltas while segment ordering/topology stays the same.
- No new crossings/collisions/order inversions are introduced in rendered geometry.
