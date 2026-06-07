# Separate Schema Editing From Example Value Editing

## Summary

Split the node editor sidebar in `apps/slicr-dcb/src/App.tsx` so schema editing and example-value editing are presented as two separate React UI components:

- `SchemaEditor`
- `ExampleValueEditor`

Both components should live in separate folders/files under `packages/react-ui/src/`, be reusable outside DCB, and preserve the existing `PropertyEditor` export for compatibility. To minimize duplication, the new components should be thin public wrappers over shared internals extracted from the current `packages/react-ui/src/PropertyEditor/PropertyEditor.tsx` implementation.

The DCB app should then introduce a `NodeEditor` container component that renders:

1. `SchemaEditor` on top
2. `ExampleValueEditor` below

`NodeEditor` owns translation between app/domain state and the UI component props.

## Why

- The sidebar has constrained horizontal space.
- Current user behavior does not match editing example values inline with schema definition.
- Schema and example editing should become distinct UX surfaces without losing existing property-tree editing behavior.
- A later follow-up should be able to link focus between the two editors by property id.

## Goals

- Create `SchemaEditor` and `ExampleValueEditor` as separate public React UI components in separate folders.
- Keep `PropertyEditor` available for compatibility.
- Reuse as much existing `PropertyEditor` behavior and markup as practical.
- Separate schema-editing affordances from example-value-editing affordances in the UX.
- Add a DCB `NodeEditor` container that coordinates both editors in the focused node sidebar.
- Keep the app usable and tests passing after each implementation step.
- Leave straightforward extension points for later focus-linking by property id.

## Non-goals

- Do not implement focus-linking between editors yet.
- Do not redesign the property editing data model beyond what is needed for the split.
- Do not remove `PropertyEditor`.
- Do not change unrelated graph/node editor behavior.

## Confirmed UX Rules

### SchemaEditor

- Shows schema editing UI only.
- Keeps current toolbar/settings behavior, including generated/list/optional controls.
- Keeps property add/remove/reorder behavior.
- Keeps nested schema editing.
- Removes all example-value editing affordances.

### ExampleValueEditor

- Depends on the schema shape.
- Uses the same general property-tree UI pattern as `PropertyEditor`.
- Property names are read-only.
- Types are not shown/edited.
- Toolbar/settings are not shown.
- Existing template-row behavior for adding example values stays.
- Existing `x` button behavior for removing example values stays.
- Complex properties can be expanded/navigated and users can edit leaf scalar example values.
- Arrays/lists support multiple items, matching current `PropertyEditor` behavior.

### Schema / example interactions

- Properties are identified by property id, so renames should preserve examples.
- Scalar examples are strings.
- When a property changes from scalar to complex, incompatible example values are removed.

## Proposed Architecture

### Public component structure

- `packages/react-ui/src/SchemaEditor/SchemaEditor.tsx`
- `packages/react-ui/src/SchemaEditor/index.ts`
- `packages/react-ui/src/ExampleValueEditor/ExampleValueEditor.tsx`
- `packages/react-ui/src/ExampleValueEditor/index.ts`
- `apps/slicr-dcb/src/components/NodeEditor.tsx`

### Shared internals

Keep duplication low by extracting shared behavior from `PropertyEditor` into internal building blocks inside `packages/react-ui/src/PropertyEditor/`, for example:

- shared row rendering helpers
- shared keyboard/focus/reorder logic
- mode-driven rendering flags or mode-specific adapters
- shared type definitions where still appropriate

`PropertyEditor` can remain as the compatibility component that uses the same internals in a combined mode.

### DCB container

`NodeEditor` should:

- receive the focused node property state from DCB
- render `SchemaEditor` above `ExampleValueEditor`
- translate between the app/domain property representation and any editor-specific props
- be the natural place for future cross-editor focus wiring

## Recommended Incremental Sequence

1. **Extract shared internals while preserving `PropertyEditor` behavior.**
   - No DCB UX change yet.
   - This de-risks later wrappers.
2. **Add `SchemaEditor` as a public wrapper using the shared internals.**
   - `PropertyEditor` still works unchanged.
3. **Add `ExampleValueEditor` as a public wrapper using the shared internals.**
   - Confirm schema-dependent example editing rules in tests.
4. **Add `NodeEditor` in DCB and replace the sidebar’s single `PropertyEditor` with `SchemaEditor` + `ExampleValueEditor`.**
   - Update app tests to reflect the new sidebar UX.
5. **Optionally migrate the mockup/demo area in `App.tsx` if it meaningfully benefits from the split.**
   - Only if it can be done without muddying the focused node sidebar task.

## Risks / Design Pressure

- `PropertyEditor` currently mixes schema logic, example-value logic, nested editing, and keyboard/drag interactions in one file.
- Over-extracting too early could increase complexity more than it reduces duplication.
- `ExampleValueEditor` must remain schema-driven rather than becoming a separate free-form data editor.
- Backward compatibility for `PropertyEditor` should be protected by tests before DCB switches to the new components.

## Validation Focus

At minimum, the implementation should preserve or add coverage for:

- `PropertyEditor` compatibility behavior
- `SchemaEditor` schema-only affordances
- `ExampleValueEditor` example-only affordances
- nested object/list behavior in both new components
- DCB sidebar rendering order and headings
- DCB property update flow through the new `NodeEditor`

## Task Breakdown

Implementation prompts live in:

- `./task-001/PROMPT.md`
- `./task-002/PROMPT.md`
- `./task-003/PROMPT.md`
- `./task-004/PROMPT.md`

Each task is intended to leave the repo in a usable state with all relevant tests passing.

## Current gap analysis

As of now, the split editor is still not visible in the DCB node sidebar.

Observed repo state:

- `apps/slicr-dcb/src/App.tsx` still imports `PropertyEditor` from `@slicr/react-ui`.
- The focused-node sidebar still renders a single `<PropertyEditor ... />`.
- There is no `apps/slicr-dcb/src/components/NodeEditor.tsx` file.
- `packages/react-ui` does contain public `SchemaEditor` and `ExampleValueEditor` exports.
- DCB tests do not currently appear to reference `SchemaEditor`, `ExampleValueEditor`, or `NodeEditor`.

Conclusion:

The reusable UI components were added, but the DCB integration step did not land, and the DCB test suite does not currently guard against that regression strongly enough.

That means the missing work is not another react-ui extraction step; it is the app-level integration and regression coverage in `apps/slicr-dcb`.