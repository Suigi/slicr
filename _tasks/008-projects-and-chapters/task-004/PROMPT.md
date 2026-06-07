# Task 004: Replace dummy project/chapter UI with event-sourced workspace state and switching

Use the **pi-ptdd** skill for this task. Assume tasks 001 through 003 are complete.

## Goal

Make `apps/slicr-dcb` read its project/chapter lists from the event stream instead of hardcoded arrays, and switch the visible graph based on the active project and chapter.

At the end of this task:

- `dummyProjects` and `dummyChapters` are gone
- active project/chapter come from projected workspace state
- switching project or chapter reloads the corresponding graph view
- the app remains usable and tests pass

## Scope

Implement read-only workspace browsing and switching.

Do **not** yet:

- add create-project or create-chapter behavior
- add rename-project or rename-chapter behavior

## Relevant files

- `apps/slicr-dcb/src/App.tsx`
- `apps/slicr-dcb/src/components/ProjectSwitcher.tsx`
- `apps/slicr-dcb/src/components/ChapterSidebar.tsx`
- `apps/slicr-dcb/src/graph/useGraphModel.ts`
- `apps/slicr-dcb/src/graph/eventSourcedGraphModel.ts`
- workspace projection/helper files added earlier
- `apps/slicr-dcb/src/App.test.ts`
- Related component tests

## Required behavior

### Workspace-driven UI

Replace hardcoded project/chapter data with projected workspace state from the shared event store.

### Selection behavior

- on initial load, select a valid project and chapter from the projected workspace state
- when switching projects, select a valid chapter within that project
- the collapsed sidebar label should use the active chapter title from real state
- switching to a chapter with no nodes should show an empty graph, not a broken app

### Graph loading behavior

`useGraphModel` and related graph-loading APIs should become explicitly aware of:

- active project id
- active chapter id

Switching either should load/project the correct graph slice.

## Acceptance criteria

- The app no longer depends on `dummyProjects` or `dummyChapters`.
- A test proves the project switcher renders event-sourced project names.
- A test proves the chapter sidebar renders event-sourced chapter titles for the active project.
- A test proves switching project/chapter changes the visible graph slice.
- A test proves an empty chapter still renders a usable empty canvas state.
- Existing graph editing flows still work in the active project/chapter.

## PTDD notes

- Work in `apps/slicr-dcb`.
- Refresh `apps/slicr-dcb/test-list.md` for this task before the first iteration.
- Add the smallest app-level tests that prove state comes from projections and that switching changes the graph.
- Favor thin UI components over duplicating workspace logic in `App.tsx`.

## Suggested validation commands

Use focused Vitest commands during PTDD, then finish with:

- `npm run test --workspace slicr-dcb`
- `npm run typecheck --workspace slicr-dcb`

## Done when

The visible project/chapter navigation is fully event-sourced and switching scopes the graph correctly, even though create/rename workflows are not implemented yet.