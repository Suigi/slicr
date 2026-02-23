# Layout Rules and Constraints (Current Implementation)

This document describes the **actual** layout behavior implemented in this repository today.
It is intended as context for future LLM conversations and code changes.

## Scope

- Covers node placement and edge routing used by the diagram canvas.
- Covers both layout engines:
- `classic` (`src/domain/layoutGraph.ts`)
- `elk` (`src/domain/elkLayout.ts` + `src/domain/diagramRouting.ts`)
- Describes constraints, pass order, tie-breakers, and known tradeoffs.

## Terminology

- Node key: stable runtime key used in layout/routing (e.g. `book-room`, `ui:select-room`).
- Lane/row: horizontal band grouping by type/stream.
- Forward edge: edge where source topo-order is before target topo-order.
- Boundary: DSL `---` divider that enforces minimum x-floor for later nodes.
- Fan-out: multiple outgoing edges from one source.
- Fan-in: multiple incoming edges to one target.

## File Map

- Parser and graph construction: `src/domain/parseDsl.ts`
- Classic layout: `src/domain/layoutGraph.ts`
- ELK layout and post-passes: `src/domain/elkLayout.ts`, `src/domain/elkPostLayout.ts`
- ELK edge routing rules: `src/domain/diagramRouting.ts`
- Engine integration and rendered edge selection: `src/domain/diagramEngine.ts`
- UI rendering (rounded visual edge path): `src/App.tsx`

## Parsing Rules That Affect Layout

- Unresolved edge references are dropped from the concrete edge list.
- Layout only sees edges where both endpoints exist in `parsed.nodes`.
- Generic artifact references parse as node type `generic`.
- Node key generation is deterministic and may add type/suffix for collisions.

## Row/Lane Assignment

### Classic (`rowFor` in `layoutGraph.ts`)

- Lane 0: `ui`, `aut`, `ext`, `generic`
- Lane 1: all other non-event domain nodes (e.g. `rm`, `cmd`)
- Lane 2+: `evt` and `exc` (stream-based splitting)

### ELK (`buildElkLaneMeta` in `elkLayout.ts`)

- Lane 0: `ui`, `aut`, `ext`, `generic`
- Lane 1: all non-`evt`/non-`exc` nodes
- Lane 2+: events grouped by stream name
- Stream ordering rule: named streams before `default`
- `rowStreamLabels` records named stream labels for lane overlays

## Engine Overview

### Classic engine

- Uses deterministic column assignment and row placement.
- Enforces same-row occupancy and predecessor-rightward constraints.
- Applies boundary floors in column and x-space.
- Routes edges with legacy `edgePath` (curved/cubic style for classic engine only).

### ELK engine

- Uses ELK layered algorithm for initial node placement guidance.
- Then applies custom post-layout passes to enforce product-specific constraints.
- Uses fully custom orthogonal edge routing (`routeElkEdges`) for final edge geometry.

## ELK Node Placement Pipeline (Pass Order)

1. Build topo order with custom ready-node tie-breakers.
2. Build lane metadata and boundary specs.
3. Build ELK graph with options:
- layered, RIGHT direction, ORTHOGONAL routing
- partitioning enabled
- crossing minimization + forced model order
- fixed spacing options
4. Run ELK and map child coordinates into app coordinates.
5. Iterative legalization loop (`max(6, edges * 3)`):
- successor gap pass
- boundary floor pass
- same-lane gap pass
6. Flatten y per lane (all nodes in a lane share lane top y).
7. Short iterative density legalization loop (`4` passes):
- density gap pass
- successor gap pass
- boundary floor pass
- same-lane gap pass
8. Normalize left padding so minimum x starts at 50.
9. Route all edges with `routeElkEdges`.
10. Compute final canvas bounds including edge points.

## Topological Ordering Rules (ELK)

When multiple nodes are simultaneously ready (indegree 0), compare by:

1. Minimum DSL index of outgoing targets (smaller first).
2. If tied, minimum DSL index of incoming sources (smaller first).
3. If tied, node DSL declaration order.

Then queue is repeatedly re-sorted with the same comparator while consuming nodes.

## ELK Post-Layout Constraints (Nodes)

### Successor x-gap pass

- For forward edges only, enforce `target.x >= source.x + minSuccessorGap`.
- Current `minSuccessorGap = 40`.

### Lane gap pass

- Within each lane, sort by x and enforce non-overlap with minimum gap.
- Enforce `next.x >= prev.x + prev.w + minLaneGap`.
- Current `minLaneGap = 40`.

### Boundary floor pass

- For nodes declared after boundary anchor, enforce x-floor:
- `x >= anchor.x + anchor.w + 40 + PAD_X`

### Density gap pass

- For forward edges, enforce extra x-distance proportional to edge density.
- `requiredGap = 40 + max(0, density - 1) * 12`
- `density = max(outgoingCount(source), incomingCount(target))`

### Left normalization

- Shift all nodes left so left-most node x becomes exactly `50` (if needed).

## ELK Edge Routing Rules (`routeElkEdges`)

### Anchor slot assignment

