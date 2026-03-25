# Data Integrity (Current Behavior)

This document captures the data integrity and `uses`-mapping behavior currently implemented in the codebase.

## Scope

Data integrity is currently enforced at parse time in `parseDsl` via:

1. Mapping application (`uses` / legacy `maps`)  
2. Data integrity validation warnings

Main code paths:

- `src/domain/parseDsl.ts`
- `src/domain/dataMapping.ts`
- `src/domain/dataIntegrity.ts`
- `src/domain/dataTrace.ts`

## DSL Keywords

- `uses:` is the active keyword.
- `maps:` is still accepted for backwards compatibility in parsers/autocomplete/migration paths.

## Mapping Resolution (`uses`)

Mappings are parsed and applied per target node.

- Shorthand:
  - `alpha` => target key `alpha`, source path `alpha`
- Explicit path:
  - `id <- $.things[0].id`
- Context/nesting in `uses:` is supported by indentation context parsing in `parseUsesBlocks`.

### Source lookup strategy

For each target mapping key:

1. Iterate direct predecessors of target node in edge order.
2. Resolve source path against each predecessor.
3. Take the first predecessor with a resolved value.
4. If none resolve, set target key value to `<missing>` and emit warning.

## Supported Source Path Types

### 1. Dot/key paths (existing behavior)

- `alpha`
- `thing.id`

### 2. JSONPath (when source path starts with `$`)

- `$.things[0].id`
- `$.concerts[?(@.selected==true)].id`

JSONPath evaluation is delegated to `jsonpath-plus`.

Behavior:

- First matched value is used.
- No matches or invalid JSONPath => unresolved (`<missing>` + warning), no throw.

## `collect(...)` Aggregation

Supported syntax:

```dsl
uses:
  rooms <- collect({ room-number, capacity })
```

Also supports `$` refs inside collect field list:

```dsl
uses:
  rooms <- collect({ $.room.id, capacity })
```

Behavior:

- Iterates direct predecessors in edge order.
- Builds one object per predecessor.
- Includes predecessor only if **all** collect fields resolve.
- Preserves order and duplicates.
- Returns array (possibly empty).

## `data` vs `uses` Precedence

If a key exists in both `data:` and `uses:`:

- `data` value wins (for rendered node data).
- Mapping for that key is skipped.
- Warning emitted:
  - `Duplicate data key "<key>" in node <nodeRef> (declared in both data and uses)`

## Missing Source Behavior

If a `uses` key cannot be resolved from any direct predecessor:

- Target data key is still materialized with value `<missing>`
- Warning emitted:
  - `Missing data source for key "<key>"`

UI rendering:

- `<missing>` values are rendered in node data panel.
- Missing lines are visually marked red.

## Integrity Validation Rules

Integrity pass checks target node `data` keys against predecessor-supplied keys, with exceptions:

- Keys in `mappedDataKeys` are treated as satisfied by `uses`.
- Keys with value `<missing>` are skipped in this pass (already captured by mapping warning).

This avoids duplicate/incorrect warnings for keys that were successfully mapped via `uses`.

## Data Trace Rules

Data Trace follows `uses` mappings backwards and currently supports:

- direct key/dot paths
- JSONPath source paths
- collect-backed keys (e.g. `things <- collect(...)`) as concrete resolved values

For JSONPath paths, root-key extraction is used to determine whether predecessor values are mapped vs direct.

## Warning Presentation

- Gutter warning tooltip supports multiple warnings per line.
- Multiple warnings are rendered as separate lines with horizontal separators.

## Known Limitations / Not Yet Implemented

- `collect` currently supports shorthand field refs, not full alias object syntax like `{ id: room-number }`.
- Cross-slice contract checks are partially present (`crossSlice*` domain code), but no dedicated end-to-end producer/consumer schema contract workflow for reusable read models is finalized.
- No explicit DSL construct yet for user-entered/local-only fields (e.g. form inputs) separate from predecessor/mapped fields.

## Suggested Next Extension Points

1. Add explicit input/source annotations for node-local fields (likely `inputs:`).
2. Extend `collect` grammar for aliased object fields.
3. Expand cross-slice `data`/`uses` compatibility checks for reusable read model contracts.
