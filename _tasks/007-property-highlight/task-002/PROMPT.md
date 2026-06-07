# Task 002: PropertyGrid can render highlighted properties

Use the `pi-ptdd` skill. Implement this task with Predictive Test-Driven Development. Assume task 001 is complete. Do not implement hover-driven synchronization yet; this task is display-only for `PropertyGrid` highlighting.

## Context

`PropertyGrid` is a React wrapper around a custom element:

- React wrapper: `packages/react-ui/src/PropertyGrid/PropertyGrid.tsx`
- Custom element: `packages/react-ui/src/property-grid/property-grid.js`
- Tests:
  - `packages/react-ui/src/PropertyGrid/PropertyGrid.test.tsx`
  - `packages/react-ui/src/property-grid/property-grid.test.ts`

The wrapper currently converts `EditableProperty[]` into `PropertyGridProperties` using `toPropertyGridProperties()`. The current normalized data is keyed by property name and does not preserve ids sufficiently for highlighting. The shared identity must be `EditableProperty.id`.

## Goal

Add support for passing a highlighted/focused property id to `PropertyGrid`, preserving ids through normalization and rendering a non-layout-affecting highlight inside the custom element.

## Required behavior

- Extend `PropertyGrid` React props with:
  - `focusedPropertyId?: string | null`
- Extend the `PropertyGridElement` custom element type with a `focusedPropertyId` property.
- The React wrapper should set `element.focusedPropertyId` whenever the prop changes.
- Preserve property ids in the normalized `PropertyGridProperties` model created by `toPropertyGridProperties()`.
- The custom element should re-render when `focusedPropertyId` changes.
- Highlight matching rendered content by property id:
  - Scalar property: highlight the row.
  - Object property: highlight the object header row when the object property id matches.
  - Nested object property: highlight the nested row when the nested property id matches.
  - Object-list/table nested property: highlight the matching column header and cells by nested property id. For example, if `field` is a nested property inside `columns: Object[]`, focusing `field.id` highlights the `field` column, not the parent `columns` row.
  - Primitive-list property: highlighting the parent property id should highlight the parent/list table row area.
- Highlight styling must not change layout dimensions.

## Acceptance criteria

- A test proves `toPropertyGridProperties()` preserves ids for scalar, object, and table-column properties.
- A custom-element or wrapper test proves passing `focusedPropertyId` highlights a scalar row.
- A test proves passing a nested object property id highlights only the nested row.
- A test proves passing an object-list child property id highlights the corresponding table column.
- Existing `PropertyGrid` tests continue to pass.

## Notes

- Do not add hover event behavior in this task.
- Prefer class names and shadow DOM styles such as background/inset box-shadow.
- Keep public API names aligned with task 001: `focusedPropertyId` means the currently highlighted property id, regardless of whether the source is actual focus or later hover.
