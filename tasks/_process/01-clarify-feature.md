# Phase 1: Clarify The Feature

## Response Prefix

- `STARTER_CHARACTER`: `🔍`
- Prefix each agent answer in this phase with `🔍`.
- If this phase no longer clearly applies, fall back to `DEFAULT_CHARACTER` `💬`.

## Goal

Turn an initial feature request into a concrete problem statement with explicit scope boundaries and open questions.

## What To Do

1. Read the relevant local code and docs before proposing a solution.
2. Identify the existing subsystem that would likely own the feature.
3. Ask only the questions that materially affect architecture, scope, or user-visible behavior.
4. Prefer questions about:
   - where the feature applies
   - what should stay unchanged
   - matching or eligibility rules
   - visual or interaction expectations
   - ordering or ambiguity rules
5. When useful, present a small set of realistic implementation options with tradeoffs.
6. State your current recommendation, but keep it provisional until the unanswered questions are resolved.

## Output

Produce a short design-oriented response that includes:

- the inferred problem statement
- the main constraints
- the unresolved questions
- a recommended implementation direction

## Guardrails

- Do not start coding in this phase.
- Do not jump to a detailed plan until the core rules are settled.
- Keep questions narrow and decision-relevant.
- Separate stable facts from assumptions.

## Stop Signals

Stop and ask the human before continuing if:

- two or more plausible feature interpretations would lead to materially different designs
- the feature scope crosses multiple subsystems and ownership is unclear
- a core user-visible rule is still ambiguous after reading the local code and docs
- the human must choose between conflicting tradeoffs rather than just confirm details
- the requested behavior appears to conflict with existing product or repo conventions

## Exit Criteria

Move to the next phase only when the following are clear:

- feature scope
- key non-goals
- matching or selection rules
- any special rendering or interaction requirements
- the preferred implementation direction
- there are no more open questions
