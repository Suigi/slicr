# DCB Tag Strategy Ideas

## Context

DCB events have immutable tags. Tags should be used for stable relevance and custom partitioning, not as mutable state. Queries match events by event type and/or tags; tags within a query item are AND-ed, while query items are OR-ed.

## Project partitioning

Use a project tag as the primary logical partition:

```text
project:<projectId>
```

If there is a higher-level tenant/account boundary, also include:

```text
tenant:<tenantId>
project:<projectId>
```

Every project-scoped event should include the project tag.

## Entity identity tags

Use stable entity identity tags for narrow decision models:

```text
project:pr_123
chapter:ch_456
node:nd_789
```

Examples:

- `ChapterCreated` gets `project:<id>`, `chapter:<id>`
- `NodeCreated` gets `project:<id>`, `node:<id>`
- `NodeRenamed` gets `project:<id>`, `node:<id>`

This allows commands that only need one node to query only that node's events instead of all node events in the store.

## Relationship modeling

For Projects -> Chapters -> Nodes, avoid putting a `chapter:<id>` tag on every `Node*` event merely because the node is currently assigned to that chapter. That would treat an immutable tag as mutable state.

Instead, model assignment as relationship events:

```text
NodeAssignedToChapter
NodeMovedToChapter
NodeRemovedFromChapter
```

Relationship events should include both the node and affected chapters:

```text
project:pr_123
node:nd_789
chapter:ch_old
chapter:ch_new
```

A move event tagged with both chapters means the event is historically relevant to both chapters, not that the node is permanently assigned to either one.

## Stable relevance, not current ownership

Good tag meaning:

```text
chapter:ch_123
```

means: this event is relevant to chapter `ch_123`.

Avoid tag meanings like:

```text
current-chapter:ch_123
```

because tags are immutable and cannot represent mutable current state.

## Chapter-scoped node-name uniqueness

If node names must be unique within a chapter, do not query all `NodeRenamed` events globally.

Instead, tag events that affect name availability in a chapter with both the chapter and normalized name:

```text
project:<projectId>
chapter:<chapterId>
node-name:<normalizedName>
```

This is an application-level pattern, not a named DCB spec concept. It follows from DCB's tag + append-condition mechanics.

## Renaming an assigned node

If a node is assigned to a chapter and renaming it affects chapter-scoped uniqueness, the rename event should include the relevant chapter/name tags at that time:

```text
project:pr_123
node:nd_789
chapter:ch_456
node-name:old-name
node-name:new-name
```

Example event data:

```json
{
  "nodeId": "nd_789",
  "chapterId": "ch_456",
  "oldName": "Checkout",
  "oldNormalizedName": "checkout",
  "newName": "Payment",
  "newNormalizedName": "payment"
}
```

The chapter tag means the rename affected name availability in that chapter at that time.

## Moving a node into a chapter

A `MoveNodeToChapter` decision model usually needs:

1. The node's own history, to know current name and current chapter.
2. The target chapter/name history, to know whether that name is available.

Queries:

```json
{
  "items": [
    { "tags": ["project:pr_123", "node:nd_789"] }
  ]
}
```

and:

```json
{
  "items": [
    { "tags": ["project:pr_123", "chapter:ch_456", "node-name:checkout"] }
  ]
}
```

Append condition should cover both consistency boundaries:

```json
{
  "failIfEventsMatch": {
    "items": [
      { "tags": ["project:pr_123", "node:nd_789"] },
      { "tags": ["project:pr_123", "chapter:ch_456", "node-name:checkout"] }
    ]
  },
  "after": 12345
}
```

This catches:

- the node being renamed concurrently
- the node being moved concurrently
- another node taking the same name in the target chapter
- target chapter/name availability changing concurrently

## General recommendations

- Include `project:<id>` on every project-scoped event.
- Include stable entity identity tags such as `node:<id>` and `chapter:<id>`.
- Use relationship events for mutable relationships.
- Tag relationship events with all entities they are historically relevant to.
- Use normalized value tags for scoped uniqueness checks, e.g. `node-name:<normalizedName>`.
- Include the project tag in every query item to avoid accidental cross-project matches.
- Remember that query items are OR-ed; tags inside a query item are AND-ed.
