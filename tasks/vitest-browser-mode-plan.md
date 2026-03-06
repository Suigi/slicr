# Vitest Browser Mode Adoption Plan for Interaction Tests

This document captures what is needed to run the existing interaction-heavy tests in Vitest Browser Mode.

## Current baseline (what exists today)

- Test command is `vitest run` and does not define browser projects yet.
- Many interaction suites explicitly target `jsdom` with `// @vitest-environment jsdom`.
- Interaction tests often dispatch synthetic pointer/mouse events directly in JSDOM.

## What is required

## 1) Add browser-mode dependencies

Install the Browser Mode provider and runtime tooling (Playwright is the most common choice):

- `@vitest/browser`
- `playwright`

Also ensure CI/dev environments can download and cache browser binaries (`npx playwright install --with-deps` where applicable).

## 2) Split Vitest config into projects

Define at least two Vitest projects in `vite.config.ts`:

- `unit-jsdom` (current default behavior)
- `interaction-browser` (browser mode)

For the browser project, configure:

- `test.browser.enabled: true`
- `test.browser.provider: 'playwright'`
- `test.browser.instances` with a browser target (Chromium first)
- `test.include` pattern targeting interaction tests (for example `src/**/*.interaction.test.tsx`)

This keeps the migration incremental while preserving fast unit test feedback.

## 3) Remove hard jsdom pinning from browser-targeted suites

Browser-mode suites cannot keep `// @vitest-environment jsdom` at top-level if they should run in real browser mode. For migrated files:

- remove the file-level jsdom directive, or
- duplicate into browser-specific files (e.g. `*.interaction.browser.test.tsx`) while retaining JSDOM variants temporarily.

## 4) Decide test style: simulated events vs. real user interactions

Current tests dispatch low-level events (`dispatchEvent(new PointerEvent(...))`) and query raw DOM nodes. This can still work in browser mode, but to get browser-value coverage you should standardize on:

- `@testing-library/react`
- `@testing-library/user-event`

for critical interaction paths (pointer drag, focus, keyboard, selection), especially where JSDOM and browser behavior can differ.

## 5) Stabilize test harnesses for real layout/rendering

Browser mode introduces true layout timing and paint behavior. Interaction tests should:

- avoid assumptions tied to synchronous JSDOM render/update timing
- prefer `await` + polling expectations for UI changes that depend on effects/layout
- avoid relying on JSDOM-only APIs or implementation quirks

## 6) Handle environment and storage isolation

Interaction tests use `localStorage` heavily. Browser mode should keep test isolation by:

- clearing storage in `afterEach`
- avoiding cross-test coupling via persistent storage keys
- optionally using per-test contexts when needed

## 7) Add scripts for local/CI workflows

Recommended npm scripts:

- `test` → all projects
- `test:browser` → browser interaction project only
- `test:browser:headed` (optional for debugging)

CI should include browser setup and run browser project at least once per PR, or on a targeted path filter.

## 8) Migration sequence (low risk)

1. Add browser dependencies.
2. Add browser Vitest project with one pilot suite (small interaction file).
3. Fix flakiness/timing patterns discovered in pilot.
4. Migrate remaining `*.interaction.*` suites in batches.
5. Promote browser interaction project into required CI checks.

## 9) Likely hotspots in this codebase

Based on current tests, these suites are good first candidates and likely to need adjustment:

- `src/useDiagramInteractions.edgeCommit.test.tsx` (pointer drag path)
- `src/App.interaction.test.tsx` (broad UI interaction matrix)
- `src/App.nodeAnalysis.interaction.test.tsx` (cross-panel interactions)

## 10) Definition of done

Browser-mode adoption is complete when:

- interaction suites run under the browser project reliably in CI
- no required interaction suites depend on file-level JSDOM directives
- flaky tests are resolved with explicit async/user-event patterns
- developers can run a focused browser command locally
