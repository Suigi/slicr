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
3. Ask as many clarifying questions as needed to remove ambiguity.
4. Do not make feature decisions on your own in this phase.
5. Ask only questions that materially affect architecture, scope, or user-visible behavior.
6. Prefer questions about:
   - where the feature applies
   - what should stay unchanged
   - matching or eligibility rules
   - visual or interaction expectations
   - ordering or ambiguity rules
7. When useful, present a small set of realistic implementation options with tradeoffs.
8. After the questions are answered, present your understanding of the feature back to the user for confirmation.
9. Do not move to Phase 2 until the user explicitly approves that understanding and tells you to proceed.

## Output

Produce a short design-oriented response that includes:

- the inferred problem statement
- the main constraints
- the unresolved questions
- a recommended implementation direction

## Guardrails

- Do not start coding in this phase.
- Do not jump to a detailed plan until the core rules are settled.
- Keep questions narrow and decision-relevant, but ask as many as needed.
- Separate stable facts from assumptions.
- Do not choose unresolved product or design behavior on the user's behalf.

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
- the agent has presented its understanding of the feature
- the user has explicitly approved moving on to Phase 2
- there are no more open questions
