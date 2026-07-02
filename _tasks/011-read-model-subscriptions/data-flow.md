# Event-driven read-model data flow

```mermaid
sequenceDiagram
    actor User
    participant RC as React Component
    participant RH as React Hook / Callback
    participant APP as Graph Application
    participant CR as Command Router
    participant DEC as Decider
    participant ES as Event Store
    participant QS as Query Subscriptions
    participant WP as Workspace Projector
    participant GP as Scoped Graph Projector
    participant PS as Projection Service

    User->>RC: Trigger UI action
    RC->>RH: Invoke callback
    RH->>APP: Submit intent / command request
    APP->>CR: route(command)

    CR->>DEC: query(command)
    DEC-->>CR: required event query
    CR->>ES: query(required event slice)
    ES-->>CR: matching sequenced events

    CR->>DEC: project(command, events)
    DEC-->>CR: decision model
    CR->>DEC: decide(command, decision model)
    DEC-->>CR: emitted events

    CR->>ES: append(emitted events, append condition)
    ES-->>CR: appended sequenced events
    CR-->>APP: command accepted / completed
    APP-->>RH: command promise resolves

    ES-->>QS: publish appended sequenced events
    QS->>QS: match events against subscribed projector queries

    QS-->>WP: notify matching workspace events
    WP->>WP: catch up from last applied position
    WP-->>PS: workspace projection changed

    QS-->>GP: notify matching graph events
    GP->>GP: catch up from last applied position
    GP-->>PS: scoped graph projection changed

    PS-->>RH: notify read-model subscribers
    RH-->>RC: update React state from projections
    RC-->>User: render updated workspace / graph
```

## Design notes

- React never subscribes to raw domain events.
- React invokes callbacks that submit commands; projection updates flow back through read-model subscriptions.
- Projectors own their event `Query` and use it for both initial catch-up and live update matching.
- The event store remains the source of truth; projection service state is derived and disposable.
- Scoped graph projectors are recreated or resubscribed when their requested scope changes.
- `refresh()` becomes a compatibility/bootstrap concern rather than the normal update path.
- If `setScope(...)` must query/catch up a new scoped projector, it should become async or notify via subscription once the new projection is ready.
