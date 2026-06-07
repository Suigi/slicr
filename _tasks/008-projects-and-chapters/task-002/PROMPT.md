# Task 002: Scope graph events to projects

Use the **pi-ptdd** skill for this task. Assume task 001 is complete.

## Goal

Add `projectId` to all persistent graph events and make graph replay/query logic project-scoped, while preserving the current single-project UX.

At the end of this task:

- every graph event carries project scope
- project-scoped graph projection works
- the app still behaves as a single active default project
- all tests pass

## Scope

Implement project scoping only.

Do **not** yet:

- add chapter-aware graph projection
- add `chapterId` to all graph events
- replace `dummyProjects` / `dummyChapters` in the UI
- add project/chapter creation or rename UI

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
- Related app tests if needed

## Required behavior

### Graph event payload/tag changes

Update all graph events so they include `projectId` in payload and tags:

- `NodeAdded`
- `NodeRenamed`
- `NodeRemoved`
- `NodeTypeChanged`
- `NodeSchemaChanged`
- `NodeExampleValuesChanged`
- `NodesConnected`
- `NodesDisconnected`

Keep existing useful tags such as:

- `nodeId:<id>`
- `type:<type>`
- `role:<role>`
- `connection:<source->target>`

Also add `connection:<source->target>` to `NodesConnected` for symmetry.

### Command and replay scope

Update graph command handlers and projection/query logic so they operate within one project.

The current app may continue to use a single default active project from task 001, but the domain code should no longer assume a global graph.

### Import/export

Update exported/imported event validation so project-scoped graph events are valid.

Legacy graph snapshot import should assign the default project id.

## Acceptance criteria

- All graph event factories and tests require `projectId`.
- Graph replay can project the graph for one project without mixing in another project's events.
- Current graph editing behavior still works for the default project.
- Import/export tests are updated for the new event shape.
- Existing app behavior remains usable.

## PTDD notes

- Work in `apps/slicr-dcb`.
- Refresh `apps/slicr-dcb/test-list.md` for this task before the first iteration.
- Prefer focused tests around event factories, one handler, then projector behavior, then import/export.
- Keep the visible app stable by threading the default project through current model calls.

## Suggested validation commands

Use focused Vitest commands during PTDD, then finish with:

- `npm run test --workspace slicr-dcb`
- `npm run typecheck --workspace slicr-dcb`

## Done when

Graph persistence is no longer global; it is project-scoped in the domain and storage/replay path, while the UI still works in its current single-project mode.