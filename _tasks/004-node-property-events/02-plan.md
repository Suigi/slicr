# Node Property Events Plan

## Summary

Persist node property editing in `apps/slicr-dcb` through event sourcing using two logical-node events: `NodeSchemaChanged` and `NodeExampleValuesChanged`. The UI can continue editing a combined `EditableProperty[]` shape through `PropertyEditor`, while event payloads keep schema and example values separate. Import/export must accept and emit these events with the rest of the graph event stream.

Before adding event persistence, fix two UI contract issues that affect persistence correctness:

- `PropertyGrid` should display a property's type (for example `: string`) when no example value is available. This is currently broken after adding a new property or removing an existing example value.
- `EditableProperty.id` must become required, and existing mockup/app data must provide stable IDs.

## Goals

- Fix property-grid/editor display semantics so properties without examples render their type fallback correctly.
- Investigate whether `value` is still needed in editable property data. If it is redundant, remove it from the editable property flow.
- Make editable property IDs required throughout the UI contract and update existing mockup data to include stable IDs.
- Persist the schema edited in the focused-node side panel.
- Persist example values edited in the same UI separately from schema structure.
- Replay persisted schema and examples from the event store into the focused-node `PropertyEditor`.
- Include the new events in JSON import/export validation and serialization.
- Debounce property editor persistence for 1 second after edits.
- Preserve `nodeId` as the logical node identifier.

## Non-Goals

- Do not introduce `nodeInstanceId` yet.
- Do not make examples instance-specific in v1.
- Do not change the visual graph layout model beyond adding property data needed by the side panel.
- Do not implement fine-grained property events such as `PropertyAdded` or `PropertyRenamed`.
- Do not redesign `PropertyEditor` or `PropertyGrid` to separate schema/examples internally.

## Core Rules

- `nodeId` refers to the shared logical node.
- Future visual/scenario-specific node occurrences will use a separate `nodeInstanceId` and are outside this feature.
- `NodeSchemaChanged` stores schema only; it must not persist example values.
- `NodeExampleValuesChanged` stores example values only; it must not persist schema fields such as names, types, optional/list settings, or nested structure.
- The editor-facing shape may combine schema and examples, but mapping functions must split that shape before appending events.
- Rehydration combines the latest schema and latest examples for a node into the `EditableProperty[]` shape expected by `PropertyEditor`.
- Scalar examples are persisted from `EditableProperty.example` and restored into `example`. Existing `value` usage should be investigated as part of the display-semantics bug fix; if redundant, remove it from the editable property flow.
- All persisted example values are stored as strings for v1, including examples for `number` and `boolean` typed properties. Do not coerce example strings to numeric or boolean runtime values.
- Persistence is debounced by 1 second after editor changes. Intermediate keystrokes should not append immediate events.
- When focus changes, import replaces the graph, or the side panel/editor unmounts before the debounce fires, flush pending property edits rather than discarding them.
- When the debounce/flush persists edits, append only events whose derived payload actually differs from the last projected payload. No-op edits append nothing.
- Import/export should treat the new events as first-class domain events. Import validation may ignore extra fields as long as the required fields are valid.
- New property events should be tagged only with `nodeId:<id>`.
- When `NodeRemoved` is replayed, projected schema and example values for that `nodeId` are removed with the node.

## Data Model

### Existing UI shape

`PropertyEditor` uses `EditableProperty[]`, including schema-like fields and example-like fields in the same objects. Relevant schema fields include:

- stable required property `id`
- `name`
- `type`
- nested `properties`
- `list`
- `optional`
- `generated`

Relevant example-value fields include:

- primitive `example`
- primitive list `exampleValues`
- object/list `rows`
- nested values associated with nested properties

### Event payloads

`NodeSchemaChanged` carries the complete schema for a logical node, stripped of example values:

```ts
export type NodePropertyId = string;

export type NodeSchemaChanged = {
  nodeId: NodeId;
  schema: NodePropertySchema[];
};

export type NodePropertySchema = {
  propertyId: NodePropertyId;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'Object';
  list?: boolean;
  optional?: boolean;
  generated?: boolean;
  properties?: NodePropertySchema[];
};
```

Rules:

- `propertyId` is required in persisted schema. The editor-facing `EditableProperty.id` must be required before this event mapping is implemented; event mapping should not depend on id-less editor properties.
- `properties` is used only for `Object` properties and contains nested schema definitions.
- Omit `list`, `optional`, and `generated` when they are false/undefined.
- This payload must not contain `value`, `example`, `exampleValues`, `rows`, or property tag metadata.

`NodeExampleValuesChanged` carries the complete example-value state for a logical node, stripped of schema definition data:

```ts
export type NodeExampleValuesChanged = {
  nodeId: NodeId;
  exampleValues: NodePropertyExampleValues[];
};

export type NodeExamplePrimitive = string | null;

export type NodeComplexExampleValue = Record<
  NodePropertyId,
  NodeExamplePrimitive | NodeComplexExampleValue
>;

export type NodePropertyExampleValues = {
  propertyId: NodePropertyId;
  scalarValue?: NodeExamplePrimitive;
  scalarListValues?: NodeExamplePrimitive[];
  complexValue?: NodeComplexExampleValue;
  complexListValues?: NodeComplexExampleValue[];
};
```

