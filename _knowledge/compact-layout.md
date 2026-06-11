# Compact Layout Rules

This document describes the current `layout-lib` compact layout behavior implemented in:

- `packages/layout-lib/src/layout/compactLayout.ts`
- acceptance snapshots in `packages/layout-lib/src/layout/compactLayout.acceptance.test.ts`

Use this as context for future LLM conversations about compact layout changes.

## Scope

`compactLayout` lays out lane-based diagrams with orthogonal edges. It is separate from the frontend ELK layout path documented elsewhere.

Inputs:

- `nodes`: id, lane id, optional width/height, optional group id
- `edges`: source id, target id, optional `role: "flow" | "back-reference"`
- `lanes`: id, numeric order
- `groups`: optional ordered groups
- `defaults`: default node width/height
- `spacing`: optional lane/node/group spacing knobs

## Validation

- Lane orders must be unique.
- All nodes must reference existing lanes.
- If groups are provided, nodes must have valid group assignments.
- All edges must reference existing nodes.
- Dependency edges exclude `role: "back-reference"`.
- Dependency graph cycles fail layout; cycles are only supported via back-reference edges.

## Core constants

Current key constants in `compactLayout.ts`:

- `EDGE_STUB = 20`
- `COLUMN_GAP = EDGE_STUB * 2 = 40`
- `VERTICAL_SOURCE_BIAS = 10`
- `VERTICAL_TARGET_BIAS = -10`
- `VERTICAL_ANCHOR_SPACING = 10`
- `HORIZONTAL_ANCHOR_SPACING = 10`
- `UPWARD_REROUTE_ENTRY_OFFSET = 2`
- `UPWARD_REROUTE_SPACING = 10`

## Lane placement

Lanes are sorted by `lane.order`.

For each lane:

- Lane content height is the maximum of default node height and all node heights in that lane.
- Lane height is `contentHeight + laneMargin * 2`.
- Default `laneMargin = 24`, default `laneGap = 44`.
- If `laneMargin === 0`, first lane top starts at `0`; otherwise first lane top starts at `-laneMargin`.
- Node y is `lane.top + laneMargin`.

## Node width/height

- Node width = `node.width ?? defaults.nodeWidth`.
- Node height = `node.height ?? defaults.nodeHeight`.

## Node x placement

Compact layout computes x positions from dependency flow and then legalizes spacing.

Important current behavior:

- Back-reference edges do not participate in dependency topological ordering.
- Non-back-reference predecessors constrain target x.
- Same-lane nodes are ordered by topological order and then adjusted by barycenter-like lane reordering.
- Nodes in the same lane are legalized left-to-right with compact node gap.
- Group footprints, when present, can push grouped nodes right.

Current node spacing inputs:

- `minTargetShift = spacing.minTargetShift ?? 20`
- `minNodeGap = spacing.minNodeGap ?? 40`
- `groupGap = spacing.groupGap ?? 80`
- `columnStep = minTargetShift + minNodeGap + COLUMN_GAP`
- compact same-lane node gap is `max(0, minNodeGap - EDGE_STUB / 2)`

## Edge orientation

Orientation is based only on lane order:

- Same lane: `side`
- Target lane order greater than source lane order: `down`
- Target lane order less than source lane order: `up`

Side assignment:

- `side`: source `right`, target `left`
- `down`: source `bottom`, target `top`
- `up`: source `top`, target `bottom`

## Anchor creation

### Top/bottom anchors

Normal flow top/bottom anchors:

- source x = node center x + `VERTICAL_SOURCE_BIAS` + ordinal * `VERTICAL_ANCHOR_SPACING`
- target x = node center x + `VERTICAL_TARGET_BIAS` + ordinal * `VERTICAL_ANCHOR_SPACING`
- y is top or bottom edge of node

Back-reference top/bottom anchors use swapped semantic biases:

- source bias = `VERTICAL_TARGET_BIAS - VERTICAL_ANCHOR_SPACING`
- target bias = `VERTICAL_SOURCE_BIAS`

This gives back-reference vertical anchors separate lanes from regular flow anchors.

### Left/right anchors

Side anchors are on the node border:

- left x = node.x
- right x = node.x + node.width
- y = `node.y + compactSideAnchorOffset(node.height)`

`compactSideAnchorOffset(height)` is:

- `height / 2 - 4 + max(0, height - 48) * (7 / 22)`

## Anchor bucket rules

Anchor buckets are used to assign ordinals and counts.

Current rule:

