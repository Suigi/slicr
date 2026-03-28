# Overview Shared Node Layout Learnings

- Capture implementation learnings here during Phase 5.
- Review note: plans for overview compaction bugs should state the degenerate slice-width rule explicitly, because "tighten to visible content" is ambiguous when a slice loses its only visible node.
- If the feature workflow requires green repo validation between tasks, a red-first regression can be parked as `it.skip(...)` only when a separate follow-up task explicitly re-enables it after the implementation task lands.
- Overview shared-node compaction must operate on effective slice bounds, not raw node bounds: ignore the hidden adjacent target when a slice still has other visible nodes, but keep that target as the fallback width anchor when it is the slice's only remaining node.
- Scene-model regressions for overview shared-node behavior should derive positions and edge geometry from `computeOverviewDiagramLayout`, otherwise hand-authored coordinates can miss compaction-specific breakage.
- Overview dividers and slice frames must share the same compaction-aware shared-node mapping; if one still reads raw hidden-target positions, scenario groups drift and adjacent slice frames can overlap.
- Overview compaction cannot stop after slice-order and lane-gap legalization: same-lane adjustments can reopen successor-gap and boundary-floor violations, so the overview loop must rerun those base ELK legality passes too.
- Hidden shared-node boundary-anchor regressions should assert both local left-to-right node ordering and a capped visible inter-slice gap; otherwise a workaround can fix one symptom while making the slice drift bug worse.
- Overview boundary legality and divider rendering must reuse the same hidden-target-to-shared-source anchor map; if only one side remaps the anchor, slice spacing and presentation geometry diverge.
