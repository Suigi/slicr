# Add width measurement to node layout

## Workflow

Status tags:
- `[not started]`: Work for this step has not begun.
- `[in progress]`: Work for this step is currently underway.
- `[ignored]`: Work for this step is no longer relevant.
- `[completed]`: Work for this step is finished and verified.

Find the next step that is `[not started]` and start it (skip any `[ignored]` steps).
When starting a task, update this file and set the status to `[in progress]`.
After completing the task, update this file and set the status to `[completed]`.

## Generic Guidance
- Keep classic layout width fixed at `180px`.
- Target only ELK behavior for variable node width in this task.
- Use semantic assertions (not full geometry snapshots).

## Steps

2. [completed] **Harness regression: wide pre-divider anchor (semantic)**
   - In `./src/testing/diagramHarness.test.ts`, use the provided DSL scenario.
   - In `./src/testing/diagramHarness.ts`, ensure `computeDiagramGeometry` accepts `nodeDimensions` and forwards them to `computeDiagramLayout`.
   - Inject deterministic dimensions with `nodeDimensions['book-registered'].width = 250` (max width).
   - Assert invariants:
     - anchor render width is `250`;
     - post-divider node is at or beyond `anchor.x + anchor.w + 40 + PAD_X`.
   - Run Vitest MCP for this test and check that it fails in the expected way.

4. [not started] **Verify ELK layout consumes injected width for boundary floor**
   - Confirm `./src/domain/diagramEngine.ts` and `./src/domain/elkLayout.ts` use injected width for ELK node width and boundary floor calculations.
   - Apply minimal code changes only if current behavior fails the new invariant test.

5. [not started] **Run targeted and broad checks**
   - Run Vitest MCP for `./src/testing/diagramHarness.test.ts`.
   - Run Vitest MCP for `./src`.
   - Run lint and build checks.

6. [not started] **Task cleanup**
   - Mark completed steps in this file.
   - Keep any deferred/non-goal work explicit (for example: classic width remains fixed at `180px`).
