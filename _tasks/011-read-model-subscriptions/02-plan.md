# Read-model subscriptions plan

## Summary

Introduce an application-owned, event-driven projection and subscription layer for `apps/slicr-dcb` so React submits commands and observes workspace/scoped graph read-model updates through subscriptions. React should not own projection refresh timing and should not subscribe to raw events.

The target design is query-driven projector ownership: each projector declares the `Query` for the event slice it needs, uses that same `Query` for initial catch-up from the store, and uses it again to receive live matching appended events. Explicit `refresh()` is a bootstrap/compatibility mechanism, not the normal update path.

See [./data-flow.md](./data-flow.md) for the event-driven sequence diagram.

## Goals

- Make projection/read-model ownership explicit in the application layer.
- Expose separate subscriptions for workspace and scoped graph projections.
- Keep the event store as the single source of truth.
- Route command-driven UI updates through appended events and projector catch-up, not manual React refresh orchestration.
- Keep checkpoint / sequence-position tracking internal.
- Reduce React coupling to projection refresh mechanics and store reads.
- Preserve current behavior while migrating under the existing `eventSourcedGraphModel` boundary.
- Move toward removing explicit application-level `refresh()` once store-backed projector subscriptions are in place.

## Non-goals

- Exposing raw event subscriptions to React.
- Making sequence/checkpoint state part of the React-facing API.
- Reworking command routing, decider behavior, or existing DCB append-condition semantics.
- Broadly rewriting React component state that is unrelated to projection ownership.
- Supporting external cross-process live-store changes unless the store subscription primitive naturally supports it. In-process subscriptions should observe all appends made through the store instance, not only appends made through the graph application command path.

## Core rules

1. React components and hooks must subscribe to read models, not domain events.
2. React actions invoke callbacks that submit commands; projection updates flow back through read-model subscriptions.
3. The canonical event source remains `commandStore`; no new authoritative event mirror may be introduced in React or hook state.
4. Projectors own the `Query` that defines their event slice.
5. The same projector `Query` is used for initial catch-up and live append matching.
6. Projection service state is derived and disposable.
7. Successful command execution must either resolve after relevant projections have caught up or clearly expose that projection updates arrive asynchronously via subscriptions.
8. Scope changes for graph consumers must recreate/resubscribe the scoped graph projection without changing workspace state.
9. The application projection service owns the conversion from domain graph to React-facing renderer graph by calling `adaptModelGraphToRenderer(...)` after domain graph projection.
10. Internal sequence/checkpoint tracking may exist to support efficient catch-up, but it must not become part of the React-facing API.

## Data model

### Projector shape

Projectors own derivation logic and the `Query` that identifies the events they care about.

```ts
type ProjectorDefinition<Event, Scope, State, Projection> = {
  query(scope: Scope): Query;
  initialState(scope: Scope): State;
  evolve(state: State, event: Event, scope: Scope): State;
  projection(state: State, scope: Scope): Projection;
};
```

For store-backed subscriptions, the application/event-sourcing layer owns sequenced projector instances that track the last applied sequence position internally.

```ts
type SequencedProjectorInstance<Event, Projection> = {
  query(): Query;
  evolve(event: SequencedEvent<Event>): void;
  projection(): Projection;
  lastAppliedPosition(): SequencePosition | undefined;
};
```

### Public application-layer concepts

```ts
type GraphModelScope = {
  projectId?: string;
  chapterId?: string;
};

type Subscription = {
  unsubscribe(): void;
};

type GraphProjectionService = {
  refresh(): Promise<void>; // bootstrap/compatibility API; not the normal update path after store subscriptions exist

  getWorkspaceSnapshot(): WorkspaceProjection;
  subscribeToWorkspace(
    listener: (workspace: WorkspaceProjection) => void,
    options?: {emitCurrent?: boolean}, // defaults to true
  ): Subscription;

  createScopedGraphView(initialScope?: GraphModelScope): {
    getScope(): {projectId: string; chapterId: string};

    // Scope changes query/catch up a new scoped projector and resolve with the ready renderer snapshot.
    setScope(scope: GraphModelScope): Promise<RendererGraph>;

    getSnapshot(): RendererGraph;
    subscribe(
      listener: (graph: RendererGraph) => void,
      options?: {emitCurrent?: boolean}, // defaults to true
    ): Subscription;
  };
};
```

`setScope(...)` must return `Promise<RendererGraph>` and callers must not require a synchronous graph recompute from a full event cache. `emitCurrent` defaults to `true` for workspace and scoped graph subscriptions so read-model subscribers can hydrate from the current snapshot immediately, then receive future updates.

### Internal projection state

The service may internally track:

- workspace sequenced projector instance
- per-scoped-view graph sequenced projector instances
- current workspace snapshot
- current renderer graph snapshot per scoped view
- requested and resolved scope per scoped graph view
- listener sets for workspace and scoped graph projections
- sequence/checkpoint state inside projector instances
- request/version counters to ignore stale async scope changes

The service should avoid retaining a full canonical event cache for normal operation once store-backed projector subscriptions are in place.

## Event-driven flow

Normal command-driven updates should follow this path:

1. User triggers an action in a React component.
2. React invokes a callback/hook function.
3. The application creates/routes a command.
4. The command router queries the event store for the decision slice.
5. The decider projects a decision model and emits events.
6. The command router appends emitted events to the store.
7. Store append notifications are matched against subscribed projector queries.
8. Matching projectors catch up from their last applied sequence position.
9. Projection service updates workspace/scoped graph snapshots.
10. React subscribers receive read-model updates and render the new state.

See [./data-flow.md](./data-flow.md) for the Mermaid diagram.

