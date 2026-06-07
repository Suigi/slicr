# Task 004: Introduce DCB NodeEditor and split the focused-node sidebar UX

Use the **pi-ptdd** skill for this task.

## Goal

Add a DCB `NodeEditor` container component that renders `SchemaEditor` above `ExampleValueEditor`, owns translation between DCB property state and editor props, and replaces the sidebar’s single `PropertyEditor` usage in `apps/slicr-dcb/src/App.tsx`.

## Scope

This task is the DCB integration step. Reuse the new public components from `@slicr/react-ui`. Keep the app usable and all relevant tests passing.

## Relevant files

- `apps/slicr-dcb/src/App.tsx`
- `apps/slicr-dcb/src/App.test.ts`
- `apps/slicr-dcb/src/App.importExport.integration.test.tsx`
- `apps/slicr-dcb/src/components/NodeEditor.tsx`
- Any new DCB tests needed for `NodeEditor`
- `packages/react-ui/src/index.ts` and new editor exports from prior tasks

## UX rules

- Focused node sidebar shows both editors at the same time.
- `SchemaEditor` appears on top.
- `ExampleValueEditor` appears below.
- This is an intentional UX split; do not preserve the old single-editor sidebar layout.
- Leave obvious extension points for later focus-linking by property id, but do not implement focus-linking now.

## Acceptance criteria

- The focused-node sidebar uses `NodeEditor` instead of rendering a single `PropertyEditor` directly.
- `SchemaEditor` renders above `ExampleValueEditor` in the sidebar.
- Editing schema and example values still updates the focused node property state correctly.
- Existing import/export property event flows covered by tests still pass.
- App tests are updated to assert the new split UX instead of the old combined editor.

## PTDD notes

- Start from DCB-facing tests that describe the new sidebar structure.
- Keep the integration thin: `NodeEditor` should mainly orchestrate/translate.
- Avoid refactoring unrelated parts of `App.tsx` unless needed to make the integration clear.

## Suggested validation commands

Use focused commands during PTDD, then finish with:

- `npm run test --workspace @slicr/react-ui`
- `npm run typecheck --workspace @slicr/react-ui`
- `npm run test --workspace slicr-dcb`
- `npm run typecheck --workspace slicr-dcb`

## Done when

The DCB sidebar presents separate schema and example editing components, the app remains usable, and the relevant UI and integration tests pass.