# Task 001: Extract shared PropertyEditor internals without changing behavior

Use the **pi-ptdd** skill for this task.

## Goal

Refactor `packages/react-ui/src/PropertyEditor/PropertyEditor.tsx` so its shared UI logic can be reused by future `SchemaEditor` and `ExampleValueEditor` components, while keeping the public `PropertyEditor` behavior and API unchanged.

## Scope

Work only on the internal architecture needed to support later wrappers. Do **not** add `SchemaEditor`, `ExampleValueEditor`, or DCB `NodeEditor` yet.

## Relevant files

- `packages/react-ui/src/PropertyEditor/PropertyEditor.tsx`
- `packages/react-ui/src/PropertyEditor/PropertyEditor.test.tsx`
- `packages/react-ui/src/PropertyEditor/PropertyEditor.browser.test.tsx`
- `packages/react-ui/src/PropertyEditor/index.ts`
- `packages/react-ui/src/index.ts`

## Requirements

- Preserve the existing `PropertyEditor` export and current behavior.
- Extract shared internals in a way that later mode-specific wrappers can reuse them.
- Keep duplication low, but avoid premature abstraction.
- Keep keyboard/focus/drag behavior working.
- Keep all current tests passing.

## Acceptance criteria

- `PropertyEditor` public API remains compatible.
- Existing `PropertyEditor` unit tests still pass.
- Existing `PropertyEditor` browser tests still pass.
- The extracted internal structure obviously supports later schema-only and example-only wrappers.

## PTDD notes

- Start with tests that protect current behavior before larger refactors.
- Prefer focused test runs while iterating.
- Do not broaden into new UX yet.

## Suggested validation commands

Use focused commands during PTDD, then finish with:

- `npm run test --workspace @slicr/react-ui`
- `npm run typecheck --workspace @slicr/react-ui`

## Done when

The repo still behaves the same from the outside, but the code is prepared for thin wrapper components in later tasks.