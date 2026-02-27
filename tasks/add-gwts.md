# Add Given/When/Then (GWT) Scenario Support

## Goal

Extend the slicr DSL, parser, and diagram rendering to support event-modeling scenarios written as `given/when/then` blocks under a `slice`.

## Confirmed Scope

- `scenario` blocks are valid only inside a `slice`.
- A slice can contain both existing top-level diagram declarations (nodes/edges/etc.) and one or more `scenario` blocks.
- `given` and `then` sections support multiple nodes.
- `when` supports exactly one node.
- Scenario nodes are not restricted to `evt`/`cmd`; they may use any existing artifact reference form:
  - `rm:...`, `ui:...`, `cmd:...`, `evt:...`, `exc:...`, `aut:...`, `ext:...`, or generic unprefixed node names.
- Scenario node `data:` uses the same data parsing behavior as existing node declarations.
- Rendering order for scenarios is source order, left-to-right.
- Scenario UI appears below the main slice diagram.
- Each scenario is visually bounded in a box.
- Each scenario box shows explicit section labels: `Given`, `When`, `Then`.
- If a slice has no scenarios, existing rendering remains unchanged (no extra scenario area).

## Target DSL Shape

```dsl
slice "My Slice"

scenario "Complete TODO Item"
given:
  evt:todo-added
    data:
      id: 42
      task: mark me as completed

when:
  cmd:complete-todo
  data:
    id: 42

then:
  evt:todo-completed
  data:
    id: 42
```

## Functional Requirements

1. Grammar
- Add syntax for:
  - `scenario "Name"`
  - `given:`
  - `when:`
  - `then:`
- Keep existing DSL grammar valid and backward compatible.
- Prevent top-level `scenario` outside `slice`.

2. Parsing
- Parse scenarios into structured model data attached to parsed slice output.
- Preserve scenario order from source.
- Parse each section into ordered entries:
  - `given`: array of nodes
  - `when`: single node (exactly one)
  - `then`: array of nodes
- Each scenario entry includes:
  - node type/name/key info equivalent to other parsed node refs
  - optional `data`
  - source range metadata as needed by editor/selection behavior
- Enforce/represent invalid scenario structures with clear parser output behavior (warnings/errors), especially:
  - missing `when`
  - multiple `when` entries
- Existing top-level node/edge parsing behavior must remain unchanged when scenarios are present.

3. Render Model
- Extend scene model/renderer contract to include scenario render data.
- Scenario render data must preserve source order.
- Scenario sections must be explicitly grouped as Given/When/Then in model output.

4. Rendering
- Render a scenario area below the existing diagram world.
- Render each scenario as a bounded box.
- Inside each box, render:
  - scenario title
  - `Given` section entries
  - `When` section entry
  - `Then` section entries
- Render multiple scenarios horizontally, in source order.
- Keep existing diagram interactions intact.

## Compatibility Requirements

- No regression in existing parser behavior for:
  - slice name parsing
  - node declarations
  - dependency edges
  - boundaries/streams/data/uses
- No rendering regressions for slices without scenarios.

## Workflow

Status tags:
- `[not started]`: Work for this step has not begun.
- `[in progress]`: Work for this step is currently underway.
- `[ignored]`: Work for this step is no longer relevant.
- `[completed]`: Work for this step is finished and verified.

Find the next step that is `[not started]` and start it (skip any `[ignored]` steps).
Update this file and set the status to `[in progress]`.
Implement the step using $ptdd.
After completing the step, update this file and set the status to `[completed]`.


## Steps

- `[completed]` Update grammar to support `scenario`, `given`, `when`, `then` under `slice` while preserving backward compatibility.
- `[not started]` Add parser support for scenarios with arbitrary node types in `given`/`when`/`then`.
- `[not started]` Enforce parser rule that `when` contains exactly one node and report invalid structures.
- `[not started]` Add parser support for optional `data:` on scenario nodes using existing data parsing behavior.
- `[not started]` Add regression coverage to ensure top-level node/edge parsing is unchanged when scenarios coexist.
- `[not started]` Extend domain types and parsed output shape to carry scenario structures and source order.
- `[not started]` Extend scene model/renderer contract to include grouped scenario render data (`Given`, `When`, `Then`).
- `[not started]` Render scenario boxes below the diagram with explicit section labels.
- `[not started]` Render multiple scenarios horizontally in source order.
- `[not started]` Confirm slices without scenarios render unchanged (no scenario area).
- `[not started]` Run full validation suite: lint, full tests, `npx tsc -b`, and production build.

## Out of Scope (for this task)

- Cross-slice GWT composition.
- New interaction behaviors beyond rendering and existing hover/select behavior.
- Changes to unrelated DSL features.
