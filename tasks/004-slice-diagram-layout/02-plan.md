# Slice Diagram Layout Plan

## Summary

Replace the async slice diagram layout path with `layout-lib` while keeping project overview layout unchanged. The new slice layout flow should derive all slice-specific semantics inside `slicr`, convert the parsed slice diagram into a generic `layout-lib` request, and translate the library's output back into the existing `DiagramEngineLayout` shape that renderers already consume.

## Goals

- Use `layout-lib` as the async layout engine for slice diagrams.
- Keep slice layout semantics in `slicr`, including lane assignment, boundary interpretation, and node measurement projection.
- Represent slice boundaries (`---`) as ordered `layout-lib` groups.
- Render slice edges from the routed polylines returned by `layout-lib` instead of recomputing them in the app render path.
- Preserve existing slice renderer contracts so the migration stays centered in the layout pipeline.
- Accept small visual layout shifts as long as ordering, boundaries, and edge routing remain correct and stable.

## Non-Goals

- Do not change project overview layout or overview compaction behavior.
- Do not replace the provisional synchronous slice layout path in this feature.
- Do not redesign slice parsing, node measurement, or renderer visuals beyond what the new layout output requires.
- Do not push slice-specific semantics into `layout-lib`.

## Core Rules

- Only the async slice layout path changes in v1.
- `slicr` remains responsible for deriving semantic lanes from node types and event streams before calling `layout-lib`.
- `slicr` remains responsible for projecting measured node dimensions before layout.
- Every node in a slice diagram belongs to exactly one derived section group when any `---` boundary is present.
- Derived groups preserve slice source order from left to right.
- Nodes from later derived groups must not be placed left of earlier groups.
- Slight coordinate differences from the current ELK layout are acceptable if semantic ordering and group separation remain correct.
- Existing slice interactions and renderer contracts should continue to consume `DiagramEngineLayout` plus routed edge geometry without UI-specific rewrites.
- When async slice layout provides `precomputedEdges`, the slice render path must render those edge paths directly rather than replacing them with `routeElkEdges` output.

## Data Model

- Add a slice-to-layout adapter layer that converts `Parsed` slice diagrams into a `layout-lib` `LayoutRequest`.
- Derive `laneId` values from the existing slice semantic lane assignment rules now implemented in `buildElkLaneMeta`.
- Derive ordered `groups` from parsed slice boundaries:
  - nodes before the first `---` belong to group 0
  - each later boundary starts the next group
  - slices without boundaries may omit groups entirely or use a single implicit group, whichever keeps the adapter simplest
- Map measured node width and height from `nodeDimensions` into `layout-lib` node overrides.
- Convert `layout-lib` `NodeLayout`, `LaneLayout`, `GroupLayout`, and `EdgeLayout` results into:
  - `layout.pos`
  - `laneByKey`
  - `rowStreamLabels`
  - `precomputedEdges`

## Algorithm Or Derivation Steps

1. Start from the diagram-only slice `Parsed` structure already used by the async slice layout path.
2. Reuse the current semantic lane derivation rules to assign each node to a stable lane key and lane order.
3. Walk parsed boundaries in source order to assign each node to a derived section group.
4. Project measured node dimensions into per-node width and height overrides.
5. Build a `layout-lib` request containing:
   - one node per diagram node
   - one edge per diagram edge
   - caller-defined lanes with stable orders
   - caller-defined groups for `---` sections
   - default node sizes plus spacing defaults chosen to match current slice behavior as closely as practical
6. Run `layout-lib` from `computeDiagramLayout`.
7. Translate returned node positions into the existing `LayoutResult.pos` map.
8. Translate returned routed edge polylines into `DiagramEdgeGeometry` entries so renderers continue to consume precomputed edges.
9. Feed those translated `precomputedEdges` through the slice render path unchanged unless the user has explicitly overridden a given edge.
10. Preserve the existing `laneByKey` and `rowStreamLabels` contract so scene-model construction stays stable.

## Renderer Or Interaction Behavior

- Slice renderers should continue to receive positioned nodes and precomputed edge geometry through the current `DiagramEngineLayout` contract.
- The app-level slice render path should prefer engine-provided `precomputedEdges` over recomputed fallback routing so anchor-side decisions from `layout-lib` stay visible on screen.
- No renderer-specific overview behavior changes in this feature.
- Because slight layout shifts are acceptable, renderer updates should focus only on compatibility issues, not on preserving exact coordinates.

## Implementation Shape

- Keep the migration centered in the domain layout pipeline:
  - add a slice adapter that prepares `layout-lib` input from `Parsed`
  - update async `computeDiagramLayout` to call the adapter plus `layout-lib`
  - keep overview code paths untouched
- Reuse existing semantic helpers where possible instead of duplicating lane logic.
- Isolate `layout-lib` result translation behind a small adapter seam so later provisional-layout migration can reuse it if desired.
- Keep the old provisional layout path in place during this feature to limit blast radius.

## Test Plan

- Add focused adapter tests that prove:
  - semantic lane assignment becomes the expected ordered `layout-lib` lanes
  - `---` boundaries become ordered groups
  - measured node dimensions are forwarded
- Update async slice layout tests to prove:
  - slice diagrams still produce positions for representative chains, branches, and merges
  - nodes in later sections stay to the right of earlier `---` groups
  - event-stream lane behavior remains intact
  - routed edges are still available to renderers through `precomputedEdges`
- Add a render-path regression that proves a slice edge uses the `layout-lib`-provided polyline, not a recomputed fallback path with different anchor sides.
- Add at least one regression that covers a multi-section slice with cross-section edges so group ordering does not regress.
- Keep overview layout tests unchanged to prove scope isolation.

## Deferred Follow-Up

- Replacing the provisional synchronous slice layout path with `layout-lib` is deferred.
- Reusing `layout-lib` for project overview layout is deferred to a separate feature.
