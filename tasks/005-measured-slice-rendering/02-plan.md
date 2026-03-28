# Measured Slice Rendering Plan

## Summary

Change the slice diagram render pipeline so async slice layout runs only after node measurements are available, and slice diagrams render only from that measured async result. On the first render for a slice with no previously settled snapshot, the canvas should stay blank while measurements and measured async layout are in flight. On later updates to the same slice, the app should keep showing the previous settled slice until the new measured async layout is ready.

## Goals

- Run async slice layout only after the required node measurements are available.
- Eliminate the unmeasured async slice layout pass for the normal slice render path.
- Show a blank slice canvas on the very first render while the first measurement-plus-layout cycle completes.
- Keep showing the previous settled slice scene during later edits until the replacement measured layout is ready.
- Preserve current slice renderer contracts once the measured async layout is available.
- Keep overview timing and rendering behavior unchanged.

## Non-Goals

- Do not change `layout-lib` algorithms or request semantics.
- Do not redesign node measurement collection or node sizing rules.
- Do not remove the provisional layout code path if other callers still need it.
- Do not change overview layout timing, overview fallback behavior, or overview rendering.
- Do not change manual node or edge override behavior beyond whatever is required to keep them working with the measured-only slice path.

## Core Rules

- Slice async layout is a measured-only contract in v1 of this feature.
- The slice render path must not start async slice layout until all required non-scenario node measurements for the current slice are available, or measurement has explicitly settled with no geometry available.
- The very first visible state for a slice with no settled snapshot should be blank rather than provisional.
- Once a slice has a settled measured scene, later edits should keep that previous settled scene visible until the next measured async layout completes.
- A slice is considered settled only when the latest measurement set for the current `layoutStateKey` has been incorporated into the async layout result being displayed.
- Manual edge-point overrides and manual node-position overrides must still apply on top of the displayed measured layout.
- Overview mode must keep its current behavior, including any existing provisional or fallback handling.

## Data Model

- Keep the existing `nodeMeasurementState` keyed by `layoutStateKey`.
- Add or refine slice readiness state so the hook can distinguish:
  - no settled slice snapshot exists yet
  - a previous settled slice snapshot exists and may be reused while the next cycle is pending
  - the current measured async layout result matches the latest measurement state
- Track whether the displayed async slice layout result corresponds to the latest measurement pass for the current `layoutStateKey`, rather than treating any async result for that key as ready.
- Continue to store the previous settled slice snapshot as the reusable visible fallback for updates.

## Algorithm Or Derivation Steps

1. Derive the current slice `layoutStateKey` as today.
2. Measure non-scenario node dimensions for the current slice after render.
3. Determine whether slice node measurements are ready:
   - all required node keys have measurements, or
   - measurement has settled and there are no measurable nodes to collect.
4. Do not start `computeDiagramLayout(...)` for slice mode until that measurement-ready condition is satisfied.
5. When starting async slice layout, associate the request with the current measurement state so later readiness checks can tell whether the result is stale.
6. While the first slice cycle has no settled snapshot and measured async layout is pending, expose no slice scene model so the canvas remains blank.
7. While later slice cycles are pending, keep exposing the previous settled slice snapshot for that `selectedSliceId`.
8. When the measured async result that matches the latest measurement state arrives, rebuild the slice scene model from that result, mark the cycle settled, and replace the visible snapshot.
9. Continue to apply manual node positions and manual edge points to the displayed measured layout and rendered edges.

## Renderer Or Interaction Behavior

- Slice renderers should continue to receive the same scene-model shape once a measured async layout is ready.
- On first load of a slice, the renderer should receive no slice scene until the measured async layout finishes, which should appear as a blank diagram region rather than a provisional arrangement.
- On later edits, the renderer should continue receiving the previous settled slice scene until the replacement measured scene is ready, avoiding visible flicker between provisional and final layouts.
- Existing slice interactions should remain disabled while the slice layout is unsettled.
- Overview renderers and overview interaction timing should remain unchanged.

## Implementation Shape

- Keep the change centered in `src/application/hooks/useDiagramViewState.ts`.
- Rework slice-specific readiness so `layoutReady` in slice mode depends on:
  - measurements being ready, and
  - the async layout result being produced from the latest measurements for the current key.
- Preserve the existing visible-snapshot mechanism, but use it only for subsequent slice updates, not for the first-ever unresolved slice render.
- Keep `computeDiagramLayout` and the slice engine contract unchanged unless a small additive metadata field is needed to correlate a result with its measurement version.
- If correlation cannot be expressed cleanly with existing state, add a small slice-local request token or measurement version in the hook rather than broadening engine contracts across the app.

## Test Plan

- Add hook-level regressions that prove slice async layout does not start before node measurements are ready.
- Add a regression that proves the first render of a slice remains blank until measured async layout settles.
- Add a regression that proves a later slice edit keeps the previous settled scene visible until the replacement measured async layout finishes.
- Add a regression that proves the displayed slice scene comes from the latest measured async result rather than an earlier stale result for the same `layoutStateKey`.
- Keep existing regressions for engine-provided slice edge geometry and manual edge overrides passing under the measured-only flow.
- Keep overview tests unchanged to confirm scope isolation.

## Deferred Follow-Up

- Reducing or removing provisional layout code outside the slice render path is deferred.
- Any optimization to avoid remeasuring unchanged nodes across edits is deferred.
- Any cleanup to remove temporary timing instrumentation after this feature lands is deferred to a follow-up decision.
