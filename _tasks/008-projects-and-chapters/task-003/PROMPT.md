# Task 003: Add chapter membership to nodes and chapter-aware graph projection

Use the **pi-ptdd** skill for this task. Assume tasks 001 and 002 are complete.

## Goal

Introduce chapter membership for graph nodes without tagging every graph event with `chapterId`.

At the end of this task:

- newly created nodes belong to a chapter
- graph replay can project one chapter within one project
- chapter membership is tracked by replay logic instead of chapter tags on every graph event
- the app still works in a single active default chapter

## Scope

Implement chapter-aware graph state, but keep the visible UI in single-chapter mode for now.

Do **not** yet:

- replace `dummyProjects` / `dummyChapters`
- add chapter switching UI behavior
- add project/chapter create/rename UI

## Relevant files

- `apps/slicr-dcb/src/domain/events.ts`
- `apps/slicr-dcb/src/domain/events.test.ts`
- `apps/slicr-dcb/src/domain/nodeCommands/handler.ts`
- `apps/slicr-dcb/src/domain/nodeCommands/handler.test.ts`
- `apps/slicr-dcb/src/domain/graphProjector/graphProjector.ts`
- `apps/slicr-dcb/src/domain/graphProjector/graphProjector.test.ts`
- `apps/slicr-dcb/src/graph/eventSourcedGraphModel.ts`
- `apps/slicr-dcb/src/graph/eventSourcedGraphModel.test.ts`
- `apps/slicr-dcb/src/graph/importExport.ts`
- `apps/slicr-dcb/src/graph/importExport.test.ts`
- `apps/slicr-dcb/src/graph/useGraphModel.ts`

## Required behavior

### Event changes

- `NodeAdded` must include `chapterId` in its payload.
- Add `NodeChapterChanged` with payload `{ projectId, nodeId, chapterId }`.
- `NodeChapterChanged` tags should include at least:
  - `projectId:<id>`
  - `nodeId:<id>`
  - `chapterId:<id>`

Do **not** add `chapterId` tags to all graph events.

### Projection behavior

Make graph projection chapter-aware within a project:

- nodes are visible only if they currently belong to the active chapter
- node property schema/example events should apply only for visible/currently tracked nodes
- edges should appear only when both endpoint nodes belong to the active chapter and exist
- replay must tolerate reading extra project events for nodes in other chapters and ignore them for the active chapter result

### Default behavior

Current app operations should continue using the default chapter created in task 001.

### Import/export

- exported/imported graph events must support `NodeAdded` with `chapterId`
- legacy graph snapshot import should assign the default chapter id

## Acceptance criteria

- Tests prove `NodeAdded` records initial chapter membership.
- Tests prove chapter-aware projection hides nodes from other chapters.
- Tests prove extra events for out-of-chapter nodes do not corrupt the active chapter projection.
- Tests prove edges are filtered to the active chapter.
- Existing graph editing behavior still works in the default chapter.

## PTDD notes

- Work in `apps/slicr-dcb`.
- Refresh `apps/slicr-dcb/test-list.md` for this task before the first iteration.
- Start with a focused failing projector test for chapter filtering.
- Add `NodeChapterChanged` only if the tests need explicit chapter reassignment behavior; keep the implementation minimal.
- Keep the current UI stable by threading the default chapter through model calls.

## Suggested validation commands

Use focused Vitest commands during PTDD, then finish with:

- `npm run test --workspace slicr-dcb`
- `npm run typecheck --workspace slicr-dcb`

## Done when

The graph domain understands chapter membership and can project a single chapter correctly, without requiring chapter tags on every graph event.