Rules:

- `propertyId` references a `NodePropertySchema.propertyId` from the same logical node schema.
- `scalarValue` stores a single primitive example string for a non-list primitive property.
- `scalarListValues` stores primitive example strings for a list primitive property.
- `complexValue` stores a single `Object` example. Its keys are nested `propertyId` values, and its values may be primitive example strings or recursively nested complex objects.
- `complexListValues` stores object-list examples. Each row is a `NodeComplexExampleValue` keyed by nested `propertyId`, not display name. Nested complex properties inside object rows are supported in v1.
- Missing entries mean “no examples for that property”.
- This payload must not contain property names, property types, `list`, `optional`, `generated`, property tag metadata, or nested schema definitions except through `propertyId` references.

Concrete event examples:

```ts
Events.nodeSchemaChanged('node-1', [
  {
    propertyId: 'prop-title',
    name: 'title',
    type: 'string',
    optional: true,
  },
  {
    propertyId: 'prop-lines',
    name: 'lines',
    type: 'Object',
    list: true,
    properties: [
      { propertyId: 'prop-sku', name: 'sku', type: 'string' },
      { propertyId: 'prop-quantity', name: 'quantity', type: 'number' },
    ],
  },
]);

Events.nodeExampleValuesChanged('node-1', [
  { propertyId: 'prop-title', scalarValue: 'Checkout completed' },
  {
    propertyId: 'prop-lines',
    complexListValues: [
      { 'prop-sku': 'ABC-123', 'prop-quantity': '2' },
    ],
  },
]);
```

Nested complex example:

```ts
Events.nodeExampleValuesChanged('node-1', [
  {
    propertyId: 'prop-customer',
    complexValue: {
      'prop-name': 'Alice',
      'prop-address': {
        'prop-city': 'Springfield',
      },
    },
  },
]);
```

## Algorithm Or Derivation Steps

1. When the graph model is loaded/replayed, project node schema and example events alongside nodes/edges.
2. For the focused node, derive editor properties by combining:
   - the latest schema for `focusedNode.nodeId`
   - the latest example values for `focusedNode.nodeId`
3. When `PropertyEditor.onChange` emits `EditableProperty[]`, update local UI state immediately so editing feels responsive.
4. Start or reset a 1 second debounce timer for persistence.
5. When the debounce fires, or when a pending debounce must be flushed because focus/import/unmount interrupts it:
   - derive the schema payload from the current editor properties
   - derive the example-values payload from the current editor properties
   - compare each payload with the latest projected payload for the same logical node
   - append only the changed `NodeSchemaChanged` and/or `NodeExampleValuesChanged` event(s)
6. Re-project the graph model after appending so stored events remain the source of truth.
7. Import/export serializes and validates the new event types along with existing events.

## Renderer Or Interaction Behavior

- The focused-node side panel remains open while a node is focused.
- The side panel continues to show the node title and a `Properties` section with `PropertyEditor`.
- Editing properties should not trigger canvas/node keyboard shortcuts.
- Property changes should appear immediately in the editor before the debounce persists them.
- After reload/import, focusing the same logical node should show the persisted schema and example values.

## Implementation Shape

- Fix `PropertyGrid`/`PropertyEditor` example-vs-type display behavior before wiring persistence.
- Make `EditableProperty.id` required in `packages/react-ui` and update `apps/slicr-dcb` mockup data to use stable IDs.
- Extend domain event types and factories in `src/domain/events.ts`.
- Extend domain graph model/projector state to retain node schemas and example values keyed by logical `nodeId`.
- Extend adapter/model types so `useGraphModel` can expose property editor data and persistence commands.
- Add mapping helpers between `EditableProperty[]`, schema payloads, and example-value payloads, including nested complex properties.
- Move App-level side-panel property state from purely local React state into `useGraphModel`/event-sourced model integration.
- Add debounce and flush handling at the hook/App boundary where `PropertyEditor.onChange` is wired.
- Extend import validation in `src/graph/importExport.ts` for the new event types.
- Keep existing graph node, edge, and layout behaviors unchanged.

## Test Plan

- Property grid/editor tests proving no-example properties display type fallback and that any redundant `value` usage is removed if feasible.
- Type/build and UI mockup tests proving `EditableProperty.id` is required and existing mockups provide stable IDs.
- Domain event factory tests for `NodeSchemaChanged` and `NodeExampleValuesChanged`.
- Projector tests proving schema and examples replay independently, latest event wins for each concern, and node removal removes projected property data.
- Mapping-helper tests proving schema payload excludes examples and example payload excludes schema-only fields, including nested complex object examples.
- Event-sourced graph model/hook tests proving property edits append debounced changed schema/example events only and flush pending edits on focus/import/unmount interruption.
- Import/export tests proving the new event types validate, serialize, import, and reject invalid required payloads while ignoring extra fields.
- App interaction test proving focused node side panel displays replayed persisted properties.

## Deferred Follow-Up

- Add `nodeInstanceId` and instance-specific example values.
- Add fine-grained property lifecycle events if audit/merge needs require them.
- Add undo/redo semantics for property edits.
- Decide how property tag metadata should be modeled and persisted.
- Add explicit migration for older combined property payloads if any are introduced during prototyping.
