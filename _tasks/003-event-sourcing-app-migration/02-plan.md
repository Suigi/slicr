# Event Sourcing App Migration Plan

## Summary

Migrate `apps/slicr-dcb` from snapshot-based React/localStorage graph state to an event-sourced graph store. The app will persist domain events in an IndexedDB-backed store implemented in `packages/event-sourcing`, project those events into the domain `ModelGraph`, adapt that projection to the existing graph renderer inputs, and expose import/export flows based on events.

## Goals

- Store the slicr-dcb graph as an ordered event stream in IndexedDB.
- Add an IndexedDB implementation to `@slicr/event-sourcing` that can append, query, read all events, and clear/replace a stream for imports.
- Complete the slicr-dcb graph domain event surface for current persistent graph mutations.
- Project events into a complete domain graph model, including removals, type changes, connections, and disconnections.
- Keep the existing renderer and layout integration mostly unchanged by adapting the domain projection to the current UI graph shape.
- Export events rather than snapshot graph state.
- Import either exported events or legacy `{ nodes, edges, lanes }` snapshots; import clears current events before writing replacement events.
- Treat an empty event store as an empty canvas.

## Non-Goals

- No server-side or multi-device synchronization.
- No collaboration, conflict resolution, optimistic concurrency, or event compaction.
- No guarantee that legacy localStorage snapshots are automatically migrated on page load unless the import flow is used.
- No visual redesign of the graph editor.
- No attempt to persist transient UI state such as focused node, open menu, connecting source, draft label, or edit cancellation flags.
- No schema migration framework beyond the event shapes required for this feature.

## Core Rules

- The event stream is the source of truth for persistent slicr-dcb graph state.
- Projection must be deterministic: replaying the same ordered events yields the same graph.
- Empty event store means empty canvas; no default `Node 1` is created automatically.
- Imported data replaces the current graph by clearing the app event store and appending the imported or converted events.
- Exported data is the domain event stream, not `{ nodes, edges, lanes }`.
- Legacy snapshot import converts each node to `NodeAdded`, each non-default node type as part of `NodeAdded`, each label as part of `NodeAdded`, and each edge to `NodesConnected`.
- Lanes are derived from nodes. Standalone lanes from a legacy snapshot that have no nodes are not preserved in v1.
- Edge ids remain UI-derived from source and target ids. Domain connections are identified by `(sourceNodeId, targetNodeId)`.
- `back-reference` is persisted as the connection role when the command determines the connection would create a cycle.
- Projectors should not crash on malformed streams. They should ignore events that target missing entities unless a command handler prevents those events from being produced.

## Data Model

### Domain events

The existing `DomainEvent` union remains the app-level event contract and should cover:

- `NodeAdded`: `{ nodeId, type, laneId, label }`
- `NodeRenamed`: `{ nodeId, newName }`
- `NodeRemoved`: `{ nodeId }`
- `NodeTypeChanged`: `{ nodeId, newType }`
- `NodesConnected`: `{ sourceNodeId, targetNodeId, role }`
- `NodesDisconnected`: `{ sourceNodeId, targetNodeId }`

Event factory helpers should exist for all event types. Tags should support the command queries needed by the handlers, including node ids and connection endpoints.

### Domain graph projection

`ModelGraph` remains the domain read model:

- `nodes: Node[]`
- `edges: Edge[]`
- `lanes: Lane[]`

`laneId` in the domain remains numeric. UI lane ids are derived as `lane-${laneId}`.

### UI graph adapter

The app should adapt `ModelGraph` to the existing renderer model:

- Domain `nodeId` -> UI `id`
- Domain `nodeType` -> UI `type`
- Domain numeric `laneId` -> UI string `lane-${laneId}`
- UI node dimensions use `NODE_WIDTH` and `NODE_HEIGHT`
- Domain edge `(sourceNodeId, targetNodeId)` -> UI edge id `edge-${sourceNodeId}-${targetNodeId}`
- Domain lane `{ id: "lane-N", order: N }` can pass through to `LaneInput`

## Algorithm Or Derivation Steps

### Projection

1. Query or load all domain events in append order.
2. Start with `{ nodes: [], edges: [], lanes: [] }`.
3. For `NodeAdded`, add the node if the id is not already present.
4. For `NodeRenamed`, update the node label if the node exists.
5. For `NodeTypeChanged`, update the node type if the node exists.
6. For `NodeRemoved`, remove the node and remove all edges where it is source or target.
7. For `NodesConnected`, add or replace the connection if both endpoint nodes exist and source differs from target.
8. For `NodesDisconnected`, remove the connection with the matching endpoints.
9. Recompute lanes from remaining node lane ids in ascending order.

### Commands

Commands should validate persistent invariants before appending events:

- cannot rename, type-change, or remove an unknown node
- cannot connect unknown nodes
- cannot connect a node to itself
- duplicate connections should not append duplicate events
- disconnection of a missing connection should be a no-op or explicitly validated consistently in tests
- removing a node appends `NodeRemoved`; the projector derives connected edge removal
- adding a connected node appends both `NodeAdded` and `NodesConnected`

### Import

1. Parse clipboard/input JSON.
2. If it looks like a domain event array, validate minimally and use it directly.
3. If it looks like a legacy snapshot, convert it to domain events.
4. Clear current IndexedDB app events.
5. Append replacement events.
6. Re-project and re-render.

### Export

1. Read all persisted domain events in append order.
2. Write JSON event array to the clipboard.

## Renderer Or Interaction Behavior

- Existing visual graph layout, node rendering, menus, and keyboard navigation should continue to use the current UI graph shapes after adaptation.
- Focus, editing, menus, and connecting state remain local React state.
- After persistent mutations, the hook/service re-projects events and updates rendered graph state.
- After import, focus should reset to the first projected node if one exists, otherwise `null`.
- Empty event store renders no nodes, no edges, and no lanes.

## Implementation Shape

- Add an IndexedDB-backed store under `packages/event-sourcing/src`, exported from `@slicr/event-sourcing`.
- Keep the existing `Store<E>` interface for command/projector compatibility, and extend through an additional clear/replace/read-all capability if needed.
- Add tests for IndexedDB behavior using the project’s test environment constraints; if native IndexedDB is unavailable in Vitest, isolate the persistence adapter so storage operations can be tested with an injectable IndexedDB-like dependency.
- Complete event factories and command handlers in `apps/slicr-dcb/src/domain`.
- Complete `GraphProjector` behavior and tests.
- Add a domain-to-UI adapter in `apps/slicr-dcb/src/graph` or `apps/slicr-dcb/src/domain`.
- Replace localStorage snapshot persistence in `useGraphModel` with an event-sourced hook/service while preserving the returned interaction API where practical.
- Update `App.tsx` clipboard import/export to use events and legacy conversion.

## Test Plan

- Unit-test IndexedDB store append, query, read-all, clear, and replace behavior.
- Unit-test event factories for all domain event types.
- Unit-test command handlers for add, rename, type change, connect, disconnect, remove, and add-connected-node cases.
- Unit-test projector replay for every event type and malformed/missing-target cases.
- Unit-test UI adapter conversion from `ModelGraph` to current graph renderer inputs.
- Unit-test legacy snapshot-to-events import conversion.
- Unit-test exported-events import round trip.
- Add or update React/app tests around empty canvas, import, export, and basic graph mutation behavior if practical.

## Deferred Follow-Up

- Automatic one-time migration from the old localStorage snapshot key.
- Event schema versioning and migrations.
- Snapshots for faster startup.
- Server-backed event store or sync.
- Strong concurrency controls and append preconditions.
