# Event Sourcing Separation Guidelines

These notes capture the desired direction for `apps/slicr-editor` and related `@slicr/event-sourcing` abstractions.

## Core rule

React components should not know about domain events or event stores.

React should:

- render projections/read models
- keep UI-only transient state, e.g. focus, menus, edit drafts
- issue commands

React should not:

- import `DomainEvent`, `Events`, or `@slicr/event-sourcing` primitives directly
- construct events
- query or append to event stores
- make domain decisions based on event history

## Desired flow

```txt
React/UI
  -> issues command
Application layer/router
  -> routes command to decider
  -> queries async DCB event store
  -> builds decision model from queried events
  -> asks decider which events to emit
  -> appends emitted events with DCB append condition
  -> refreshes projections/read models
React/UI
  -> renders updated projection
```

## Layer responsibilities

### Domain layer

The domain layer owns:

- command types
- event types and event constructors
- deciders: `query -> project -> decide`
- read/decision projections
- domain invariants

Domain deciders should be store-free. They should not append to a store themselves.

Preferred shape:

```ts
type Decider<Command, Event, DecisionModel> = {
  query(command: Command): Query;
  project(events: readonly Event[]): DecisionModel;
  decide(command: Command, decisionModel: DecisionModel): readonly Event[];
};
```

### Application layer

The application layer owns:

- real async/spec event store instances
- routing commands to the correct decider
- executing the DCB loop via `handleCommand`
- conditional appends
- loading and refreshing projections
- import/export orchestration

This is the right place for a command router/dispatcher.

### UI layer

The UI layer owns:

- rendering read models
- layout/measurement concerns
- focus and selection
- edit drafts and menus
- invoking application commands

UI hooks may expose convenient command functions, but those functions should still delegate to application services rather than creating events directly.

## Event ownership and projection refresh

The event store is the source of truth for events.

No component should keep its own authoritative list of events outside of the event store. Events may be read from the store to build projections, but they should not be mirrored and manually extended elsewhere.

Avoid patterns like:

```ts
events = [...events, ...appendedEvents];
project(events);
```

Instead, after executing a command, application services should refresh read models/projections from the store:

```ts
await commandRouter.execute(command);
await refreshProjectionsFromStore();
```

where projection refresh reads sequenced events from the store and derives read models:

```ts
const events = (await store.read()).map(({event}) => event);
workspace = projectWorkspace(events);
graph = projectGraph(events, scope);
```

This preserves the invariant that the store owns events and application/UI-facing services own projections. If performance becomes a concern, introduce an explicit projection service or store-backed subscription/change feed that tracks projection state and sequence positions. Do not replace this with ad-hoc duplicated event lists in React hooks, graph models, or other application components.

## Deciders vs old command handlers

The older `Handler.create(...)` style takes a synchronous `Store` and performs `query -> project -> decide -> append` internally. This is useful for simple tests, but it hides the append step and does not directly model the async DCB store.

The newer decider style separates the pure domain decision from storage:

```txt
Decider: query/project/decide only
Application handleCommand: query async store, decide, conditional append
```

For new code, prefer deciders.

For migration, convert one command at a time:

1. Add a store-free decider for the command.
2. Test it with `expectDecider` from `@slicr/event-sourcing/testing`.
3. Route that command through the application layer using `handleCommand`.
4. Remove direct `Events.*` construction from application/UI code for that behavior.

## DCB append condition

When executing a decider against a spec event store, the important DCB guard is:

1. Query the decision slice.
2. Remember the highest sequence position read.
3. Decide emitted events.
4. Append only if no events matching the decision query appeared after that position.

Conceptually:

```ts
const query = decider.query(command);
const sequencedEvents = await store.query(query);
const decisionModel = decider.project(sequencedEvents.map((e) => e.event));
const eventsToEmit = decider.decide(command, decisionModel);

await store.append(eventsToEmit, {
  failIfEventsMatch: query,
  after: lastSeenPosition,
});
```

This keeps command decisions consistent with the event slice they were based on.

## Testing guidance

Use:

- `expectHandler` for legacy synchronous command handlers
- `expectDecider` for new store-free deciders

Prefer `expectDecider` for new command logic.

Example style:

```ts
await expectDecider(addProjectDecider({generateUuid}))
  .given()
  .when({name: 'New Project'})
  .thenEmits(Events.projectAdded('project-1', 'New Project'), Events.chapterAdded('project-1', 'chapter-1', 'Chapter 1'));
```

## Current migration direction for `slicr-editor`

Good next targets:

1. Convert `addProject` to a decider.
2. Add an application command router initialized with the async DCB store.
3. Route `AddProject` through `handleCommand`.
4. Then migrate `renameProject`.
5. Then migrate graph mutations currently creating events directly in `eventSourcedGraphModel.ts`.

Avoid large rewrites. Keep each step behavior-preserving and test-driven.
