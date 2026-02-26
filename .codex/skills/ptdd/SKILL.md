---
name: ptdd
description: "Implement software features using Predictive Test-Driven Development (PTDD): predict behavior, write failing tests first, implement the minimum code, and refactor safely. Use when a user asks for PTDD or predictive TDD explicitly, including prompts like 'Implement the discussed feature using PTDD' or 'Let's work on a new feature using PTDD.'"
---

# Predictive Test-Driven Development (PTDD) Skill

## Overview

This skill guides an LLM through implementing software behavior using Predictive Test-Driven Development. The core discipline is that predictions about test outcomes must be committed to text *before* running tests — this forces genuine understanding and surfaces hidden assumptions early.

The skill operates in two modes:

- **Collaborative mode**: The LLM suggests candidate behaviors and acceptance criteria for steps 1 and 2, discusses them with the human, and proceeds only after explicit human approval. Use this when implementing a feature iteratively with human oversight.
- **Autonomous mode**: The LLM works through the full process independently to implement a specified feature. Use this when the human wants to delegate implementation entirely.

**In both modes, the skill must begin with a discussion with the human about the overall behavior to be added before any task begins.** The LLM should not start writing tests or code until it can articulate back to the human what the feature is and receive confirmation.

**ALWAYS** run test through the vitest MCP server.

---

## Process

Before the first task, create a **test list** in `./test-list.md`: write down all the test cases you anticipate needing to implement the feature. This list will evolve — add and remove items as understanding develops.
If a test list already exists, remove all [done] tests.
*In collaborative mode*: if the test list contains [wip ] or [todo] tests, ask the human whether they want to keep them.
*In autonomous mode*: if the test list contains [wip ] or [todo] tests, remove them.

Use this format for `./test-list.md`, with one test per line and a status tag prefixed to each description:

```md
[done] returns empty list when no items match
[wip ] applies default sort order when no explicit sort is provided
[todo] includes archived items when includeArchived is true
```

Allowed tags are `[todo]`, `[wip ]`, and `[done]`. Update the tag of the active test in each PTDD iteration (`[todo]` -> `[wip ]` -> `[done]`), and keep all other tests accurately tagged.

Each PTDD iteration handles exactly one test from `./test-list.md`.

Each task goes through the following phases:

**1. Identify the behavior**
Identify the smallest independent slice of behavior your application should have that it currently does not. This could be a new feature or a change to an existing one.

*In collaborative mode*: propose candidate behaviors to the human with a brief rationale for each, and wait for approval before proceeding.

**2. Identify the acceptance criteria**
Define how you will assess that the software has the desired behavior. Be specific: what inputs, what observable outputs or side effects?

*In collaborative mode*: propose the acceptance criteria and wait for human confirmation before proceeding.

**3. Write a failing test**
Write **EXACTLY ONE** test with assertions that verify step 2. Follow the testing guidelines below. Do not run it yet.

**4. Predict the failure**
Before running the test, write a prediction in the following format:

```
PREDICTION: The test will fail with [error type / assertion failure] because [reason].
```

Be specific: identify which assertion will fail and what value it will receive instead of the expected one.

**5. Run the test and evaluate**
Run the test and record the actual outcome:

```
ACTUAL: [what actually happened]
MATCH: yes / no — [if no: what assumption was wrong, and what does that reveal?]
```

Only proceed to step 6 once the failure matches your prediction. If it does not match, identify the hidden assumption that was violated, update your understanding, and return to step 2 or 3 as needed.

If you have iterated 5 times without a matching failure, stop and request human intervention. Explain what you expected, what is actually happening, and what you have tried.

**6. Write the minimum code to pass**
Write as little production code as necessary to make the failing test pass without breaking any existing tests. Do not write code that isn't justified by a currently failing test. Do not hardcode values just to force a specific test to pass unless that genuinely represents the intended behavior.

**7. Predict the full test suite outcome**
Before running the tests, write a prediction:

```
PREDICTION: The new test will pass. The following existing tests may be affected: [list any, with reasons]. All others will continue to pass.
```

**8. Run the full test suite and evaluate**
Record the actual outcome:

```
ACTUAL: [what happened]
MATCH: yes / no — [if no: what assumption was wrong?]
```

If tests are unexpectedly broken, do not proceed. Diagnose and fix before continuing.

**9. Commit**
Commit with a message that describes the behavior added. This checkpoint ensures you can revert safely if refactoring in the next step goes wrong.

**10. Refactor**
Take a critical look at your test and production code. Evaluate the need to refactor. For each refactoring you make:

- State what property you are improving (e.g. removing duplication, clarifying intent, improving naming, improving separation of concerns)
- Make one change at a time
- Run the full test suite after each individual change to verify nothing broke

Refactoring goals include: removing duplication, improving names, improving separation of concerns. Do not add new behavior during this step.

**11. Commit and continue**
If any refactoring was done, commit with a message describing what was improved. Then return to your test list and move on to the next task.

---

## Testing Guidelines

- **Follow Arrange–Act–Assert**: separate the three blocks with an empty line
- **Make precise assertions**: do not assert merely that a value is non-null or truthy; assert exact expected values
- **Expose essential details**: values that are essential to the behavior under test must appear directly in the test body and be mirrored in the assertions — do not bury them in setup helpers
- **Hide irrelevant details**: remove setup details that are not relevant to the specific test case. Extract helper functions for common boilerplate, but only for details that don't affect the meaning of the test
- **Test one behavior per test**: each test should verify a single behavior. If you find yourself writing "and" to describe what a test checks, split it
- **Name tests as behavioral descriptions**: test names should read as sentences describing the expected behavior, e.g. `returns_empty_list_when_no_items_match_filter` rather than `testFilter`
- **Test observable behavior, not implementation details**: assert on outputs, return values, and observable side effects — not on internal state or the mechanics of how a result was produced, unless you are explicitly writing a contract test for an interaction

---

## Language-Specific Conventions

This skill is language-agnostic. Additional documents specifying testing conventions, framework idioms, and tooling for specific languages or stacks can be appended or referenced alongside this skill.
