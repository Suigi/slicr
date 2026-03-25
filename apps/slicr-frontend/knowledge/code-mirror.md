# CodeMirror Notes (General + Slicr-Specific)

This document captures practical CodeMirror context for future LLM discussions in this repo.

## Why this exists

- CodeMirror behavior is easy to misdiagnose if trigger, source, and popup rendering are conflated.
- We now have concrete learnings from a real `..` autocomplete bug in `uses:` blocks.

## CodeMirror basics (general)

CodeMirror 6 is extension-driven. Most editor behavior comes from composing extensions into `EditorState`.

Core concepts:

- `EditorState`: immutable state (document, selection, facets, extensions).
- `EditorView`: DOM renderer and interaction surface.
- Extensions: behavior modules (language, completion, keymaps, listeners, themes).
- Completion pipeline:
  - trigger (typing/explicit `startCompletion`)
  - source function returns completion result
  - popup renders options that survive filtering

Key autocomplete APIs:

- `autocompletion(...)`: installs completion behavior.
- `startCompletion(view)`: explicitly open completion.
- completion source function: returns `{ from, options, ... }` or `null`.
- result flags:
  - `filter` (default true): CodeMirror applies query filtering.
  - when `false`, options are shown as provided by the source.

## How CodeMirror is used in this repo

Primary files:

- `src/useDslEditor.ts`: editor construction + integration in React.
- `src/slicrLanguage.ts`: language support, completion source, trigger listener.
- `src/domain/dslAutocomplete.ts`: DSL-specific suggestion logic.

Wiring summary:

1. `useDslEditor` creates an `EditorView` with `slicr()` extension.
2. `slicr()` registers:
  - language support/highlighting/folding
  - `autocompletion({ activateOnTyping: true, override: [slicrCompletionSource] })`
  - custom `updateListener` trigger for `..`
3. `slicrCompletionSource` delegates to domain helpers:
  - `getUsesKeySuggestions(...)`
  - `getDependencySuggestions(...)`

## What we learned from today’s bug (`..` in `uses:`)

Observed symptoms:

- typing `..` did not show popup
- manual checks showed suggestion computation could succeed

Root cause:

- Completion result for `uses` was built from a `..` trigger token.
- With default `filter: true`, CodeMirror filtered options against query `..`.
- Suggestions like `alpha` were filtered out, so no popup items appeared.

Fix:

- In `slicrCompletionSource`, for `uses` suggestions return:
  - `filter: false`
- Keep custom suggestion filtering/ranking in domain logic.

Result:

- `..` now opens and displays `uses` suggestions.

## Important debugging model

When autocomplete fails, separate the stages:

1. Trigger stage
  - Was completion asked to open? (typing or `startCompletion`)
2. Source stage
  - Did source run at expected cursor position?
  - Did it return options?
3. Filtering/render stage
  - Were returned options filtered out by CodeMirror query matching?
  - Did popup DOM render?

This prevents false conclusions like “source is broken” when filtering is the actual issue.

## Repo-specific gotchas

- `uses` completion has a non-word trigger (`..`), so explicit trigger logic is used.
- Do not assume popup absence means source absence.
- In tests, checking `completionStatus` alone is weak; verify options/labels too.
- jsdom popup DOM assertions can be flaky; source-level + state-level assertions are often more stable.

## Guidelines for future changes

- Prefer minimal completion-source changes over cursor mutation hacks.
- If trigger text is symbolic (`..`, `::`, etc.), evaluate whether `filter: false` is needed.
- Keep domain filtering in `src/domain/dslAutocomplete.ts` as source of truth.
- Add focused tests:
  - source-level suggestion correctness
  - integration path for trigger + insertion behavior

## Related tests

- `src/slicrLanguage.autocomplete.test.ts`
- `src/slicrLanguage.autocomplete.ui.test.ts`
- `src/useDslEditor.autocompleteKeydown.test.tsx`
- `src/domain/dslAutocomplete.test.ts`