## Query subscription and catch-up flow

1. A projection owner creates a sequenced projector instance for a definition and scope.
2. It performs initial catch-up by querying the store with `instance.query()` from the instance's last applied position.
3. It subscribes that same query to future appended events through the event store interface.
4. The store subscription observes all appends made through that store instance, including appends outside the graph application command API.
5. When matching sequenced events are appended, the instance evolves only those events after its last applied position.
6. After event catch-up, the projection service notifies read-model listeners.
7. Repeated notifications without new matching events must not double-apply events.

## Scoped graph flow

1. A caller creates a scoped graph view with an optional requested scope.
2. The view resolves that requested scope against the current workspace projection.
3. The view creates or reuses a graph projector subscription for the resolved scope.
4. The view exposes the resolved scope and current `RendererGraph` snapshot.
5. When `setScope(...)` is called, the view resolves the requested scope, recreates/resubscribes the scoped graph projector, catches it up, and notifies graph subscribers if the renderer snapshot changes.
6. Scope changes do not read or append events directly from React.
7. Rapid scope changes must not allow stale async catch-up results to overwrite the latest requested scope.

## Command flow

1. React invokes an application command API.
2. The command API routes the command through the existing command router.
3. The command router appends emitted events to `commandStore`.
4. Appended events notify subscribed projector queries.
5. Matching projectors catch up and update read-model subscribers.
6. The command API resolves after events are appended. Projection updates may arrive later through read-model subscriptions after matching projector catch-up. Tests should make this asynchronous observation boundary explicit.

## Renderer / interaction behavior

- React should subscribe separately to:
  - workspace projection updates
  - the currently scoped graph projection
- Existing user-visible graph behavior should stay unchanged:
  - commands still update the graph/workspace after success
  - scope changes still resolve to valid project/chapter selections
  - transient UI state such as editing menus, focus, and drafts remains local to React hooks/components
- `useGraphModel.ts` should bridge application snapshots into React state, but should stop owning projection refresh policy.

## Implementation shape

### Domain layer

- Keep `workspaceProjectorDefinition` as the workspace derivation entry point.
- Keep `graphProjectorDefinition` as the scoped graph derivation entry point.
- Keep compatibility wrappers such as `projectWorkspace(...)` and `projectGraph(...)` while migration is in progress.
- Keep `adaptModelGraphToRenderer(model: ModelGraph): RendererGraph` as the domain-to-renderer adapter boundary, but do not call it from React.

### Event-sourcing / application infrastructure

Add or use infrastructure for:

- sequenced projector instances
- catch-up from a `SpecEventStore`
- subscribing to appended sequenced events by `Query` on the store interface
- matching appended events against subscribed queries
- unsubscribing projector/read-model listeners
- lazy initial catch-up before first workspace delivery, scoped graph view creation, scope changes, or explicit bootstrap `refresh()`
- stale-result protection for async scoped graph changes

### Application layer

`graphProjectionService.ts` responsibilities:

- own workspace and scoped graph projector subscriptions
- perform initial catch-up and live catch-up
- convert domain graphs to `RendererGraph` snapshots via `adaptModelGraphToRenderer(...)`
- cache latest read-model snapshots only, not a full event mirror for normal operation
- manage read-model subscriptions
- keep projector query ownership explicit so `refresh()` can become compatibility/bootstrap-only

### Compatibility layer

`eventSourcedGraphModel.ts` remains temporarily but becomes a thinner facade that:

- delegates command execution to the existing router/application APIs
- delegates projection reads and scope changes to the projection service or scoped graph view
- consumes already adapted `RendererGraph` snapshots from that service
- stops directly rebuilding projections from ad-hoc event reads

### React hook layer

`useGraphModel.ts` should subscribe to:

- workspace snapshot updates
- one scoped graph view for the active project/chapter

It should continue owning only UI-transient state and command invocation glue.

## Test plan

### Projection infrastructure tests

Add focused tests for:

- initial projector catch-up from store
- live matching append notifications
- ignored non-matching append notifications
- repeated catch-up without double replay
- unsubscribe behavior
- stale async scope-change protection where applicable

### Projection service tests

Add/update focused tests for:

- initial catch-up produces workspace and graph snapshots from store events
- workspace subscribers receive current and updated workspace snapshots through event-driven updates
- scoped graph subscribers receive current and updated graph snapshots through event-driven updates
- changing scope asynchronously recomputes/resubscribes the graph view
- refreshing/bootstrap remains compatible while not being the normal command update path
- unsubscribe stops further notifications

### Graph model / facade tests

Update or add tests showing:

- `eventSourcedGraphModel.ts` no longer uses a temporary projection `MemoryStore`
- command methods still lead to updated snapshots after successful command execution and projector catch-up
- scope changes remain behaviorally equivalent

### React-facing tests

Add or update focused hook/application tests showing:

- `useGraphModel.ts` reacts to projection subscription updates
- React-facing code does not need direct store reads to observe command results
- command callbacks submit commands and projection changes flow back through subscriptions

### Validation

Use focused LLM-reporter tests first, then typecheck:

```sh
npm run test:llm --workspace=slicr-dcb -- graphProjectionService eventSourcedGraphModel useGraphModel
npm run typecheck --workspace=slicr-dcb
```

Broader validation can follow if needed.

## Deferred follow-up

- External live-store change observation if not covered by the first query subscription primitive
- Public checkpoint/catch-up APIs if another application consumer needs them
- Replacing `eventSourcedGraphModel.ts` entirely once the compatibility layer no longer adds value
- Consolidating projection snapshots into a more general application store only if multiple features demand it
