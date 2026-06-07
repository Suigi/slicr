# Task 005: Actually wire the split editors into the DCB node sidebar

Use the **pi-ptdd** skill for this task.

## Why this task exists

`packages/react-ui` now exposes `SchemaEditor` and `ExampleValueEditor`, but `apps/slicr-dcb/src/App.tsx` still renders a single `PropertyEditor` in the focused-node sidebar. There is also no `apps/slicr-dcb/src/components/NodeEditor.tsx` yet.

So the split editor UX has not actually been integrated into the app.

## Goal

Implement the missing DCB integration so the focused node sidebar shows:

1. `SchemaEditor` on top
2. `ExampleValueEditor` below

using a DCB `NodeEditor` container component that owns translation between DCB property state and the two editor components.

## Relevant files

- `apps/slicr-dcb/src/App.tsx`
- `apps/slicr-dcb/src/components/NodeEditor.tsx` (new)
- `apps/slicr-dcb/src/App.test.ts`
- `apps/slicr-dcb/src/App.importExport.integration.test.tsx`
- any new DCB test file needed for `NodeEditor`

## Required changes

- Stop rendering `PropertyEditor` directly in the focused-node sidebar.
- Add a `NodeEditor` component in `apps/slicr-dcb/src/components/`.
- Render `SchemaEditor` first and `ExampleValueEditor` second inside `NodeEditor`.
- Keep updates flowing through the existing DCB property state/update path.
- Preserve current node editor usability.
- Leave obvious extension points for future cross-editor focus linking by property id, but do not implement that linking now.

## Acceptance criteria

- `App.tsx` no longer renders a single sidebar `PropertyEditor` for focused node details.
- A focused node shows both editors at the same time.
- `SchemaEditor` appears above `ExampleValueEditor`.
- Editing schema still updates focused node properties correctly.
- Editing example values still updates focused node properties correctly.
- Existing import/export property event behavior remains working.
- All relevant DCB tests pass.

## Regression coverage required

Add or update DCB tests so they would fail if someone reverted the sidebar back to a single `PropertyEditor`.

At minimum, add assertions that verify:

- both editor sections are present
- schema editor renders before example value editor
- the old single-editor sidebar structure is gone

## PTDD notes

- Start from a failing DCB test that describes the split sidebar structure.
- Then add or adjust the smallest implementation needed.
- Keep the integration thin; prefer orchestration/translation over moving business logic into the UI.

## Suggested validation commands

Use focused commands during PTDD, then finish with:

- `npm run test --workspace slicr-dcb`
- `npm run typecheck --workspace slicr-dcb`
- `npm run test --workspace @slicr/react-ui`
- `npm run typecheck --workspace @slicr/react-ui`

## Done when

The split editor is visibly present in the DCB node sidebar, and the DCB test suite now protects that integration from regressing.