- For vertical source/target ordinal buckets, flow and back-reference edges are separated.
- For source-side counts, vertical flow and back-reference edges are **not** separated, so source spacing still accounts for all vertical edges on that side.

This prevents back-reference target anchors from pushing normal incoming flow anchors on the same target side, while keeping source-side routing aware of total edge density.

## Anchor ordering

For a bucket of edges on the same node side, edges are sorted before assigning ordinals.

General ordering:

- Compare opposite endpoint position along the relevant axis.
- For top/bottom sides, opposite position is opposite node center x.
- For left/right sides, opposite position is opposite node center y.
- Ties use original request edge order.

Special cases:

- Source bottom fan-out to different target lanes sorts by target lane order descending.
- Upward target-bottom fan-in normally orders by source x.
- For multiple back-reference upward edges into the same bottom target, source order is left-to-right to avoid crossing.
- For non-back-reference upward fan-in, target slots are arranged visually so left/right sources pair with left/right target slots.

## Target anchor base adjustment for upward edges

For upward edges, non-back-reference target top/bottom anchors are shifted by semantic/request slot:

- target top/bottom x is adjusted left by semantic ordinal and request slot.

Back-reference vertical target anchors are not adjusted by `resolveTargetAnchorBase`; they keep their back-reference anchor lane.

After target anchor base is resolved, `adjustCompactTargetAnchor` can apply a source ordinal offset for top-to-bottom routes when the source node is short.

## Edge path shapes

### Side edges

Same-lane side edges route as four points:

1. source anchor
2. source stub offset from source side by `EDGE_STUB`
3. target approach aligned to target side
4. target anchor

### Downward edges

Downward edges normally route as:

1. source bottom anchor
2. vertical to `downRowY`
3. horizontal to target x at `downRowY`
4. vertical to target top anchor

If no special down row is assigned, routing falls back through generic orthogonal routing using source stub and target approach.

### Upward top-to-bottom edges

Upward edges from source top to target bottom route as:

1. source top anchor
2. vertical to `upRowY`
3. horizontal to target x at `upRowY`
4. vertical to target bottom anchor

### Upward detour edges

Some upward edges detour around obstacles. Detour path shape:

1. source anchor
2. detour source stub slightly above source stub (`UPWARD_REROUTE_ENTRY_OFFSET`)
3. vertical to detour row
4. horizontal to target approach x at detour row
5. vertical to target y
6. target anchor

## Source stub distance

General source stub distance is `EDGE_STUB`.

For bottom source anchors with multiple edges on the same source side:

- distance = `EDGE_STUB + (sourceSideCount - 1 - sourceAnchor.ordinal) * 10`

For compact top source anchors:

- base distance = `EDGE_STUB + min(30, max(0, sourceHeight - 56))`
- if multiple source-side edges: add `(sourceSideCount - sourceAnchor.ordinal) * 10`

This caps tall-node upward first-bend expansion at 50px for normal single top edges.

## Top-row alignment by source height

`alignTallCompactTopRow(rowY, sourceHeight)` currently behaves as:

- sourceHeight <= 48: return raw rowY
- sourceHeight <= 56: floor to 10px grid
- sourceHeight <= 86: return raw rowY
- sourceHeight > 86: round to 10px grid

This preserves older 48px/86px snapshots while aligning near-default/tall cases.

## Upward row assignment

Non-back-reference upward top-to-bottom edges get a compact upward row assignment pass.

Base row:

- If source x equals target x: `max(90, targetAnchor.y + EDGE_STUB + (sourceSideCount - 1) * EDGE_STUB)`
- Otherwise: source top y minus compact top stub distance, then height-based alignment.

Row deconfliction:

- Assigned upward rows reserve horizontal ranges.
- If a new upward row conflicts with an existing upward row within `UPWARD_REROUTE_SPACING` and overlapping x-range, the new row moves upward by `UPWARD_REROUTE_SPACING` until clear.

Back-reference upward rows are handled separately by `resolveUpwardBackReferenceRows` and later plan logic.

## Back-reference upward rows

Back-reference upward rows are designed to avoid crossings and share sensible vertical anchor lanes with flow edges.

Important behavior:

- Back-reference target-bottom anchors use a separate anchor lane from regular flow target-bottom anchors.
- Multiple back-reference fan-in edges into one target are sorted by source x to avoid crossing.
- When multiple back-reference candidates share a target that also has a flow upward edge, rows are assigned in 10px lanes.
- For short source nodes with a nonzero target request slot, fallback back-reference `upRowY` is:
  - `sourceAnchor.y - compactTopStubDistance - targetRequestSlot * 10`
