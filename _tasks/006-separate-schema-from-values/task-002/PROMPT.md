# Task 002: Add SchemaEditor as a public schema-only wrapper

Use the **pi-ptdd** skill for this task.

## Goal

Create a new reusable public React UI component named `SchemaEditor` under its own folder that reuses the shared PropertyEditor internals and exposes only schema-editing affordances.

## Scope

Add the new component and its tests. Keep `PropertyEditor` intact for compatibility. Do **not** switch DCB to the new component yet.

## Relevant files

- `packages/react-ui/src/SchemaEditor/SchemaEditor.tsx`
- `packages/react-ui/src/SchemaEditor/index.ts`
- `packages/react-ui/src/index.ts`
- `packages/react-ui/src/PropertyEditor/*`
- New tests near `SchemaEditor`

## UX rules

- Schema editing only.
- Keep toolbar/settings behavior, including generated/list/optional controls.
- Keep property add/remove/reorder behavior.
- Keep nested schema editing.
- Remove example-value editing affordances.

## Acceptance criteria

- `SchemaEditor` is exported publicly from `@slicr/react-ui`.
- It renders schema rows without editable example-value inputs.
- Toolbar/settings needed for schema editing remain available.
- Nested object schema editing still works.
- `PropertyEditor` compatibility tests continue to pass.

## PTDD notes

- Add focused tests that define the schema-only surface first.
- Reuse existing `PropertyEditor` tests/fixtures where that keeps the intent clear.
- Avoid changing DCB app behavior in this task.

## Suggested validation commands

Use focused commands during PTDD, then finish with:

- `npm run test --workspace @slicr/react-ui`
- `npm run typecheck --workspace @slicr/react-ui`

## Done when

Consumers can import `SchemaEditor` as a standalone component, and it clearly represents only schema editing.