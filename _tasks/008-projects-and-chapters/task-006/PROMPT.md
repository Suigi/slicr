# Task 006: Add project and chapter rename flows

Use the **pi-ptdd** skill for this task. Assume tasks 001 through 005 are complete.

## Goal

Let users rename projects and chapters from the UI, backed by workspace rename events.

At the end of this task:

- active and non-active projects can show updated names after rename
- active chapters show updated titles after rename
- event-sourced workspace projections remain the source of truth
- all tests pass

## Scope

Implement rename behavior only.

Do **not** broaden into chapter reordering, deletion, or node-moving UI.

## Relevant files

- `apps/slicr-dcb/src/domain/events.ts`
- workspace command/projection files from earlier tasks
- `apps/slicr-dcb/src/App.tsx`
- `apps/slicr-dcb/src/components/ProjectSwitcher.tsx`
- `apps/slicr-dcb/src/components/ChapterSidebar.tsx`
- `apps/slicr-dcb/src/App.test.ts`
- Related component/domain tests

## Required behavior

### Commands / domain behavior

Add command handling for:

- `RenameProject`
- `RenameChapter`

### UI behavior

Add straightforward rename affordances for the active project and active chapter.

The exact interaction may be inline editing, a small edit button, or another simple approach, but it must be:

- keyboard-testable
- deterministic in tests
- consistent with current app simplicity

### Projection behavior

Workspace projections must reflect the latest rename events and update visible labels in:

- `ProjectSwitcher`
- `ChapterSidebar`
- collapsed sidebar label / any active-chapter title display

## Acceptance criteria

- A test proves renaming a project updates the project switcher label.
- A test proves renaming a chapter updates the chapter sidebar and collapsed active chapter label.
- A test proves switching away and back still shows the renamed values from event-sourced state.
- Existing create/switch graph behavior continues to work.

## PTDD notes

- Work in `apps/slicr-dcb`.
- Refresh `apps/slicr-dcb/test-list.md` for this task before the first iteration.
- Protect projector behavior with focused tests before UI changes.
- Keep the rename UX minimal and avoid adding broad editing infrastructure.

## Suggested validation commands

Use focused Vitest commands during PTDD, then finish with:

- `npm run test --workspace slicr-dcb`
- `npm run typecheck --workspace slicr-dcb`

## Done when

Project and chapter names are editable through the app and persist entirely through the event stream.