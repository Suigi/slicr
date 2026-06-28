# Read-model subscriptions Tasks

## Feature Description
Introduce an application-owned projection and subscription layer for `apps/slicr-dcb` so React consumes workspace and scoped graph read models through subscriptions instead of owning projection refresh timing directly. See [./02-plan.md](./02-plan.md).

## Workflow

Tasks should move through these status values in order:

* `[created]`: the task was described, but no work was done to implement it
* `[started]`: an agent sets this status before starting to work on a task
* `[done]`: an agent sets this status once a task is completed

**IMPORTANT**: Only **ONE** (1) task should be in the `[started]` status at a time.
Agents must update the task file as they work: set a task to `[started]` immediately before implementation begins, and set it to `[done]` as soon as that task is complete.

## Learnings

Add any learnings about the feature to `./05-learnings.md`.
Add any learnings about the project overall to the documents in the `./_knowledge` directory.

## Task 1: Extract pure graph projection
### Status
[started]

### Description
Refactor graph projection so application code can derive a model graph directly from canonical event arrays without creating a temporary `MemoryStore`. Keep behavior equivalent to the current `GraphProjector` semantics and preserve chapter-scoped filtering.

### Acceptance Criteria
* A pure graph projection entry point accepts graph-relevant events plus project/chapter scope and returns the same `ModelGraph` snapshots covered by current tests.
* `eventSourcedGraphModel.ts` can stop constructing a temporary `MemoryStore` for projection.
* Existing graph projection behavior for renamed, removed, retyped, moved, and connected nodes remains covered by focused tests.

### Dependencies
* None

### Notes
* This task is about derivation shape only; do not add subscriptions yet.
* `GraphProjector` may remain temporarily as a compatibility wrapper if that keeps the change small.

## Task 2: Add projection service with separate subscriptions
### Status
[created]

### Description
Introduce an application-layer projection service that reads canonical events from `commandStore`, derives workspace and graph snapshots, manages internal refresh state, and exposes separate subscription APIs for workspace and scoped graph views.

### Acceptance Criteria
* A new application service exposes workspace subscription and scoped graph-view subscription APIs matching the plan.
* The service refreshes from `commandStore` and updates subscribed listeners with derived snapshots.
* Scoped graph views can change scope without React reading events directly.
* Unsubscribed listeners stop receiving updates.

### Dependencies
* Task 1

### Notes
* Keep sequence/checkpoint tracking internal-only in this task.
* Full replay on refresh is acceptable for v1.
* Shape the service so projector query ownership is explicit and can later drive store-backed subscriptions without changing the React-facing API.

## Task 3: Route the graph model facade through the projection service
### Status
[created]

### Description
Shrink `eventSourcedGraphModel.ts` into a compatibility facade that delegates projection state, scope handling, and refresh behavior to the new projection service while keeping existing command-oriented methods stable for current callers.

### Acceptance Criteria
* `eventSourcedGraphModel.ts` no longer owns ad-hoc projection rebuilding from direct store reads.
* Command methods still return updated graph snapshots after successful command execution.
* Scope resolution and workspace access remain behaviorally equivalent for current consumers.
* Focused tests prove the facade now relies on the projection service rather than temporary projection-store plumbing.

### Dependencies
* Task 2

### Notes
* Keep the public shape stable enough that `useGraphModel.ts` can migrate separately.
* Avoid bundling unrelated command-router changes into this task.
* Do not entrench `refresh()` deeper into React-facing APIs; treat it as a compatibility detail on the path toward query-driven store subscriptions.

## Task 4: Subscribe the React hook to application projections
### Status
[created]

### Description
Update `useGraphModel.ts` to consume workspace and scoped graph updates through the new application subscription APIs while preserving its local UI-transient state management and command invocation glue.

### Acceptance Criteria
* `useGraphModel.ts` subscribes to workspace and graph snapshots instead of manually driving projection reload flow for normal updates.
* Existing user-visible behaviors for loading, scope switching, and command-driven graph updates remain intact.
* Hook or integration tests prove React-facing code observes projection updates without direct store reads.

### Dependencies
* Task 3

### Notes
* Keep local editing drafts, focus, menus, and debounce logic in the hook.
* Do not expose raw events or event-store primitives to React.

## Task 5: Tighten bootstrap and loader integration around projection ownership
### Status
[created]

### Description
Update application bootstrap and loader wiring so the new projection service is initialized consistently, the active feature path is validated by tests, and the app has a clear ownership boundary for command execution versus projection subscription.

### Acceptance Criteria
* `createGraphApplication` and related loader code initialize command APIs and the projection service in one consistent application boundary.
* Focused tests cover initial load plus subsequent subscribed updates through the application entry point.
* The resulting architecture leaves a clear path to removing `eventSourcedGraphModel.ts` in a later feature without requiring React to change ownership again.

### Dependencies
* Task 4

### Notes
* Keep this task focused on wiring and regression coverage, not on new product behavior.
* Broader live external subscription support remains deferred.
* Preserve a clear migration path toward projector-defined `Query` usage for both initial reads and store-backed subscriptions.
