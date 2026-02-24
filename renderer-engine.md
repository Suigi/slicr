# Renderer Engine Migration Notes

This document captures the current learnings and the preparation plan for switching diagram rendering from the current DOM/SVG implementation to a different engine (for example a tldraw-backed renderer or a custom renderer with similar architecture).

## Purpose

- Preserve a stable migration strategy across future LLM discussions.
- Keep rendering concerns isolated from diagram/domain concerns.
- Reduce regression risk by introducing seams before changing rendering technology.

## Current State (After Phase 0 + Phase 1 + Phase 2)

- Rendering contract exists in:
  - `/Users/daniel/src/private/slicr/src/diagram/rendererContract.ts`
- Scene builder exists in:
  - `/Users/daniel/src/private/slicr/src/diagram/sceneModel.ts`
- App now renders from scene model (instead of inline lane/viewport/path computations):
  - `/Users/daniel/src/private/slicr/src/App.tsx`
- DOM/SVG renderer adapter extracted to:
  - `/Users/daniel/src/private/slicr/src/diagram/domSvgRenderer.tsx`
- Renderer registry/factory added:
  - `/Users/daniel/src/private/slicr/src/diagram/rendererRegistry.ts`
- Experimental renderer skeleton added:
  - `/Users/daniel/src/private/slicr/src/diagram/experimentalRenderer.tsx`
- Renderer selection flag added/persisted via runtime flags:
  - `/Users/daniel/src/private/slicr/src/domain/runtimeFlags.ts`

### Key architectural shift already done

- App no longer acts as the low-level renderer assembler.
- App computes domain/layout/interactions, then builds a `DiagramSceneModel`.
- Rendering consumes `DiagramSceneModel` fields (`nodes`, `edges`, `lanes`, `boundaries`, `title`, `viewport`).

This is the core preparatory work needed before engine swapping.

## Why the first two phases are still the right prep

Yes, these remain the highest-value preparatory phases before swapping renderer engines.

### Phase 0: Stabilize + isolate renderer seam

- Objective:
  - Remove tight coupling between App internals and concrete DOM structure.
- Value:
  - Gives a single adapter seam where new renderer(s) can plug in.
  - Makes behavior-preserving refactors testable.

### Phase 1: Introduce scene model

- Objective:
  - Move from "App builds DOM details" to "App builds renderer-agnostic scene data."
- Value:
  - New renderer engine only needs `DiagramSceneModel` + callbacks.
  - Domain/layout logic remains shared and unchanged during renderer replacement.
  - Enables side-by-side renderers and parity testing.

## Renderer Contract Learnings

From `/Users/daniel/src/private/slicr/src/diagram/rendererContract.ts`:

- Enforced invariants:
  - Stable IDs for nodes and edges.
  - World-space coordinates independent of camera transforms.
  - Commit-on-end for drag interactions.
- Scene shape now includes:
  - Explicit node/edge render keys.
  - Lane bands and labels as precomputed scene primitives.
  - Boundary primitives.
  - Title primitive.
  - World dimensions and viewport offset/size.

Implication: future engines should consume these primitives, not recompute them.

## Scene Builder Learnings

From `/Users/daniel/src/private/slicr/src/diagram/sceneModel.ts`:

- Captures currently-shipped rendering behavior in one place:
  - viewport bounds + margins
  - lane derivation for classic and elk modes
  - boundary placement
  - node visual state classes (highlight/selected/related/trace-hovered)
  - edge paths and draggable segment indices
- This centralization is the anti-regression checkpoint.

Implication: migrate engines against scene parity first, visual polish second.

## Good Ideas to Carry from tldraw-like rendering architecture

When moving to tldraw SDK or a similar custom approach, keep these ideas:

- Shape normalization:
  - Convert domain nodes/edges into normalized scene objects once, then render.
- Stable identity everywhere:
  - Deterministic IDs for shapes, handles, and relations to preserve selection/drag state.
- Explicit camera/viewport model:
  - Keep world coordinates stable and apply transform in renderer layer only.
