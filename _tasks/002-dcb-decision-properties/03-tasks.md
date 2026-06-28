# DCB Decision Properties Tasks

## Feature Description

Add composable DCB-style decision properties to `packages/event-sourcing`, as described in [02-plan.md](./02-plan.md). The feature lets command handlers compose reusable query/reducer property definitions into one query and one typed decision model.

## Workflow

Tasks should move through these status values in order:

* `[created]`: the task was described, but no work was done to implement it
* `[started]`: an agent sets this status before starting to work on a task
* `[done]`: an agent sets this status once a task is completed

**IMPORTANT**: Only **ONE** (1) task should be in the `[started]` status at a time.
Agents must update the task file as they work: set a task to `[started]` immediately before implementation begins, and set it to `[done]` as soon as that task is complete.

## Learnings

Add any learnings about the feature to ./05-learnings.md.
Add any learnings about the project overall to the documents in the ./_knowledge directory.

## Task 1: Compose queries
### Status
[created]

### Description
Add a query composition helper in `packages/event-sourcing` that combines multiple `Query` values using the rules from the plan while preserving existing `Query` semantics.

### Acceptance Criteria
* Combining only `Query.none()` values returns `Query.none()`.
* Combining specific `items` queries returns one `items` query with all query items in order.
* Combining any query with `Query.all()` returns `Query.all()`.
* Existing `MemoryStore` query behavior remains unchanged.

### Dependencies
* None

### Notes
* Do not add store revision or conditional append behavior in this task.

## Task 2: Define decision property composition
### Status
[created]

### Description
Add the `DecisionProperty` abstraction, the typed decision-model derivation, and a `composeDecisionProperties` helper that returns existing-handler-compatible `query` and `project` functions.

### Acceptance Criteria
* A property can define `name`, `query`, `initial`, and `reduce`.
* Composing two properties produces one command-derived query using Task 1 behavior.
* Projecting an event list produces an object with one key per property name.
* Each property reduces over the queried event list independently.

### Dependencies
* Task 1

### Notes
* Keep the API additive and compatible with existing `Handler.create`.
* Preserve useful TypeScript inference for readonly `as const` property arrays.

## Task 3: Add property-based handler factory
### Status
[created]

### Description
Add a `Handler.createWithProperties` API that accepts a store, a readonly property list, and a `decide` function, then delegates to the existing command-handler flow with composed query and projection functions.

### Acceptance Criteria
* A handler created with `createWithProperties` queries the store through the composed property query.
* The handler passes the composed decision model to `decide`.
* Emitted events are appended to the store and returned, matching existing `Handler.create` behavior.
* Existing `Handler.create` behavior and tests remain unchanged.

### Dependencies
* Task 2

### Notes
* Do not change the existing `CommandHandler` return shape.
* Do not make command handling async.

## Task 4: Export and document the public API through tests
### Status
[created]

### Description
Export the new decision-property API from `packages/event-sourcing/src/index.ts` and add an end-to-end test using a realistic multi-property ticket-booking-style example.

### Acceptance Criteria
* Public imports from `@slicr/event-sourcing` can access the new property and composition APIs.
* A test demonstrates composing an available-seats property with a bundle-tickets-remaining property.
* The example handler rejects insufficient state and emits events when both properties allow the command.
* The test suite for `packages/event-sourcing` passes.

### Dependencies
* Task 3

### Notes
* Keep the example small and focused on API behavior, not domain completeness.
* Do not include DCB conditional append/revision behavior in the example.
