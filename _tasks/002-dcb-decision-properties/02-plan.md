# DCB Decision Properties Plan

## Summary

Add DCB-style composable decision properties to `packages/event-sourcing` as an additive API. A decision property packages the query and reducer for one reusable piece of decision state. Command handlers can compose multiple properties and receive a typed decision model whose keys correspond to the selected property names.

This feature keeps the existing `Handler.create` API unchanged and adds a new path for handlers that want reusable decision-property composition.

## Goals

- Define a reusable `DecisionProperty` abstraction with:
  - a stable property name
  - a command-derived query
  - a command-derived initial state
  - an event reducer
- Compose multiple decision properties into:
  - one query used to load all relevant events
  - one decision model object with one state value per property
- Add a handler API that accepts decision properties directly, likely `Handler.createWithProperties`.
- Preserve TypeScript inference so `decide` receives named model properties, e.g. `model.availableSeats`.
- Keep all existing event sourcing behavior and tests compatible.

## Non-Goals

- Do not replace or remove `Handler.create`.
- Do not redesign `Store`, `Event`, or `Query` beyond small additive helpers needed for composition.
- Do not introduce async behavior.
- Do not introduce event envelopes into the handler API.
- Do not build a production DCB event store.

## Explicitly Out Of Scope: DCB Consistency Boundary

The following option 2 behavior is intentionally out of scope for this feature:

- Extending `Store` with query revision tokens.
- Adding `queryWithRevision` or equivalent APIs.
- Adding conditional append APIs such as `appendIfUnchanged`.
- Making command handling fail when events matching the composed decision query appear between read and append.
- Implementing query-specific conflict detection in `MemoryStore`.

This feature should make decision properties composable, but it should continue using the current `store.query(...)` followed by `store.append(...)` flow.

## Core Rules

1. A decision property owns exactly one named state value in the composed decision model.
2. A decision property query may depend on the command.
3. A decision property initial state may depend on the command.
4. A decision property reducer receives the current property state, one event, and the command.
5. Multiple property queries are composed using OR semantics, matching the current `Query.anyOf` behavior.
6. If any composed query is `Query.all()`, the composed query is `Query.all()`.
7. `Query.none()` contributes no query items when composed with other specific queries.
8. If all composed queries are `Query.none()`, the composed query is `Query.none()`.
9. Each property reduces over the same queried event list and ignores irrelevant events in its reducer.
10. Existing handlers created with `Handler.create` must behave exactly as before.

## Data Model

Add a decision property type similar to:

```ts
export type DecisionProperty<
  Name extends string,
  Command,
  EventType extends Event,
  State
> = {
  readonly name: Name;
  query(command: Command): Query;
  initial(command: Command): State;
  reduce(state: State, event: EventType, command: Command): State;
};
```

Add a mapped type that derives the composed decision model from a readonly tuple of properties:

```ts
export type DecisionModelFromProperties<
  Properties extends readonly DecisionProperty<string, any, any, any>[]
> = {
  [Property in Properties[number] as Property['name']]:
    Property extends DecisionProperty<string, any, any, infer State>
      ? State
      : never;
};
```

The exact generic constraints can be adjusted during implementation to satisfy TypeScript, but the observable API should preserve property-name inference for `as const` property arrays.

## Algorithm Or Derivation Steps

### Query Composition

Given a readonly list of `Query` values:

1. If any query is `all`, return `Query.all()`.
2. Ignore `none` queries.
3. Collect all items from `items` queries in order.
4. If the collected item list is empty, return `Query.none()`.
5. Otherwise return an `items` query containing the collected items.

The order of query items should follow property order, then item order within each property query.

### Decision Model Projection

Given a property list, queried events, and command:

1. Create an empty object.
2. For each property in declaration order:
   - start with `property.initial(command)`
   - reduce every queried event through `property.reduce(state, event, command)`
   - assign the final state to `model[property.name]`
3. Return the model.

## Renderer Or Interaction Behavior

Not applicable. This feature is library/API behavior in `packages/event-sourcing` and has no UI rendering or interaction changes.

## Implementation Shape

Additive implementation in `packages/event-sourcing/src`:

- Add decision-property types and composition helpers.
  - Either in a new `decisionProperty.ts` file or in `handler.ts` if the implementation remains small.
- Add `combineQueries` helper.
  - Prefer exporting it if tests or callers benefit from direct use.
- Add `composeDecisionProperties(properties)` helper returning `{ query, project }` compatible with existing `Handler.create` config shape.
- Add `Handler.createWithProperties(config)` that delegates to existing `createCommandHandler` after composing the properties.
- Export the new public API from `src/index.ts`.

The preferred handler shape is:

```ts
Handler.createWithProperties({
  store,
  properties: [availableSeats, bundleTicketsRemaining] as const,
  decide: (command, model) => {
    // typed model.availableSeats
    // typed model.bundleTicketsRemaining
    return events;
  },
});
```

## Test Plan

Add focused tests in `packages/event-sourcing/src` proving:

- `combineQueries` preserves current OR semantics and handles `all` / `none`.
- `composeDecisionProperties` builds a model with multiple property states from one event list.
- A command handler using `createWithProperties` queries, projects, decides, appends, and returns emitted events.
- Property state names are usable from the decision model in TypeScript-level handler code.
- Existing handler tests still pass unchanged.

## Deferred Follow-Up

A later feature can add true DCB consistency semantics by extending stores with query revisions and conditional append. That follow-up should build on the composed query produced by this feature, so the consistency boundary naturally covers all selected decision properties.
