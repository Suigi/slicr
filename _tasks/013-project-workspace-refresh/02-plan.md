# Project Workspace Refresh

## Summary

Keep project and chapter navigation in the served editor current when another client, such as the CLI, changes workspace metadata. This is the remaining project read-side follow-up from Step 8 of [Project-Owned Event Models](../012-project-owned-event-models/02-plan.md).

## Goals

- Refresh project and chapter lists after external workspace changes without requiring a page reload.
- Keep navigation data and the displayed chapter graph consistent with their observed revisions.
- Add a regression test for cross-client workspace updates.

## Non-goals

- An All Chapters graph view is not required.
- Do not change the selected-chapter scope model or project command write policy.
- Do not refactor the editor around separate projection and command ports; that work is tracked in [014](../014-shared-editor-application/02-plan.md).
- Do not migrate, merge, or synchronize IndexedDB history with `.slicr/`, or initialize project history implicitly.

## Core rules

- `.slicr/` remains authoritative for the project-backed editor; reads never initialize or rewrite it.
- Project/chapter navigation updates must originate from the project workspace read model, not a browser-side copy.
- Workspace and graph read data presented together must have compatible revisions; stale reads must not overwrite a newer selected scope.
- A project remains chapter-scoped in the graph view; an unset chapter selects the project's first chapter.

## Implementation shape

The project adapter already polls model and graph-projection APIs for revision-paired graph snapshots. Extend the workspace read/update path so changes made outside the editor update project and chapter navigation as well. Preserve scope-generation guards so delayed results for an old project or chapter cannot replace newer selections.

## Test plan

- While the served editor is open, add or rename a project/chapter from another client and verify the switcher/sidebar updates without reload.
- Verify the graph remains in the selected chapter and navigation/graph data do not mix incompatible revisions.
- Preserve tests for no implicit initialization and CLI/browser graph catch-up.

## Deferred follow-up

The shared editor application and separate projection/command port refactor is defined in [014](../014-shared-editor-application/02-plan.md).
