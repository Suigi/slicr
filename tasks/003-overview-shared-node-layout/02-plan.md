# Overview Shared Node Layout Plan

## Summary
Fix the Project Overview adjacent shared-node presentation so it no longer reserves horizontal space for the hidden target node. When two directly adjacent slices are linked by a `shared-node` cross-slice connection, the overview should still render one visible representative at the source position, but the hidden target occurrence must no longer widen the slice spacing or leave an empty slot in the target slice.

## Goals
- Keep adjacent shared-node rendering visually continuous across neighboring slices.
- Remove the empty horizontal gap currently caused by the hidden target node still participating in overview layout width and slice spacing.
- Preserve existing source-node ownership for selection, hover, and edge rerouting.
- Keep non-adjacent dashed cross-slice connectors unchanged.

## Non-Goals
- No changes to single-slice diagrams.
- No changes to the logical-ref matching or link-derivation rules.
- No changes to non-adjacent dashed-connector layout or styling.
- No support in v1 for a node participating in multiple simultaneous adjacent shared-node presentations beyond the existing unsupported constraint.

## Core Rules
- A `shared-node` link between directly adjacent slices still represents two backing overview nodes and one visible shared representative.
- The shared representative remains anchored to the source overview node position.
- The adjacent target backing node remains hidden for rendering and interaction, but it must also stop consuming effective horizontal layout space.
- The target slice must keep its remaining visible nodes ordered after the shared representative and after any preceding nodes in that same slice.
- After compaction, the first remaining visible node in the target slice should move as far left as the existing layout constraints allow, behaving like the hidden target slot no longer reserves its own visible column.
- Removing the hidden target slot must not cause later slices to overlap earlier slices or break slice-frame ordering.
- Outgoing edges that originate from the hidden target node must continue to route from the shared representative position.
- If the target slice has no other visible nodes after hiding the adjacent target occurrence, the slice frame should still retain at least one node's minimum visible width rather than collapsing to zero visible width.
- Support multiple adjacent shared-node pairs in one overview as long as each slice-to-slice connection contributes at most one such pair and no single logical node participates in more than one adjacent shared-node presentation.

Example:

- Slice A ends with `evt:order-created`.
- Slice B begins with `evt:order-created`, then continues to `cmd:ship-order`.
- Overview should show one `evt:order-created` pill at Slice A's right edge, then place `cmd:ship-order` as the first visible node in Slice B without leaving a full hidden-node-width gap before it.

## Data Model
- Reuse the existing `OverviewCrossSliceLink` model and `renderMode: 'shared-node'` classification.
- Add a derived layout helper for adjacent shared-node pairs that can answer:
  - which overview node key is the shared source
  - which overview node key is the hidden adjacent target
  - which slice the hidden target belongs to
- Keep the existing overview parsed graph unchanged so scene-model hit testing and metadata mapping still reference the original namespaced nodes.

## Algorithm Or Derivation Steps
1. Build the merged overview graph and derive cross-slice links as today.
2. After ELK computes the overview node positions, derive the set of adjacent shared-node pairs from the overview cross-slice links.
3. Apply an overview-only post-layout compaction pass that treats each hidden adjacent target as a collapsed slot rather than a full-width visible node.
4. Shift the target slice's visible node positions left as far as allowed while preserving:
   - left-to-right order inside the slice
   - minimum inter-slice separation
   - minimum spacing between remaining visible nodes
   - scenario-group and slice-frame bounds
5. If a target slice would otherwise have no visible node width after compaction, clamp its slice-frame bounds to at least one node's minimum width.
6. Keep the hidden target node keyed in layout output so existing edge/source mapping still works, but place it so the shared representative and the hidden target no longer create two distinct visible columns.
7. Recompute overview bounds from the compacted positions so viewport fitting and slice frames match the visible result.

## Renderer Or Interaction Behavior
- Shared representative rendering in the scene model remains additive: one visible representative plus hidden backing nodes.
- The shared representative remains selectable and resolves interactions to the source node.
- The hidden target node remains hidden and should no longer leave a visible blank region in the canvas.
- Slice frames should tighten to the visible content after compaction so the target slice box does not imply a missing first node, but a target slice that would otherwise collapse must still keep a minimum width equal to one node's minimum width.
- Existing rerouted outgoing-edge behavior from hidden targets must continue to originate from the shared representative position.

## Implementation Shape
- Extend the overview layout pipeline in `src/domain/diagramEngine.ts` so `computeOverviewDiagramLayout` has access to derived overview cross-slice links during post-layout processing.
- Add a focused post-layout compaction helper in `src/domain/elkPostLayout.ts` or a nearby overview-layout helper module that can collapse adjacent shared-node target slots after the current slice-order and lane-gap passes.
- Keep the scene-model and renderer contract mostly unchanged; this bugfix should come from corrected layout positions rather than a renderer-only workaround.
- Update any slice-frame or viewport calculations that implicitly rely on the hidden target's pre-compaction width.

## Test Plan
- Overview layout test: an adjacent shared-node pair across two slices no longer leaves a full hidden-target-width gap before the next visible node in the target slice.
- Overview layout test: later slices still remain ordered to the right of earlier slices after shared-node compaction.
- Overview layout test: when the target slice has no remaining visible nodes, its slice frame still keeps at least one node's minimum width after compaction.
- Overview layout test: multiple independent adjacent shared-node pairs across different slice boundaries compact correctly in the same overview.
- Scene-model or renderer regression test: the shared representative remains at the source position and the hidden target remains hidden after the compacted layout is applied.
- Regression test: rerouted outgoing edges from the hidden target still originate from the shared representative position.
- Regression test: non-adjacent dashed connectors keep their current layout behavior.

## Deferred Follow-Up
- If compacting one hidden target exposes a need to compact chains of several adjacent shared-node pairs across many slices, that can be refined later as long as the single-pair and repeated-pair cases stay correct for current supported inputs.
- If hidden-target compaction creates new overlap pressure with unusually wide scenario groups, additional slice-frame-specific balancing can be handled in a separate follow-up.
