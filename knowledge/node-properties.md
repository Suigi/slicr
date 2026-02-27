# Node Properties and Identity (Current Behavior + Guardrails)

This document captures how node properties are produced and consumed in the current codebase, and defines the identity rule that should guide analysis features.

## Core Principle

Use the right identity for the right job:

- `node.key` is instance identity. Use it for execution/instance-specific analysis such as data trace, integrity warnings, and per-node issue correlation.
- `type:name` (and derived analysis refs) is semantic identity. Use it only for intentional grouping (for example top-level version aggregation in UI summaries).

Do not use `type:name` to correlate scenario node instances, because multiple scenario nodes can share `type:name` while representing different concrete nodes.

## Node Property Inventory

Node shape (`VisualNode`) is defined in `src/domain/types.ts` and includes:

- `key`: runtime-unique node key used in edges/layout/rendering.
- `type`: artifact type (`rm`, `cmd`, `evt`, `exc`, `ui`, `aut`, `ext`, `generic`).
- `name`: semantic node name from DSL reference.
- `alias`: display label when present.
- `stream`: optional stream label for events.
- `data`: merged/materialized node data.
- `mappedDataKeys`: keys materialized from `uses`.
- `outboundMappedDataKeys`: predecessor-facing mapped key tracking.
- `srcRange` and `dataKeyRanges`: source mapping for editor highlighting/warnings.

## Parse-Time Keying Model

`parseDsl` builds nodes from DSL specs and assigns keys with two different strategies:

- Top-level nodes:
  - deduped by semantic ref (`type:name`) through `refToKey`
  - key chosen by `pickNodeKey` (name, typed name, then suffix)
- Scenario nodes:
  - always assigned a unique scenario key via `pickScenarioNodeKey`
  - fallback format: `scn:<line>:<type>:<name>`
  - never registered into `refToKey`

Implication:

- Scenario entries can share `type:name` with top-level nodes but must remain distinct by `key`.
- Edges are resolved via `refToKey`, so scenario-only declarations do not redefine top-level dependency graph identities.

## Mapping and Trace Correlation Model

`uses` mappings are parsed from top-level node declarations (`parseUsesBlocks`) and keyed by semantic ref (`type:name`).

That is valid for top-level mapping authoring, but downstream consumers must apply mappings to concrete nodes carefully:

- Safe: use semantic ref to discover mapping definitions.
- Unsafe: collapse concrete node instances by semantic ref when producing node-specific analysis output.

For node-specific analysis (trace/issues/warnings), correlation target should be concrete `node.key`.

## Analysis Ref Grouping

Node analysis grouping currently uses `toNodeAnalysisRef*`:

- strips `@<version>` suffixes
- groups by semantic `type:name`

This is useful for showing top-level versions together, but it is not sufficient for scenario instance analysis.

Guideline:

- Keep semantic grouping for summary/navigation.
- Preserve instance-level results by `node.key` inside each grouped view.

## Scenario-Specific Guardrails

When scenarios are present:

- Never assume `type:name` uniquely identifies a node instance.
- Never attach missing/ambiguous data warnings to a node chosen only by semantic ref when multiple concrete nodes match.
- Never reuse trace path resolution state across different `node.key` instances just because `type:name` matches.

## Practical Decision Matrix

- Layout, render, hover, selection, edge traversal: use `node.key`.
- Data trace hop identity and cycle guards: use `node.key`.
- Data issue ownership and quick-fix targeting: use `node.key`.
- Cross-version grouping in panel headers: use semantic ref (`type:name` minus version suffix).
- Parser-level unresolved dependency resolution: semantic refs are acceptable as an intermediate, but emitted/runtime node identity should still be concrete `key`.

## Known Risk Pattern

A common bug shape is:

1. Build a map keyed by `type:name`.
2. Insert multiple concrete nodes with same semantic ref.
3. Last write wins.
4. Trace/issues/warnings appear on the wrong instance (or as false positives).

Avoid this by storing `Map<nodeKey, ...>` for concrete analysis and using semantic refs only as optional grouping indexes.
