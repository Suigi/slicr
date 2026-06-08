# Task 006: Add project creation flow

Use the **pi-ptdd** skill for this task. Assume tasks 001 through 005 are complete.

## Goal

Let users create a new project from the project switcher, backed by workspace events and the existing active project/chapter graph scoping.

At the end of this task:

- users can create a new project
- the newly created project has a usable initial chapter
- the newly created project and its initial chapter are selected immediately
- tests pass

## Scope

Implement project creation only.

Do **not** yet:

- add chapter creation behavior beyond what task 005 already implemented
- add rename flows
- add node-moving-between-chapters UI

## Relevant files

- `apps/slicr-dcb/src/domain/events.ts`
- workspace command/projection files from earlier tasks
- `apps/slicr-dcb/src/App.tsx`
- `apps/slicr-dcb/src/components/ProjectSwitcher.tsx`
- `apps/slicr-dcb/src/components/ChapterSidebar.tsx`
- `apps/slicr-dcb/src/graph/useGraphModel.ts`
- `apps/slicr-dcb/src/App.test.ts`
- Related component/domain tests

## Required behavior

### Commands / domain behavior

Add command handling for:

- `AddProject`

Implementation details may vary, but behavior must be explicit and testable.

### New project behavior

Creating a project must leave the app in a usable state immediately.

Recommended behavior:

- create the project
- create a default first chapter for that project in the same action or flow
- select the new project and its initial chapter in the UI

### UI behavior

Add project creation to `ProjectSwitcher` with this UX:

- User opens the Project dropdown.
- The bottom entry says `Add new Project ...`.
- Clicking that entry opens a custom modal dialog.
- The modal title is `New Project`.
- The modal contains an input box with `My new project` pre-filled.
- The input text is focused and fully selected so the name is easy to replace.
- The modal has `Ok` and `Cancel` buttons.
- Clicking `Ok` issues the `AddProject` command.
- Pressing `<Enter>` in the input issues the `AddProject` command.
- Clicking `Cancel` closes the modal without issuing `AddProject`.

## Acceptance criteria

- A test proves the project dropdown contains a bottom entry labeled `Add new Project ...`.
- A test proves clicking `Add new Project ...` opens a `New Project` modal with pre-selected `My new project` input.
- A test proves clicking `Ok` creates a project and shows it in the switcher.
- A test proves pressing `<Enter>` creates a project and shows it in the switcher.
- A test proves creating a project also leaves it with a usable initial chapter.
- A test proves the newly created project and its initial chapter are selected.
- A test proves clicking `Cancel` closes the modal without issuing `AddProject`.
- Existing chapter creation and switching behavior continues to work.

## PTDD notes

- Work in `apps/slicr-dcb`.
- Refresh `apps/slicr-dcb/test-list.md` for this task before the first iteration.
- Start with domain-level `AddProject` behavior if the command/handler does not exist yet.
- Add only the smallest UI needed to make project creation operable and testable.

## Suggested validation commands

Use focused Vitest commands during PTDD, then finish with:

- `npm run test --workspace slicr-dcb`
- `npm run typecheck --workspace slicr-dcb`

## Done when

Users can create a project from the project switcher, the project has an initial chapter, and the new workspace is immediately usable without manual repair.
