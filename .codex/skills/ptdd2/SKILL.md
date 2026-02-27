---
name: ptdd
description: "Implement software features using Predictive Test-Driven Development (PTDD): predict behavior, write failing tests first, implement the minimum code, and refactor safely. Use when a user asks for PTDD or predictive TDD explicitly, including prompts like 'Implement the discussed feature using PTDD' or 'Let's work on a new feature using PTDD.'"
---

# Predictive Test-Driven Development (PTDD) Skill

## Overview

This skill guides an LLM through implementing software behavior using Predictive Test-Driven Development. The core discipline is that predictions about test outcomes must be committed to text *before* running tests — this forces genuine understanding and surfaces hidden assumptions early.

The skill operates in two modes:

- **Collaborative mode**: The LLM proposes the next behavior slice and test description, discusses them with the human, and proceeds only after explicit human approval. Use this when implementing a feature iteratively with human oversight.
- **Autonomous mode**: The LLM works through the full process independently to implement a specified feature. Use this when the human wants to delegate implementation entirely.

**In both modes, the skill must begin with a discussion with the human about the overall behavior to be added before any task begins.** The LLM should not start writing tests or code until it can articulate back to the human what the feature is and receive confirmation.

**ALWAYS** run tests through the Vitest MCP server.

---

## Process

Each PTDD iteration handles exactly one behavior slice and follows this loop:

**1. Describe one test**
State the next smallest behavior slice and the exact test you will add for it (inputs, observable outputs/side effects, and assertions). Then write **EXACTLY ONE** new test for that behavior. Do not run it yet.

*In collaborative mode*: propose the behavior slice and test description first, then wait for human approval before writing the test.

**2. Predict the failure**
Before running the test, write a prediction in the following format:

```
PREDICTION: The test will fail with [error type / assertion failure] because [reason].
```

Be specific: identify which assertion will fail and what value it will receive instead of the expected one.

**3. Run the test and evaluate**
Run only the new test (or the narrowest relevant test scope) and record the actual outcome:

```
ACTUAL: [what actually happened]

MATCH: yes / no — [if no: what assumption was wrong, and what does that reveal?]
```

Only proceed to step 4 once the failure matches your prediction. If it does not match, identify the hidden assumption that was violated, update your understanding, and revise the test as needed.

If you have iterated 5 times without a matching failure, stop and request human intervention. Explain what you expected, what is actually happening, and what you have tried.

**4. Write the minimum implementation**
Write as little production code as necessary to make the failing test pass without breaking any existing tests. Do not write code that isn't justified by a currently failing test. Do not hardcode values just to force a specific test to pass unless that genuinely represents the intended behavior.

**5. Predict the full test suite outcome**
Before running the tests, write a prediction:

```
PREDICTION: The new test will pass. The following existing tests may be affected: [list any, with reasons]. All others will continue to pass.
```

**6. Run the full test suite and evaluate**
Record the actual outcome:

```
ACTUAL: [what happened]

MATCH: yes / no — [if no: what assumption was wrong?]
```

If tests are unexpectedly broken, do not proceed. Diagnose and fix before continuing.

**7. Commit**
If the human requests commits or team policy requires checkpoints, commit with a message that describes the behavior added. This checkpoint ensures you can revert safely if refactoring in the next step goes wrong.

**8. Refactor**
Take a critical look at your test and production code. Evaluate the need to refactor. For each refactoring you make:

- State what property you are improving (e.g. removing duplication, clarifying intent, improving naming, improving separation of concerns)
- Make one change at a time
- Run the full test suite after each individual change to verify nothing broke

Refactoring goals include: removing duplication, improving names, improving separation of concerns. Do not add new behavior during this step.

**9. Commit and continue**
If any refactoring was done and commits are expected in this workflow, commit with a message describing what was improved.

**10. Repeat**
Return to step 1 for the next behavior slice until no unimplemented acceptance criteria remain for the requested feature.
---

## Testing Guidelines

- **Follow Arrange–Act–Assert**: separate the three blocks with an empty line
- **Make precise assertions**: do not assert merely that a value is non-null or truthy; assert exact expected values
- **Expose essential details**: values that are essential to the behavior under test must appear directly in the test body and be mirrored in the assertions — do not bury them in setup helpers
- **Hide irrelevant details**: remove setup details that are not relevant to the specific test case. Extract helper functions for common boilerplate, but only for details that don't affect the meaning of the test
- **Test one behavior per test**: each test should verify a single behavior. If you find yourself writing "and" to describe what a test checks, split it
- **Name tests as behavioral descriptions**: test names should read as sentences describing the expected behavior, e.g. `returns_empty_list_when_no_items_match_filter` rather than `testFilter`
- **Test observable behavior, not implementation details**: assert on outputs, return values, and observable side effects — not on internal state or the mechanics of how a result was produced, unless you are explicitly writing a contract test for an interaction
- **Favor focused tests over highly-integrated tests**: test logic at the lowest level possible. Use integrated tests to verify behavior is wired up correctly
- **Do not change production code before red**: for each behavior slice, first observe a failing test for that slice, then implement the minimum code needed to pass

---

## Language-Specific Conventions

This skill is language-agnostic. Additional documents specifying testing conventions, framework idioms, and tooling for specific languages or stacks can be appended or referenced alongside this skill.
