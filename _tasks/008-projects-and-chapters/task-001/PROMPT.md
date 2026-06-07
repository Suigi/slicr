# Task 001: Add workspace metadata events, projections, and default initialization

Use the **pi-ptdd** skill for this task.

## Goal

Introduce event-sourced workspace metadata for projects and chapters in `apps/slicr-dcb` without changing graph behavior yet.

At the end of this task:

- the app still behaves like a single-project/single-chapter app
- project/chapter metadata exists in the domain as events
- empty stores are initialized with a default project and a default chapter
- tests pass

## Scope

Implement only workspace metadata and initialization.

Do **not** yet:

- add `projectId` to graph events
- add `chapterId` to graph node events
- replace `dummyProjects` / `dummyChapters` in `App.tsx`
- add project/chapter creation or rename UI

## Relevant files

- `apps/slicr-dcb/src/domain/events.ts`
- `apps/slicr-dcb/src/domain/events.test.ts`
- `apps/slicr-dcb/src/graph/useGraphModel.ts`
- `apps/slicr-dcb/src/graph/eventSourcedGraphModel.ts`
- `apps/slicr-dcb/src/App.tsx`
- New projector/helper files under `apps/slicr-dcb/src/domain/` or `apps/slicr-dcb/src/graph/`
- Related new tests

## Required behavior

### New workspace events

Add:

- `ProjectAdded` with payload `{ projectId, name }`
- `ProjectRenamed` with payload `{ projectId, newName }`
- `ChapterAdded` with payload `{ projectId, chapterId, title }`
- `ChapterRenamed` with payload `{ projectId, chapterId, newTitle }`

Tagging rules:

- project events: `projectId:<id>`
- chapter events: `projectId:<id>`, `chapterId:<id>`

### Workspace projection

Add projection logic for:

- list of projects
- list of chapters for a project
- latest names/titles after rename events

Keep the design simple and testable.

### Default initialization

When the app loads an empty event store, initialize it so a usable workspace exists:

- create one default project
- create one default chapter in that project

The exact default ids/names may be chosen by the implementation, but tests should make them explicit.

Initialization should be idempotent enough that a non-empty store is not duplicated.

## Acceptance criteria

- Workspace events exist and are covered by tests.
- Workspace projection can derive projects and chapters from the event stream.
- Loading an empty store creates a default project and default chapter.
- Loading a non-empty store does not append duplicate default workspace events.
- Existing graph behavior remains unchanged.
- Existing app tests continue to pass.

## PTDD notes

- Work in `apps/slicr-dcb`.
- Refresh `apps/slicr-dcb/test-list.md` for this task before the first iteration.
- Start with focused tests for workspace event factories and projection behavior.
- Then add the initialization behavior with a focused test around the empty store load path.

## Suggested validation commands

Use focused Vitest commands during PTDD, then finish with:

- `npm run test --workspace slicr-dcb`
- `npm run typecheck --workspace slicr-dcb`

## Done when

The repo has first-class project/chapter metadata and empty stores bootstrap a usable default workspace, while the visible graph experience still works as before.