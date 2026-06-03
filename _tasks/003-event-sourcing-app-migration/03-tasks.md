# Event Sourcing App Migration Tasks

## Feature Description

Migrate `apps/slicr-dcb` from snapshot/localStorage graph state to an IndexedDB-backed event-sourced store, as described in [02-plan.md](./02-plan.md).

## Workflow

Tasks should move through these status values in order:

* `[created]`: the task was described, but no work was done to implement it
* `[started]`: an agent sets this status before starting to work on a task
* `[done]`: an agent sets this status once a task is completed

**IMPORTANT**: Only **ONE** (1) task should be in the `[started]` status at a time.
Agents must update the task file as they work: set a task to `[started]` immediately before implementation begins, and set it to `[done]` as soon as that task is complete.

## Learnings

Add feature learnings to [05-learnings.md](./05-learnings.md).
Add project-wide learnings to the documents in `./knowledge` if applicable.

## Task 1: Complete graph domain events and commands
### Status
[done]

### Description
Complete the slicr-dcb event factories and command handlers for all persistent graph mutations currently supported by `useGraphModel`.

### Acceptance Criteria
* Event factories exist for `NodeRemoved`, `NodeTypeChanged`, and `NodesDisconnected` in addition to the existing factories.
* Every event factory method in `apps/slicr-dcb/src/domain/events.ts` has direct test coverage.
* Command handlers cover add node, add connected node, rename node, change node type, connect nodes, disconnect nodes, and remove node.
* Command tests verify unknown-node validation for commands that require existing nodes.
* Command tests verify self-connections and duplicate connections do not produce invalid persistent events.
* Add-connected-node emits both `NodeAdded` and `NodesConnected` with the expected lane, type, label, and role.

### Dependencies
* None

### Notes
* Preserve transient UI concerns outside the domain command layer.
* It is acceptable for command handler names and command shapes to change if tests document the intended public contract.

## Task 2: Complete graph projection
### Status
[done]

### Description
Update `GraphProjector` so replaying the full domain event stream produces a complete, deterministic `ModelGraph` for all event types.

### Acceptance Criteria
* `NodeRemoved` removes the node and all connected edges from the projected graph.
* `NodeTypeChanged` updates the projected node type.
* `NodesDisconnected` removes the matching projected edge.
* Lanes are derived from remaining node lane ids and sorted deterministically.
* Projecting an empty store returns empty nodes, edges, and lanes.
* Malformed events that reference missing nodes do not crash projection.

### Dependencies
* Task 1

### Notes
* Do not add UI-only fields such as dimensions to `ModelGraph`.
* Prefer projector tests that replay realistic event sequences instead of mutating projection internals.

## Task 3: Normalize node id event tags and queries
### Status
[done]

### Description
Update all slicr-dcb domain event tags that mention node ids so they consistently use the `nodeId:<id>` naming pattern, and update every command/query that depends on those tags.

### Acceptance Criteria
* Every domain event tag that identifies a node uses the exact `nodeId:<id>` pattern.
* `NodesConnected` includes both `nodeId:<sourceNodeId>` and `nodeId:<targetNodeId>` tags.
* `NodesDisconnected` and all single-node events use `nodeId:<id>` tags for their node references.
* Command handlers and store queries that look up events by node id use the normalized tag names.
* Tests cover the updated tag names and at least one query path that relies on the normalized node id tags.

### Dependencies
* Task 1

### Notes
* Keep any non-node tags, such as connection-role or connection-endpoint tags, unchanged unless they also encode a node id and need this normalization.
* This task intentionally updates naming only; it should not change command validation or projection semantics.

## Task 4: Add domain-to-renderer graph adapter
### Status
[done]

### Description
Add a mapper from domain `ModelGraph` to the existing renderer input shape used by `App.tsx` and layout-lib.

### Acceptance Criteria
* Domain nodes map to `GraphNode` with stable ids, labels, node types, string lane ids, and default dimensions.
* Domain edges map to `EdgeInput` with deterministic ids and preserved roles.
* Domain lanes map to `LaneInput` without changing renderer expectations.
* Adapter tests cover empty graph, multiple lanes, and back-reference edges.

### Dependencies
* Task 2

### Notes
* Keep the existing renderer/layout components unchanged unless a type mismatch requires a minimal adjustment.

## Task 5: Add import and export conversion utilities
### Status
[done]

### Description
Create utilities for exporting domain events and importing either exported domain events or legacy `{ nodes, edges, lanes }` snapshots into replacement event streams.

### Acceptance Criteria
* Export serialization returns an ordered JSON array of domain events.
* Import recognizes and validates an exported domain event array.
* Import recognizes a legacy snapshot and converts nodes and edges into equivalent domain events.
* Legacy standalone lanes with no nodes are intentionally ignored.
* Invalid import input produces a clear failure result without mutating the store.

### Dependencies
* Task 1
* Task 3
* Task 4

### Notes
* Keep conversion logic independent from clipboard APIs so it can be unit tested.

## Task 6: Add IndexedDB event store
### Status
[done]

### Description
Add an IndexedDB-backed store implementation to `packages/event-sourcing` that supports the existing `Store<E>` query/append behavior plus the clear/read-all/replace operations needed by slicr-dcb import/export.

### Acceptance Criteria
* A store can append one event and multiple events and later return them in append order.
* `Query.all`, `Query.none`, and filtered `Query.where` behavior matches `MemoryStore` for persisted events.
* The store can clear all events for the configured stream/database scope.
* The store can replace all events with a supplied ordered event list.
* The new store is exported from `@slicr/event-sourcing`.

### Dependencies
* None

### Notes
* Keep the existing synchronous `Store<E>` contract intact where possible; if IndexedDB forces async APIs, introduce a small explicit async store contract rather than weakening types silently.
* Tests may use an injectable IndexedDB-like dependency if Vitest does not provide native IndexedDB.

## Task 7: Replace slicr-dcb persistent state with event-sourced hook
### Status
[done]

### Description
Replace snapshot/localStorage persistence in `useGraphModel` with an event-sourced hook/service that appends domain events, re-projects the store, adapts to renderer inputs, and preserves the existing interaction API where practical.

### Acceptance Criteria
* Initial load reads IndexedDB events and renders their projection.
* Empty IndexedDB store renders an empty canvas.
* Adding, connecting, deleting, renaming, and type-changing nodes update the event store and rendered graph.
* Transient UI state such as focus, editing, menus, and connecting source remains local and does not appear in events.
* No graph snapshot is written to the old `slicr-dcb.graphModel.v1` localStorage key during normal mutations.

### Dependencies
* Task 1
* Task 2
* Task 3
* Task 4
* Task 6

### Notes
* If async store loading requires a loading state, keep it minimal and local to the hook/app boundary.
* Preserve current user interactions unless they conflict with the event-sourced model.

## Task 8: Wire event-based import and export in the app
### Status
[done]

### Description
Update `App.tsx` clipboard actions so export writes events and import clears/replaces IndexedDB events from either exported events or legacy snapshots.

### Acceptance Criteria
* Copy/export writes the ordered domain event stream as JSON.
* Paste/import accepts the exported event JSON and re-renders the same graph.
* Paste/import accepts the legacy snapshot JSON and renders the converted graph.
* Import clears previously stored events before appending replacement events.
* Failed import leaves the current graph/event store unchanged and shows the existing alert-style feedback or an equivalent clear error.

### Dependencies
* Task 5
* Task 7

### Notes
* Do not implement automatic migration from localStorage snapshots in this task.
