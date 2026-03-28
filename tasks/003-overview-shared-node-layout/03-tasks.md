# Overview Shared Node Layout Tasks

## Feature Description
Fix adjacent shared-node layout in Project Overview so hidden target nodes do not leave empty horizontal space, as described in [02-plan.md](tasks/003-overview-shared-node-layout/02-plan.md).

## Workflow

Tasks should move through these status values in order:

* `[created]`: the task was described, but no work was done to implement it
* `[started]`: an agent sets this status before starting to work on a task
* `[done]`: an agent sets this status once a task is completed

**IMPORTANT**: Only **ONE** (1) task should be in the `[started]` status at a time.
Agents must update this file as they work: set a task to `[started]` immediately before implementation begins, and set it to `[done]` as soon as that task is complete.

## Learnings

Add any learnings about the feature to [05-learnings.md](tasks/003-overview-shared-node-layout/05-learnings.md).
Add any learnings about the project overall to the documents in the `knowledge` directory.

## Task 1: Add failing overview-layout coverage for adjacent shared-node compaction
### Status
[done]

### Description
Add regression coverage around `computeOverviewDiagramLayout` for the adjacent shared-node case so the current empty-slot behavior is reproduced before implementation starts.

### Acceptance Criteria
* A layout-focused test reproduces an adjacent shared-node pair where the target slice currently reserves horizontal space for the hidden target node.
* The test asserts the intended compacted outcome in terms of visible node spacing, specifically that target-slice visible nodes move as far left as the existing spacing and ordering constraints allow.
* Existing non-adjacent overview layout behavior remains covered and unchanged.

### Dependencies
* None

### Notes
* Keep the test centered on observable node positions after overview layout.
* Use the existing overview link derivation rather than hand-waving around the shared-node classification.

## Task 2: Compact hidden adjacent target slots in overview post-layout
### Status
[done]

### Description
Update the overview layout pipeline so adjacent shared-node targets no longer consume effective horizontal spacing after ELK layout, while preserving slice ordering, lane spacing, and the source-anchored shared representative behavior.

### Acceptance Criteria
* For adjacent shared-node pairs, the hidden target node no longer leaves a full node-width gap before the next visible node in its slice.
* Target-slice visible nodes keep their internal left-to-right order after compaction.
* Later slices remain to the right of earlier slices and do not overlap after compaction.
* If compaction leaves a target slice with no remaining visible nodes, that slice still renders with a minimum visible width equal to one node's minimum width.
* Multiple independent adjacent shared-node pairs across different slice boundaries compact correctly in the same overview, provided each boundary contributes at most one pair.
* Overview bounds and slice-frame inputs reflect the compacted visible layout.

### Dependencies
* Task 1

### Notes
* Keep the fix in the overview layout/post-layout layer rather than a renderer-only offset hack.
* Preserve the hidden target node key in the internal model for downstream mapping and rerouting.

## Task 3: Verify scene-model and rerouted-edge behavior against compacted layout
### Status
[done]

### Description
Add or update scene-model regression coverage so the compacted layout continues to hide the backing target node, render the shared representative at the source position, and reroute outgoing edges cleanly from that shared position.

### Acceptance Criteria
* A regression test verifies the shared representative still resolves to the source position after layout compaction.
* A regression test verifies the hidden target remains hidden and does not reappear because of the layout change.
* A regression test verifies outgoing edges from the hidden target still route from the shared representative position.
* Regression coverage confirms the supported scope boundary: one adjacent shared-node pair per slice connection, while still allowing multiple such pairs across different slice boundaries in the same overview.

### Dependencies
* Task 2

### Notes
* Keep assertions on observable scene-model output and edge geometry.
* Do not expand scope into unrelated interaction behavior.

## Task 4: Add regression coverage and fix compaction-aware overview dividers and slice frames
### Status
[done]

### Description
Add a failing overview scene-model regression for the post-compaction presentation bug, then update overview presentation geometry so slice dividers, slice bounding boxes, and any frame-aligned scenario groups derive from the same compacted effective slice bounds rather than from hidden adjacent target positions.

### Acceptance Criteria
* A scene-model or renderer-facing regression test reproduces the current bug where a divider after a compacted shared-node boundary is misplaced and neighboring slice frames can overlap.
* Overview dividers are derived from compaction-aware effective slice geometry and no longer reserve a hidden-target-width offset after adjacent shared-node compaction.
* Overview slice frames exclude hidden adjacent target slots from their visible bounds while still preserving the minimum-width rule for slices whose only remaining node is hidden.
* Neighboring overview slice frames do not overlap after compaction and remain ordered left-to-right with the intended minimum separation.
* Scenario groups and slice labels stay aligned to the corrected slice frames after the geometry changes.
* Existing non-adjacent dashed-connector behavior and non-overview slice rendering remain unchanged.

