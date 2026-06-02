# Sequence Position Learnings

- DCB does not require client-provided Event IDs.
- A DCB Event must contain:
  - event type
  - event data
  - tags
- An Event may contain extra client-defined fields or metadata, so Event IDs are allowed but not part of the core consistency mechanism.

## Sequence Position

- The Event Store assigns a Sequence Position when an event is appended.
- A Sequence Position must be unique within the Event Store.
- A Sequence Position must be monotonically increasing.
- A Sequence Position may contain gaps.

## Sequenced Events

Reads should return Sequenced Events, not just raw Events:

```ts
type SequencedEvent = {
  event: Event;
  position: SequencePosition;
};
```

The position is important because DCB append conditions depend on what the client had already observed.

## Reading after a position

The spec does not describe querying after an Event ID.

Instead, it says an Event Store should support reading from a starting Sequence Position, for example:

```ts
type ReadOptions = {
  from?: SequencePosition;
};
```

## Append conditions

Append conditions use a Sequence Position too:

```ts
type AppendCondition = {
  failIfEventsMatch: Query;
  after?: SequencePosition;
};
```

If `after` is present, the Event Store ignores events at or before that position when checking the condition. This lets a client say: "fail if anything matching this query was appended after the state I observed."