- Source anchor x values:
- Must be on right half of source node (`center+8` to `right-8`)
- Centered near `sourceCenterX + 20`
- Fan-out edges sorted by target x, then target y
- Target anchor x values:
- Must be on left half of target node (`left+8` to `center-8`)
- Centered near `targetCenterX - 20`
- Fan-in edges sorted by source x, then source y

### Base polyline shape

- Same-row edges: right-side elbow path from source right border to target left border.
- Different-row edges: 4-point orthogonal polyline with one shared horizontal segment (`trackY`).
- Base `trackY` derived from vertical span and density bias.

### Ordering and grouping of vertical corridors

Vertical edges are grouped before track assignment using this priority:

1. Fan-in group if target has multiple incoming vertical edges.
2. Else fan-out group if source has multiple outgoing vertical edges.
3. Else fallback group by direction + rounded startY.

Within each group:

- Sort with `sharedSegmentComparator`:
- If same target and same direction, compare by horizontal span:
- Downward: shorter span first
- Upward: longer span first
- Then compare left x, then right x, then diagonal sum, then key
- Apply centered spacing offsets of `EDGE_EDGE_TRACK_SPACING`.
- Snap grouped tracks to grid:
- Downward groups use ceil-to-grid
- Upward groups use floor-to-grid

### Node-avoidance for horizontal segments

- For non-same-row edges, `trackY` can move if horizontal segment intersects other node boxes.
- Excludes source/target node from collision checks.
- Uses clearance padding (`EDGE_NODE_CLEARANCE = 6`).
- Candidate search explores up/down by spacing step.
- Preserves monotonic ordering within group by min-allowed y based on previous edge.

### Source-sibling normalization pass

After group-based placement:

- Regroup by direction + source + rounded startY.
- If group has multiple edges, enforce ordered, evenly spaced track levels from local minimum.
- Special upward adjustment is applied only when that source group also participates in a shared-target constraint.

### Same-row bend spacing

- Same-row edges in same bend group are ordered and spread by bend-x offsets.
- Offset step `SAME_ROW_BEND_SPACING = 12`.

## Rounded Corners in Rendering

- Geometry still stores orthogonal polylines in `geometry.points`.
- UI renders rounded corners using `routeRoundedPolyline(points, radius=10)`.
- This is a visual layer change in `App.tsx`; routing constraints are unchanged.

## Slice Divider Placement

- Slice boundaries come from DSL `---` markers (`parsed.boundaries` from `parseDsl`).
- Divider is rendered in `App.tsx` from final displayed node positions, not from a separate layout pass.
- For each boundary, use the anchor node (`boundary.after`) and place divider at:
- `dividerX = anchor.x + anchor.w + 40`
- This means divider sits at the center of the boundary gap.
- Boundary floor constraint for nodes declared after that boundary is:
- `node.x >= anchor.x + anchor.w + 40 + PAD_X`
- With current `PAD_X = 40`, this yields an 80px boundary gap:
- left half (40px) from anchor-right to divider
- right half (40px) from divider to minimum x of post-boundary nodes
- If post-layout passes move nodes (successor/lane/boundary/density/avoidance), divider follows automatically because it is derived from final `displayedPos`.
- There is currently no independent divider re-legalization pass; correctness depends on keeping divider formula consistent with boundary-floor formula.

## Manual Overrides

- ELK mode supports manual edge point overrides and node drag overrides.
- If an override exists and point count matches, overridden points are rendered instead of computed route.
- Manual overrides are not re-legalized by routing passes.

## Determinism Expectations

Given same DSL and runtime:

- Node keys, lane assignment, topo tie-breaking, and routing are deterministic.
- Test suite relies on deterministic geometry for many harness snapshots.

## Known Tradeoffs / Non-Goals

- This is a heuristic router, not a full global optimal crossing minimizer.
- Some constraints are local and sequential; improvements may shift other paths.
- Manual overrides can intentionally violate automatic collision constraints.
- ELK edge sections are not directly used for final rendering paths.

## Practical Guidance for Future Changes

- Prefer adding/adjusting a pass over replacing the whole pipeline.
- Keep pass order explicit and stable; small reordering changes can cause broad diffs.
- When changing tie-breakers, update or add harness tests for:
- fan-out to multiple targets
- fan-in to same target (upward and downward)
- node-avoidance with nearby unrelated edges
- boundary and stream-lane scenarios
- If changing constants, expect many geometry tests to shift.

## Current Key Constants (ELK path)

- Source anchor bias: `+20`
- Target anchor bias: `-20`
- Edge track spacing: `10`
- Edge-node clearance: `6`
- Same-row bend base offset: `20`
- Same-row bend spacing: `12`
- Successor gap: `40`
- Lane gap: `40`
- Density gap increment: `12` per extra attachment
- Left normalization target: `x = 50`

## Quick Debug Checklist

- Is the unexpected behavior in `classic` or `elk` mode?
- Are all expected edge endpoints resolved into `parsed.edges`?
- Is ordering caused by topo tie-breakers or lane grouping?
- Did fan-in/fan-out grouping choose the expected corridor key?
- Did node-avoidance move `trackY` due to true box intersection?
- Is the displayed path rounded visually while raw points remain orthogonal?
