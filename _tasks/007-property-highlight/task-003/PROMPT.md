# Task 003: PropertyGrid hover drives synchronized highlighting

Use the `pi-ptdd` skill. Implement this task with Predictive Test-Driven Development. Assume tasks 001 and 002 are complete.

## Context

The app displays the same focused node properties in three places:

- `SchemaEditor` via `apps/slicr-dcb/src/components/NodeEditor.tsx`
- `ExampleValueEditor` via `apps/slicr-dcb/src/components/NodeEditor.tsx`
- graph node `PropertyGrid` via `apps/slicr-dcb/src/components/GraphNodeView.tsx`

Relevant files:

- `apps/slicr-dcb/src/App.tsx`
- `apps/slicr-dcb/src/components/NodeEditor.tsx`
- `apps/slicr-dcb/src/components/GraphNodeView.tsx`
- `packages/react-ui/src/PropertyGrid/PropertyGrid.tsx`
- `packages/react-ui/src/property-grid/property-grid.js`
- Related tests for those components

Task 001 added editor focus APIs/highlighting. Task 002 added `PropertyGrid` display support for `focusedPropertyId`.

## Goal

Hovering a property in the focused node's `PropertyGrid` should transiently drive the highlighted property across the grid and both editors. When hover leaves the grid, the highlight should clear or revert to whichever property is focused in one of the editors.

## Required behavior

State model in `App.tsx` should conceptually separate editor focus from transient grid hover:

```ts
const [editorFocusedPropertyId, setEditorFocusedPropertyId] = useState<string | null>(null);
const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
const highlightedPropertyId = hoveredPropertyId ?? editorFocusedPropertyId;
```

Exact naming may vary, but behavior must match.

- Editors update the persistent editor-focused property id.
- Focused node `PropertyGrid` hover updates the transient hovered property id.
- Mouse leaving the focused node `PropertyGrid` clears only the transient hovered property id, reverting highlight to the editor-focused id if present.
- Only the currently focused graph node's `PropertyGrid` should report hover changes to app state.
- Hovering non-focused nodes must not update editor highlights.
- Clicking grid properties should not persist/select a property; hover only for now.
- Use exact property ids:
  - Nested object hover highlights only the nested property, not the parent.
  - Object-list table column hover highlights the nested column property id, not the parent list property.
  - Primitive-list value hover highlights the parent list property id.

## PropertyGrid API/event behavior

Add hover callbacks through the React wrapper and custom element as needed, for example:

```ts
onHoveredPropertyChange?: (propertyId: string | null) => void;
```

The custom element may dispatch composed custom events from shadow DOM, and the React wrapper may listen imperatively.

The implementation should support:

- `mouseenter`/`mouseover` or `pointerenter` on rows/cells to emit the relevant property id.
- `mouseleave` from the overall grid/panel to emit `null`.

## Acceptance criteria

- A test proves hovering a scalar property in focused node `PropertyGrid` highlights the corresponding property in both editors.
- A test proves leaving the grid reverts to the editor-focused property id when one exists.
- A test proves hovering a non-focused node's `PropertyGrid` does not update editor highlighting.
- A test proves hovering an object-list table column emits/highlights the nested column property id.
- Existing app and UI tests continue to pass.

## Notes

- If full `App.tsx` integration tests are heavy, add focused component tests around `GraphNodeView` and/or `PropertyGrid` plus the smallest app-level test needed for state precedence.
- Avoid changing layout dimensions with hover/highlight styles.
- Keep hover-only behavior; do not add click persistence.
