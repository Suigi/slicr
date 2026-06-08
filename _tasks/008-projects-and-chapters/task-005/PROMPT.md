# Task 005: Add chapter creation flow

Use the **pi-ptdd** skill for this task. Assume tasks 001 through 004 are complete.

## Goal

Let users create a new chapter in the active project from the chapter sidebar, backed by workspace events and the existing active project/chapter graph scoping.

At the end of this task:

- users can create a new chapter in the active project
- the newly created chapter is selected immediately
- the newly created chapter is usable for graph editing
- tests pass

## Scope

Implement chapter creation only.

Do **not** yet:

- add project creation UI
- add rename flows
- add node-moving-between-chapters UI

## Relevant files

- `apps/slicr-dcb/src/domain/events.ts`
- workspace command/projection files from earlier tasks
- `apps/slicr-dcb/src/App.tsx`
- `apps/slicr-dcb/src/components/ChapterSidebar.tsx`
- `apps/slicr-dcb/src/graph/useGraphModel.ts`
- `apps/slicr-dcb/src/App.test.ts`
- Related component/domain tests

## Required behavior

### Commands / domain behavior

Add command handling for:

- `AddChapter`

Implementation details may vary, but behavior must be explicit and testable.

### New chapter behavior

Creating a chapter should:

- add the chapter to the active project
- select it after creation
- show an empty graph until the user adds nodes

### UI behavior

Wire the chapter add button in `ChapterSidebar` with this UX:

- User clicks the `+` button.
- An input box appears at the bottom of the chapter list.
- The input contains the text `New Chapter`.
- The input is focused and its text is fully selected so the name is easy to replace.
- To the right of the input is a button with a green checkmark.
- Clicking the checkmark button issues the `AddChapter` command.
- Pressing `<Enter>` in the input issues the `AddChapter` command.
- Pressing `<Escape>` removes the input and does not issue a command.
- Blurring the input removes the input and does not issue a command.

## Acceptance criteria

- A test proves clicking the chapter `+` button shows the pre-selected `New Chapter` input.
- A test proves clicking the green checkmark creates a chapter under the active project and selects it.
- A test proves pressing `<Enter>` creates a chapter under the active project and selects it.
- A test proves pressing `<Escape>` cancels chapter creation without issuing `AddChapter`.
- A test proves blurring the input cancels chapter creation without issuing `AddChapter`.
- A test proves adding a node after switching to a newly created chapter records that node in the active chapter.
- Existing project/chapter switching behavior continues to work.

## PTDD notes

- Work in `apps/slicr-dcb`.
- Refresh `apps/slicr-dcb/test-list.md` for this task before the first iteration.
- Start with domain-level `AddChapter` behavior if the command/handler does not exist yet.
- Add only the smallest UI needed to make chapter creation operable and testable.

## Suggested validation commands

Use focused Vitest commands during PTDD, then finish with:

- `npm run test --workspace slicr-dcb`
- `npm run typecheck --workspace slicr-dcb`

## Done when

Users can create a chapter from the sidebar, it becomes the selected active chapter, and it is immediately usable for graph edits.
