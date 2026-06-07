# Task 003: Add ExampleValueEditor as a public schema-driven value wrapper

Use the **pi-ptdd** skill for this task.

## Goal

Create a new reusable public React UI component named `ExampleValueEditor` under its own folder that reuses the shared PropertyEditor internals and exposes only example-value editing affordances for an existing schema.

## Scope

Add the new component and its tests. Keep `PropertyEditor` intact. Do **not** switch DCB to the new component yet.

## Relevant files

- `packages/react-ui/src/ExampleValueEditor/ExampleValueEditor.tsx`
- `packages/react-ui/src/ExampleValueEditor/index.ts`
- `packages/react-ui/src/index.ts`
- `packages/react-ui/src/PropertyEditor/*`
- New tests near `ExampleValueEditor`

## UX rules

- Depends on the schema shape.
- Same general property-tree UI pattern as `PropertyEditor`.
- Property names are read-only.
- Types are not shown or edited.
- Toolbar/settings are not shown.
- Template-row behavior for adding example values stays.
- `x` button behavior for removing example values stays.
- Complex properties can be navigated and users can edit leaf scalar example values.
- Lists support multiple items, matching current `PropertyEditor` behavior.

## Data rules

- Properties are identified by property id, so renames should preserve examples.
- Scalar example values are strings.
- When a property changes from scalar to complex, incompatible example values are removed.

## Acceptance criteria

- `ExampleValueEditor` is exported publicly from `@slicr/react-ui`.
- It renders value-editing UI without schema-editing controls.
- Property names are visible but not editable.
- Nested object/list example editing works for leaf scalar values.
- `PropertyEditor` compatibility tests continue to pass.

## PTDD notes

- Define the value-only behavior in focused tests first.
- Add tests for at least one scalar case and one nested complex/list case.
- Keep this component schema-driven rather than free-form.

## Suggested validation commands

Use focused commands during PTDD, then finish with:

- `npm run test --workspace @slicr/react-ui`
- `npm run typecheck --workspace @slicr/react-ui`

## Done when

Consumers can import `ExampleValueEditor` as a standalone component, and it clearly represents only schema-driven example-value editing.