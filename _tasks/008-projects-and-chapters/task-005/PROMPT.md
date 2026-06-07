# Task 005: Add project and chapter creation flows

Use the **pi-ptdd** skill for this task. Assume tasks 001 through 004 are complete.

## Goal

Let users create projects and chapters from the UI, backed by workspace events and the existing active project/chapter graph scoping.

At the end of this task:

- users can create a new project
- users can create a new chapter in the active project
- newly created workspaces are immediately usable
- tests pass

## Scope

Implement creation only.

Do **not** yet:

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
- `AddChapter`

Implementation details may vary, but behavior must be explicit and testable.

### New project behavior

Creating a project must leave the app in a usable state immediately.

Recommended behavior:

- create the project
- create a default first chapter for that project in the same action or flow
- select the new project and its initial chapter in the UI

### New chapter behavior

Creating a chapter should:

- add the chapter to the active project
- select it after creation
- show an empty graph until the user adds nodes

### UI

- wire the existing chapter add button in `ChapterSidebar`
- add a clear UI affordance for creating a project in or near `ProjectSwitcher`
- avoid modal-heavy UX unless tests make it worthwhile; keep it simple and deterministic

## Acceptance criteria

- A test proves creating a project adds it to the switcher.
- A test proves creating a project also leaves it with a usable initial chapter.
- A test proves creating a chapter adds it under the active project and selects it.
- A test proves adding a node after switching to a newly created chapter records that node in the active chapter.
- Existing switching behavior continues to work.

## PTDD notes

- Work in `apps/slicr-dcb`.
- Refresh `apps/slicr-dcb/test-list.md` for this task before the first iteration.
- Start with domain-level creation behavior if you introduce commands/handlers.
- Add only the smallest UI needed to make creation operable and testable.

## Suggested validation commands

Use focused Vitest commands during PTDD, then finish with:

- `npm run test --workspace slicr-dcb`
- `npm run typecheck --workspace slicr-dcb`

## Done when

Users can create projects and chapters from the app, and every newly created workspace is immediately usable without manual repair.