- For taller source nodes with a nonzero target request slot, fallback row may be derived from target bottom plus stub and slot spacing.

## Downward row assignment

Downward candidates are sorted primarily by base row descending, then request edge order.

Base row resolution:

- Start at source stub y.
- If horizontal or target-vertical segment intersects node obstacles, move below the lowest obstacle bottom plus `UPWARD_REROUTE_SPACING`.
- Obstacle-pushed rows are snapped up to the 10px routing grid.

When multiple downward edges target the same node side:

- Base row may be snapped up to grid.
- Ordinal offsets space target fan-in rows by 10px.

Downward row collision checks avoid:

- same/near horizontal rows with overlapping x-ranges
- a target vertical crossing an assigned horizontal track
- a candidate horizontal track crossing an assigned target vertical

## Compact downward row preferences

`resolveCompactDownwardRowY` adjusts downward rows after obstacle base-row computation.

Current intent:

- Keep vertically aligned downward edges simple.
- Keep clean source-stub downward rows when possible.
- For obstacle-pushed down edges into nodes that emit terminal back-reference edges, use a modest grid-snapped push.
- For obstacle-pushed down edges into nodes that emit upward edges to shared fan-in targets, prefer the lower inter-lane band.
- If the preferred lower row conflicts with a back-reference row, fall back to the base row.

Current lower inter-lane band helper:

- `getCompactInterLaneTrackDistance() = EDGE_STUB + 30 = 50`
- Preferred lower row uses approximately `targetAnchor.y - 50`, snapped to grid.

## Mixed terminal fan-in anchor pushing

Some layouts have terminal read-model-like fan-in where a target receives both:

- an upward flow edge
- an upward back-reference edge

and the target has no outgoing edges.

For those terminal mixed upward fan-in targets:

- Upward anchors are pushed into a clearer right-side fan-in corridor.
- Target bottom x becomes `target center x + EDGE_STUB + slot * 10`.
- Source top x becomes source center x + `VERTICAL_SOURCE_BIAS`.
- Back-reference/flow pair rows use upper fan-in rows rather than collapsing into narrow direct rows.

For down edges into nodes that emit such terminal back-reference edges:

- Target top anchor may be pushed left to widen horizontal clearance between down and up vertical segments.

This is deliberately scoped to terminal mixed fan-in cases to avoid shifting ordinary flow chains.

## Horizontal lane spacing rules

General rule:

- Avoid leaving nearly parallel up/down horizontal lanes only a few pixels apart.
- Prefer 10px grid lanes.
- If an obstacle-pushed downward row would land close to an upward fan-in row, snap/coalesce to the grid or use the lower inter-lane band depending on context.

Known accepted pattern:

- If a downward fan-out horizontal segment and an upward fan-in horizontal segment meet on the same y but their x-ranges are separated by a clear horizontal gap, sharing the row is acceptable.
- Same-direction overlapping horizontal ranges should be separated by at least `UPWARD_REROUTE_SPACING`.

## Role output behavior

`role: "back-reference"` is preserved on output edges when the back-reference target does not also have normal incoming flow edges.

When a target also has normal incoming flow, some snapshots expect role omission for those back-reference edges. This is a current implementation/detail expectation and should be revisited if consumers need role preservation consistently.

## Determinism

Compact layout is deterministic for a fixed request:

- input order is used as a final tie-breaker
- sorting and row assignment are deterministic
- acceptance tests assert exact node, lane, anchor, and point coordinates

## Known tradeoffs

- The router is heuristic, not globally optimal.
- Some rules are pattern-scoped because broad anchor pushing or lower-row selection caused undesirable shifts in older accepted layouts.
- Back-reference behavior is intentionally special-cased.
- Downward/upward crossings are allowed when unavoidable, but horizontal lanes should avoid visually ambiguous near-parallel spacing.
- Anchor pushing is preferred before node pushing for local clearance issues.

## Practical guidance for future changes

When changing compact layout, check affected cases in `compactLayout.acceptance.test.ts` around:

- simple lane chains
- source anchor placement for down edges
- security settings graph
- allowed edge crossings
- back-reference cycles
- top-lane source compaction
- upward back-reference sharing lanes with downward flow
- multiple back-reference fan-in ordering
- tall node upward bends
- command -> events -> read-models fan-out/fan-in
- mixed terminal fan-in with anchor pushing
- multi fan-in combined with multi fan-out

Prefer adding a narrowly named helper/pass when encoding a visual rule. Broad changes to anchor ordering or down-row selection tend to affect many snapshots.
