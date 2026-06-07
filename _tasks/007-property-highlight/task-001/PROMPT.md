# Task 001: Editor focus synchronization

Use the `pi-ptdd` skill. Implement this task with Predictive Test-Driven Development. Do not combine this task with later `PropertyGrid` work.

## Context

The app displays focused node properties in `apps/slicr-dcb/src/components/NodeEditor.tsx` using two editors from `@slicr/react-ui`:

- `SchemaEditor`
- `ExampleValueEditor`

Both are wrappers around `PropertyEditorInternal` in `packages/react-ui/src/PropertyEditor/PropertyEditor.tsx`.

Relevant files:

- `apps/slicr-dcb/src/components/NodeEditor.tsx`
- `apps/slicr-dcb/src/components/NodeEditor.test.tsx`
- `packages/react-ui/src/SchemaEditor/SchemaEditor.tsx`
- `packages/react-ui/src/SchemaEditor/SchemaEditor.test.tsx`
- `packages/react-ui/src/ExampleValueEditor/ExampleValueEditor.tsx`
- `packages/react-ui/src/ExampleValueEditor/ExampleValueEditor.test.tsx`
- `packages/react-ui/src/PropertyEditor/PropertyEditor.tsx`
- `packages/react-ui/src/PropertyEditor/PropertyEditor.css`
- `packages/react-ui/src/PropertyEditor/PropertyEditor.test.tsx`

## Goal

Add focused-property support to the editor side only. When a property control is focused in one editor, that property's row is visually highlighted in both `SchemaEditor` and `ExampleValueEditor`.

Use `EditableProperty.id` as the shared identity.

## Required behavior

- Add props through the relevant editor APIs:
  - `focusedPropertyId?: string | null`
  - `onFocusedPropertyChange?: (propertyId: string | null) => void`
- `SchemaEditor` and `ExampleValueEditor` should pass these props through to `PropertyEditorInternal`.
- `NodeEditor` should accept these props and pass them to both editors.
- In `PropertyEditorInternal`, when focus enters a property row/control, call `onFocusedPropertyChange` with that row's `EditableProperty.id`.
- Rows whose property id equals `focusedPropertyId` should receive a highlight class.
- Nested object properties must work recursively and highlight only the exact nested property row. For example, focusing `street` highlights `street`, not parent `address`.
- Do not change `PropertyGrid` in this task.
- Styling must not affect layout dimensions. Prefer background/inset box-shadow/outline over borders or margins.

## Acceptance criteria

- A test proves focusing a schema editor property highlights the corresponding example value editor property.
- A test proves focusing an example value editor property highlights the corresponding schema editor property.
- A test proves nested property focus uses the nested property id exactly.
- Existing editor tests continue to pass.

## Notes

- Avoid clearing focused property immediately on blur; moving between editors should not cause highlight flicker.
- Use targeted edits where possible.
