# Overview Node Data Toggle Plan

## Summary

Add a checkbox control to the project overview diagram toolbar in a vertical stack to the left of the existing camera zoom buttons so users can show or hide node data rows while staying in overview mode. The toggle applies only to the overview canvas, defaults to showing data, and when disabled it compacts overview cards by removing node-data rows from both rendering and node measurement.

## Goals

- Add an overview-only control for showing and hiding node data.
- Keep the control in the existing camera toolbar area so the option is discoverable where overview navigation already happens.
- Make the hidden state materially improve overview readability by shrinking nodes instead of leaving empty space.
- Remember the user's overview node-data preference for the lifetime of the current app session.
- Preserve current slice-diagram behavior.

## Non-Goals

- Do not add the same toggle to normal slice mode.
- Do not persist the toggle across page reloads.
- Do not change node data formatting rules or analysis-panel data behavior.
- Do not introduce a separate overview-specific renderer.

## Core Rules

- The checkbox appears only when the main canvas is in `overview` mode.
- The checkbox is rendered in the same overlay group as the camera zoom controls, in a vertical stack immediately to the left of the zoom buttons.
- The control defaults to checked whenever the app starts, meaning overview initially shows node data.
- After the user changes the setting, that preference remains in effect for the rest of the current app session, including when leaving overview mode and later returning.
- The preference is global for the current app session rather than being scoped per canvas instance.
- Unchecking the control hides node data rows for all overview node cards, including scenario cards and any other overview card path that reuses the shared node-card seam.
- When node data is hidden, all overview node geometry must be remeasured without data rows so the diagram becomes denser.
- The toggle must not affect slice-mode cards, documentation previews, or analysis-panel content.
- Switching between slice and overview mode must not mutate slice-mode node measurement or layout overrides.

## Data Model

- Add app-local UI state for `overviewNodeDataVisible: boolean`.
- Keep that state in a session-scoped app owner so the current value survives mode switches during the same session.
- Thread that state through the diagram section/view model so overview rendering and measurement can branch on it.
- Extend the shared node-card rendering seam with a generic `hideData` prop. The prop should default to the current behavior when omitted so existing call sites do not change.
- Reuse existing parsed/layout data; no new persisted domain model is required.

## Algorithm Or Derivation Steps

1. Read `overviewNodeDataVisible` from app-local UI state.
2. When `diagramMode !== 'overview'`, render and measure node cards exactly as today.
3. When `diagramMode === 'overview'`, pass the visibility flag to all overview `NodeCard` call sites and to both:
   - the node measurement layer used to derive measured heights
   - the diagram renderer path that renders visible cards and scenario cards
4. If overview node data is hidden, measure cards with header-only content so layout height shrinks before the scene model is rendered.
5. Recompute the overview scene using the existing measurement/layout pipeline; do not special-case node positions after render.

## Renderer Or Interaction Behavior

- The control should use checkbox semantics with the visible label `Show Node Data`.
- Clicking the checkbox updates the overview canvas immediately without leaving overview mode.
- The control should not interfere with camera pan/zoom gesture handling, matching the current toolbar event isolation.
- Overview selection, hover, and zoom behavior stay unchanged.
- If camera controls are not rendered for the main canvas, the overview toggle should not appear independently.

## Implementation Shape

- Start in app-local state and the app view-model contract so overview-specific UI state has a single owner.
- Keep the state owner above overview/slice mode switching so the current session preference is reused when re-entering overview.
- Extend `DiagramCanvas` and the diagram renderer adapter props to carry the overview node-data visibility flag and an action for toggling it.
- Update `NodeCard` to support header-only rendering when a generic `hideData` prop is set, while preserving current behavior when the prop is omitted.
- Update the measurement path (`NodeMeasureLayer` and any overview-specific measurement inputs) so hidden data changes actual measured heights for all overview nodes before overview layout is derived.
- Keep the branching narrow: slice mode should continue calling `NodeCard` with the current default behavior.

## Test Plan

- Add a renderer or component test proving `NodeCard` can suppress `.node-fields` while keeping the header visible when `hideData` is set, and that omitting the prop preserves current behavior.
- Add an interaction test proving the overview toolbar renders a checked `Show Node Data` checkbox in a vertical stack to the left of the zoom controls.
- Add an interaction test proving unchecking the box removes node data rows from all overview cards without affecting slice mode after exit, and that re-entering overview in the same session preserves the last chosen checkbox state.
- Add a geometry/layout regression proving all overview nodes are measured shorter when node data is hidden.
- Run lint, full tests, `nix-shell --run 'npx tsc -b'`, and `nix-shell --run 'npm run build'` during execution-phase validation.

## Deferred Follow-Up

- Persist the overview toggle in local storage if the control becomes part of a broader diagram preferences model.
- Consider separate defaults for overview nodes versus scenario cards only if user feedback shows the single toggle is too coarse.
