# Property highlight synchronization

## Goal

Synchronize visual property highlighting across the three views that display the same focused node properties:

- Schema editor: `SchemaEditor` via `NodeEditor`
- Example value editor: `ExampleValueEditor` via `NodeEditor`
- Graph node preview: `PropertyGrid` via `GraphNodeView`

When a property is focused in either editor, the same property should be highlighted in the other editor and in the focused node's property grid. When a property is hovered in the focused node's `PropertyGrid`, that property should be highlighted in both editors and in the grid. Hover is transient: when the mouse leaves the grid, the highlight should clear or revert to the property currently focused in one of the editors.

## Decisions

- Use `EditableProperty.id` as the shared property identity.
- Editor focus drives persistent/editor highlight state.
- `PropertyGrid` hover drives transient highlight state.
- Hover is hover-only for now; clicking grid properties should not persist/select a property.
- Only the currently focused graph node's `PropertyGrid` participates in hover synchronization.
- Nested object highlighting is exact only: hovering/focusing `street` highlights `street`, not the parent `address`.
- Object-list/table highlighting uses nested property ids: hovering a `field` column highlights `field`, not the parent list property.
- Primitive-list values highlight the parent list property.
- Highlight styling should avoid layout changes; prefer background/outline/inset shadow over borders/margins.

## Proposed state model

In `apps/slicr-dcb/src/App.tsx`, keep separate persistent editor focus and transient grid hover state:

```ts
const [editorFocusedPropertyId, setEditorFocusedPropertyId] = useState<string | null>(null);
const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
const highlightedPropertyId = hoveredPropertyId ?? editorFocusedPropertyId;
```

Use `highlightedPropertyId` as the visual highlight id passed to all views. Editors update `editorFocusedPropertyId`; the focused node's `PropertyGrid` updates and clears `hoveredPropertyId` on hover/mouse leave.

Clear stale ids when appropriate, especially when the focused node changes or a highlighted property is deleted.

## Implementation breakdown

### Task 001: Editor focus synchronization

Add focused-property APIs and visual highlighting for `SchemaEditor` and `ExampleValueEditor` through `PropertyEditorInternal` and `NodeEditor`.

Acceptance:

- Focusing a property control in `SchemaEditor` highlights the same property row in `ExampleValueEditor`.
- Focusing a property control in `ExampleValueEditor` highlights the same property row in `SchemaEditor`.
- Nested properties use their own ids and highlight exactly their own rows.
- No `PropertyGrid` changes are required in this task.

### Task 002: PropertyGrid can render highlighted properties

Preserve property ids through the React `PropertyGrid` wrapper and custom element rendering, and add a `focusedPropertyId`/highlight prop.

Acceptance:

- Passing `focusedPropertyId` to `PropertyGrid` highlights the matching scalar/object row.
- Nested object rows highlight by nested property id.
- Object-list/table columns highlight by nested property id.
- Primitive-list properties highlight the parent row/table.
- Highlight styling does not affect layout dimensions.

### Task 003: PropertyGrid hover drives synchronized highlighting

Wire hover events from the focused node's `PropertyGrid` into app state and synchronize the transient hover highlight with both editors.

Acceptance:

- Hovering a property in the focused node's `PropertyGrid` highlights that property in the grid, `SchemaEditor`, and `ExampleValueEditor`.
- Leaving the grid clears the hover highlight and reverts to the editor-focused property if one exists.
- Hovering properties in non-focused nodes does not update editor highlights.
- Clicking grid properties does not persist property selection.