- Interaction decoupling:
  - Render layer emits intent events (`onNodeMoveCommit`, `onEdgePointsCommit`) instead of mutating domain directly.
- Layered composition:
  - Separate lanes/background, boundaries, nodes, edges, handles, labels.
- Incremental updates:
  - Update changed shapes only; avoid full scene re-materialization where possible.
- Render-agnostic scene tests:
  - Continue validating scene model independent of DOM implementation.

## Updated Migration Plan (Stricter Approach)

## Phase 0 (done): Renderer seam

- Extract renderer-facing model/types.
- Keep behavior unchanged.
- Keep tests passing as baseline.

## Phase 1 (done): Scene model

- Build `DiagramSceneModel` from parsed/layouted/interacted state.
- App renders from scene model.
- Preserve existing interactions and callbacks.

## Phase 2 (done): Introduce renderer adapters

- Create interface:
  - `render(scene, callbacks)` or component equivalent.
- Keep existing DOM/SVG renderer as `domSvgRenderer`.
- Move renderer-specific JSX out of `App.tsx` completely.
- App chooses renderer adapter by feature flag.

Deliverables:
- `domSvgRenderer` module.
- `rendererRegistry`/factory.
- No behavior changes.

Status:
- Completed.
- App now mounts a renderer adapter selected by persisted runtime flag (`dom-svg` default, `experimental` available).
- Renderer-specific canvas/DOM/SVG JSX has been moved out of `App.tsx`.

## Phase 3 (in progress): Add experimental new engine renderer

- Implement `tldrawRenderer` (or alternate custom engine) consuming same contract.
- Map:
  - scene nodes -> engine shapes
  - scene edges -> engine connectors/paths
  - scene lanes/boundaries/title -> non-interactive shapes/layers
- Preserve callbacks and commit semantics.

Deliverables:
- Renderer parity for core behaviors:
  - selection
  - hover
  - node drag commit
  - edge segment drag commit
  - viewport initialization/focus

Current status:
- Skeleton `experimentalRenderer` module exists and is wired through the same adapter contract.
- It currently delegates to the DOM/SVG adapter for behavior-preserving plumbing.
- Engine-specific shape mapping and rendering are still pending.

## Phase 4: Parity hardening + rollout

- Add renderer parity tests (golden/behavioral).
- Run side-by-side in playground/flagged env.
- Fix visual and interaction deltas.
- Promote new renderer to default after parity criteria met.

## Recommended Testing Strategy

- Keep scene-builder unit tests as primary anti-regression gate.
- Add adapter-level tests per renderer:
  - callback firing semantics
  - selection/hover state mapping
  - drag commit timing
- Add end-to-end interaction checks for:
  - focus-on-node from panel
  - cross-slice selection/focus
  - edge editing handles

## Risks and Mitigations

- Risk: hidden coupling to current DOM class names.
  - Mitigation: keep classes in DOM adapter only; not in scene builder.
- Risk: geometry mismatches between renderers.
  - Mitigation: assert scene parity first, then renderer-specific path conversion.
- Risk: interaction regressions during drag.
  - Mitigation: preserve commit-on-end invariant and callback contract tests.
- Risk: performance regressions with large graphs.
  - Mitigation: memoized scene build + incremental shape updates in new engine.

## Definition of Done for Engine Swap Prep

- App depends on renderer contract + scene model only.
- Existing DOM/SVG renderer implemented as one adapter module.
- New renderer can be mounted with feature flag and no App-level branching explosion.
- Tests cover contract invariants and critical interactions for both adapters.

## Immediate Next Actions

1. Replace `experimentalRenderer` internals with true engine-specific rendering (tldraw/custom), while preserving callback semantics.
2. Add adapter-level parity tests for renderer behavior (selection/hover/drag commit/focus initialization).
3. Define and track a parity checklist (visual + interaction) between `dom-svg` and `experimental`.
4. Run side-by-side validation behind feature flag and close deltas before default switch.