### Dependencies
* Task 2

### Notes
* Prefer one shared helper for effective overview slice bounds so divider placement, slice frames, and any frame-aligned overlays cannot drift again.
* Keep the regression at the overview scene-model or renderer-contract layer where divider and frame geometry is observable, using real `computeOverviewDiagramLayout` output rather than hand-authored coordinates.
* Keep the hidden target node in the internal model for interaction/rerouting, but exclude it from visible-bound calculations unless it is the slice's only remaining width anchor.

## Task 5: Restore successor and boundary legality after overview shared-node compaction
### Status
[done]

### Description
Add a regression for overview layouts where adjacent shared-node compaction shifts a later slice left far enough that an internal forward edge in that slice violates the core x-ordering rules, then update the overview post-layout legalization loop so compaction-aware shifts still preserve successor-gap and boundary-floor constraints.

### Acceptance Criteria
* A regression test reproduces the `Reserve Book` overview case where `evt:book-reserved` is incorrectly placed left of its incoming source `cmd:reserve-book` after adjacent shared-node compaction.
* Overview post-layout preserves the documented forward-edge rule from `knowledge/layout-rules.md`: for forward edges, `target.x >= source.x + minSuccessorGap`.
* Overview post-layout also preserves boundary-floor legality for nodes declared after `---` dividers after any compaction-driven left shift.
* The fix is applied in the overview layout/post-layout legalization path rather than as a renderer-only workaround.
* Existing adjacent shared-node compaction behavior remains intact: hidden target slots still collapse, later slices remain ordered, and the target slice still compacts toward the shared representative when legal.

### Dependencies
* Task 4

### Notes
* Investigate `applyOverviewPostLayoutPasses` in `src/domain/elkPostLayout.ts`: it currently reapplies slice-order and lane-gap legalization after compaction, but not the successor-gap or boundary-floor rules that the base layout pipeline relies on.
* Prefer one legalization loop that reuses the same ordering rules documented in `knowledge/layout-rules.md` so overview-specific passes cannot drift from the main layout contract.

## Task 6: Add regression coverage for hidden shared-node boundary anchors in overview layout
### Status
[done]

### Description
Add failing overview-layout and/or scene-model regression coverage for the `Book Registration` -> `Reserve Book` case where the first boundary in the target slice is anchored to a hidden adjacent shared-node target, causing the visible right slice to drift too far right even though the slice frame ignores that hidden node for its displayed bounds.

### Acceptance Criteria
* A regression reproduces the `Reserve Book Form -> ReserveBook -> BookReserved` ordering requirement using relative horizontal assertions rather than absolute coordinates.
* The same regression also asserts a maximum allowed visible gap between the right-most visible node in the left slice and the left-most visible node in the right slice.
* The failure is driven by real `computeOverviewDiagramLayout` output for the adjacent shared-node case, not by hand-authored coordinates.
* Existing adjacent shared-node compaction expectations remain covered.

### Dependencies
* Task 5

### Notes
* Use the hidden shared-node target boundary in the target slice to demonstrate the current mismatch between legality anchors and visible slice geometry.
* Keep the assertions on effective visible nodes, not slice-frame padding constants.

## Task 7: Use compaction-aware effective boundary anchors across overview legality and presentation geometry
### Status
[done]

### Description
Replace raw hidden-target boundary anchoring in overview mode with one shared helper that resolves the effective visible anchor for adjacent shared-node boundaries, then reuse that helper anywhere overview layout or rendering derives boundary-driven geometry.

### Acceptance Criteria
* When a boundary anchor in overview mode points at a hidden adjacent shared-node target, the effective anchor resolves to the visible shared representative/source position instead of the hidden backing node.
* Overview boundary-floor legalization no longer pushes the visible target-slice nodes rightward off a hidden adjacent target.
* Overview divider placement, slice-frame bounds, and any other boundary-driven presentation geometry stay aligned with the same effective anchor mapping.
* The `Reserve Book` regression passes while preserving the existing compacted adjacent shared-node behavior and the minimum-width fallback for slices whose only remaining node is hidden.
* The fix lives in shared overview-layout/presentation helpers rather than in renderer-specific offsets or additional gap-tuning heuristics.

### Dependencies
* Task 6

### Notes
* Prefer one overview-only “effective boundary anchor” helper that can be used by both post-layout legalization and scene-model geometry.
* After the effective-anchor helper lands, remove or simplify any workaround logic that was added only to compensate for raw hidden-target boundary anchors.
