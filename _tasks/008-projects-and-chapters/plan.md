# Projects and Chapters for slicr-dcb

## Summary

Introduce first-class support for projects and chapters in `apps/slicr-dcb`.

Today, projects and chapters are UI-only placeholders:

- `src/App.tsx` uses `dummyProjects` and `dummyChapters`
- graph persistence uses a single global event stream
- graph projection is global
- import/export works on raw graph events without project/chapter scope

This feature adds project/chapter metadata and event-sourced project/chapter state while keeping graph events chapter-light: graph events will be tagged by project, but not by chapter.

## Decision

We will:

- add project events and chapter events
- add commands for creating/renaming projects and chapters
- tag all graph events with `projectId`
- tag chapter lifecycle events with `chapterId`
- **not** tag all chapter graph events with `chapterId`
- keep chapter-aware projection logic responsible for ignoring nodes/events that do not belong to the active chapter

Reasoning:

- tagging every graph event with `chapterId` would make moving nodes between chapters harder
- we accept the extra read/projection cost of loading project-scoped events and filtering in projection

## New events

### Project events

- `ProjectAdded`
  - payload: `{ projectId: string, name: string }`
- `ProjectRenamed`
  - payload: `{ projectId: string, newName: string }`

### Chapter events

- `ChapterAdded`
  - payload: `{ projectId: string, chapterId: string, title: string }`
- `ChapterRenamed`
  - payload: `{ projectId: string, chapterId: string, newTitle: string }`

## Graph event changes

Existing graph events remain, but all of them gain `projectId` in payload and tags.

Events affected:

- `NodeAdded`
- `NodeRenamed`
- `NodeRemoved`
- `NodeTypeChanged`
- `NodeSchemaChanged`
- `NodeExampleValuesChanged`
- `NodesConnected`
- `NodesDisconnected`

### Chapter association for graph state

Chapter membership should not be modeled by tagging every graph event with `chapterId`.

Recommended approach:

- `NodeAdded` should include `chapterId` in its payload so a node starts in a chapter
- later chapter movement can be represented by a dedicated node/chapter reassignment event rather than rewriting chapter tags across all node events
- non-creation node events continue to rely on node identity and project scope, while chapter-aware projections decide whether the node belongs in the active chapter

This keeps chapter movement possible without requiring all historical node events to carry chapter tags.

## New commands

### Initialization

- `EnsureDefaultProjectAndChapter`
  - when no project exists, create a default project
  - when the active/default project has no chapter, create a default chapter

### Project commands

- `AddProject`
- `RenameProject`

### Chapter commands

- `AddChapter`
- `RenameChapter`

### Graph commands requiring scope

At minimum, graph creation commands need explicit project/chapter scope:

- `AddNodeCommand` → add `projectId`, `chapterId`
- `AddConnectedNodeCommand` → add `projectId`, `chapterId`

Recommended: scope all graph mutation commands with `projectId`.

- `RenameNodeCommand`
- `ChangeNodeTypeCommand`
- `ChangeNodeSchemaCommand`
- `ChangeNodeExampleValuesCommand`
- `RemoveNodeCommand`
- `ConnectNodesCommand`
- `DisconnectNodesCommand`

For these, `chapterId` is not required on every command if chapter membership is derived from the node.

## Tagging plan

### Project events

- `ProjectAdded` → `projectId:<id>`
- `ProjectRenamed` → `projectId:<id>`

### Chapter events

- `ChapterAdded` → `projectId:<id>`, `chapterId:<id>`
- `ChapterRenamed` → `projectId:<id>`, `chapterId:<id>`

### Graph events

All graph events get:

- `projectId:<id>`

Chapter tags are **not** added to all graph events.

Existing useful tags should remain, e.g.:

- `nodeId:<id>`
- `type:<type>`
- `role:<role>`
- `connection:<source->target>`

## Recommended additional event

To support moving nodes between chapters cleanly, add:

- `NodeChapterChanged`
  - payload: `{ projectId: string, nodeId: string, chapterId: string }`
  - tags: `projectId:<id>`, `nodeId:<id>`, `chapterId:<id>`

This is not strictly required for the first slice if only initial chapter placement is needed, but it matches the chosen design and avoids chapter tags on every graph event.

## Projection implications

### Project list projection

Need a projector for:

- all projects
- active project name

### Chapter list projection

Need a projector for:

- chapters within a project
- active chapter title

### Graph projection

`GraphProjector` currently projects the whole stream.

It should become project-scoped and chapter-aware:

- query by `projectId`
- replay graph events for that project
- include only nodes currently belonging to the active chapter
- ignore node events that belong to nodes outside the active chapter

Because chapter is not a tag on all graph events, projection will likely need node membership tracking during replay.

## Persistence and UI implications

### `useGraphModel`

`useGraphModel` currently loads one global graph.

It should instead load based on:

- active project
- active chapter

### UI

Replace hardcoded data sources with projected state for:

- `ProjectSwitcher`
- `ChapterSidebar`

### Initialization

On first load:

- ensure a default project exists
- ensure that project has a default chapter

## Import/export implications

Current import/export works on raw graph events.

Need to decide whether import/export is scoped to:

- a chapter
- a project
- the whole workspace

Legacy graph import will need default `projectId` and `chapterId` assignment.

## Test impact

Expected updates:

- `apps/slicr-dcb/src/domain/events.ts`
- `apps/slicr-dcb/src/domain/events.test.ts`
- `apps/slicr-dcb/src/domain/nodeCommands/handler.ts`
- `apps/slicr-dcb/src/domain/graphProjector/graphProjector.ts`
- `apps/slicr-dcb/src/graph/eventSourcedGraphModel.ts`
- `apps/slicr-dcb/src/graph/importExport.ts`
- related tests for projection, import/export, and event tagging

## Small consistency improvement

Add `connection:<source->target>` to `NodesConnected` as well as `NodesDisconnected`.

This makes connection queries more symmetric and will help later when project-scoped connection replay grows more complex.
