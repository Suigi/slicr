# Node Property Events Tasks

## Feature Description
Persist focused-node property editor data through event sourcing using separate schema and example-value events. Before persistence work, fix property-grid/editor value semantics and require stable property IDs. See [02-plan.md](./02-plan.md).

## Workflow

Tasks should move through these status values in order:

* `[created]`: the task was described, but no work was done to implement it
* `[started]`: an agent sets this status before starting to work on a task
* `[done]`: an agent sets this status once a task is completed

**IMPORTANT**: Only **ONE** (1) task should be in the `[started]` status at a time.
Agents must update the task file as they work: set a task to `[started]` immediately before implementation begins, and set it to `[done]` as soon as that task is complete.

## Learnings

Add any learnings about the feature to ./tasks/<feature-name>-learnings.md.
Add any learnings about the project overall to the documents in the ./knowledge directory.

## Task 1: Fix no-example property display semantics
### Status
[done]

### Description
Fix the current `PropertyGrid`/`PropertyEditor` behavior where a property without an example can render as blank instead of displaying its type fallback, such as `: string`. Investigate whether the separate editable `value` field is still needed; if it is redundant, remove it from the editable property flow.

### Acceptance Criteria
* Adding a new property with no example causes `PropertyGrid` to display the property type fallback rather than a blank value.
* Removing an existing example value causes `PropertyGrid` to display the property type fallback rather than a blank value.
* Tests document the intended distinction between editable examples and type fallback display.
* If `value` is not needed for editable properties, it is removed from the editable property flow and affected mockups/tests are updated.

### Dependencies
* None

### Notes
* `PropertyEditor` currently edits scalar examples through `example`.
* `PropertyGrid` currently prefers `value` when present, otherwise falls back to `example`; this should be revisited as part of this task.

## Task 2: Require stable editable property ids
### Status
[created]

### Description
Make `EditableProperty.id` required and update existing property editor/property grid mockup data to provide stable IDs.

### Acceptance Criteria
* The exported `EditableProperty` type requires `id: string`.
* App-level mockup data and relevant tests provide stable IDs for top-level and nested editable properties.
* `PropertyEditor` no longer has to treat valid editable properties as id-less data during normal editing.
* Type/build coverage fails if editable properties are created without IDs.

### Dependencies
* Task 1

### Notes
* Existing UI data in `apps/slicr-dcb/src/App.tsx` includes id-less mockup properties and must be updated.
* Stable IDs are required before event mapping can safely persist property references.

## Task 3: Add property event contracts
### Status
[created]

### Description
Extend the slicr-dcb domain event contract with `NodeSchemaChanged` and `NodeExampleValuesChanged` factory functions, payload types, tags, and import/export validation support.

### Acceptance Criteria
* `Events.nodeSchemaChanged(...)` creates a tagged `NodeSchemaChanged` event for a logical `nodeId` with a `schema: NodePropertySchema[]` payload matching the concrete schema in `02-plan.md`.
* `Events.nodeExampleValuesChanged(...)` creates a tagged `NodeExampleValuesChanged` event for a logical `nodeId` with an `exampleValues: NodePropertyExampleValues[]` payload matching the concrete schema in `02-plan.md`.
* New property events use only the `nodeId:<id>` tag.
* `parseImportEvents` accepts valid new events, ignores extra payload fields, and rejects invalid required payloads.
* `serializeDomainEvents` can export streams containing the new events unchanged.

### Dependencies
* Task 2

### Notes
* Keep payloads separated: schema event payloads must not require examples, and example event payloads must not require schema structure beyond references needed to store values.
* Property tag metadata is out of scope for this feature.
* Example primitive values are strings or null; do not coerce number/boolean typed examples.

## Task 4: Project schemas and examples separately
### Status
[created]

### Description
Extend the domain graph projection and renderer graph adaptation so replayed models retain the latest schema and latest example values per logical node id.

### Acceptance Criteria
* Replaying `NodeSchemaChanged` stores schema for the target `nodeId` without changing example values.
* Replaying `NodeExampleValuesChanged` stores example values for the target `nodeId` without changing schema.
* When multiple events of the same kind exist for a node, the latest event wins for that concern.
* Replaying `NodeRemoved` removes projected schema and example values for that `nodeId`.
* Existing node/edge projection behavior remains unchanged.

### Dependencies
* Task 3

### Notes
* Do not introduce `nodeInstanceId` in this task.

## Task 5: Split and merge editor property data
### Status
[created]

### Description
Add focused mapping helpers that convert combined `EditableProperty[]` editor data into separate schema/example payloads and merge projected schema/example data back into editor properties.

### Acceptance Criteria
* Schema derivation produces `NodePropertySchema[]` and excludes primitive examples, example lists, and object example rows.
* Example derivation produces `NodePropertyExampleValues[]` and excludes schema-only fields such as names, types, optional/list/generated settings except for `propertyId` references.
* Primitive examples are stored as strings/null, including examples for `number` and `boolean` typed properties.
* Merging schema and example payloads recreates the `EditableProperty[]` shape needed by `PropertyEditor`, restoring scalar examples into `example`.
* Nested complex properties and list examples are covered by tests.

### Dependencies
* Task 3

### Notes
* Use stable property ids rather than property names when associating examples.
* Support nested complex properties in v1.

## Task 6: Persist focused node property edits with debounce
### Status
[created]

### Description
Wire the focused-node side panel property editor to the event-sourced graph model so edits update the UI immediately and append separated schema/example events after a 1 second debounce.

### Acceptance Criteria
* Editing properties in the side panel updates the visible editor immediately.
* No schema/example event is appended before the 1 second debounce expires.
* After the debounce expires, only changed schema and/or example payloads are appended as `NodeSchemaChanged` and/or `NodeExampleValuesChanged` events for the focused logical `nodeId`.
* No-op edits append no property events.
* Pending edits flush rather than being discarded when focus changes, import replaces the graph, or the editor/side panel unmounts before the debounce expires.
* Replayed persisted properties appear when the same node is focused again or after model reload.

### Dependencies
* Task 4
* Task 5

### Notes
* Preserve the existing behavior that property editor keyboard events do not trigger canvas/node shortcuts.

## Task 7: Show imported and exported persisted properties in App flow
### Status
[created]

### Description
Verify the full App-level flow across import/export and the focused-node side panel: imported property events populate the editor, and exporting includes saved property events.

### Acceptance Criteria
* Importing a stream with `NodeSchemaChanged` and `NodeExampleValuesChanged` makes the focused node side panel show the merged properties.
* Exporting after a debounced property edit includes the new property events in the serialized stream.
* Existing node creation, rename, connection, and deletion flows continue to work.

### Dependencies
* Task 6

### Notes
* Keep this task focused on integration/regression coverage, not new event semantics.
