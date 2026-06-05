# Slicr Events

This document lists the domain events currently implemented by `apps/slicr-dcb`.

## NodeAdded

Adds a node to the graph if a node with the same `nodeId` does not already exist.

Payload:

- `nodeId`: the id of the node to add.
- `type`: the node type (`ui`, `cmd`, `evt`, `rm`, `dm`, or `processor`).
- `laneId`: the numeric lane/order where the node belongs.
- `label`: the node title shown in the graph.

Tags:

- `nodeId:<nodeId>`
- `type:<type>`

## NodeRenamed

Changes the label/title of an existing node. If the node does not exist, replay ignores the event.

Payload:

- `nodeId`: the id of the node to rename.
- `newName`: the new label/title for the node.

Tags:

- `nodeId:<nodeId>`

## NodeRemoved

Removes a node from the graph and also removes any edges connected to that node.

Payload:

- `nodeId`: the id of the node to remove.

Tags:

- `nodeId:<nodeId>`

## NodeTypeChanged

Changes the type of an existing node. If the node does not exist, replay ignores the event.

Payload:

- `nodeId`: the id of the node whose type should change.
- `newType`: the new node type (`ui`, `cmd`, `evt`, `rm`, `dm`, or `processor`).

Tags:

- `nodeId:<nodeId>`
- `type:<newType>`

## NodesConnected

Creates or updates a directed edge from one existing node to another. Self-connections are ignored during projection. 
If an edge already exists between the same source and target, its role is replaced.

Payload:

- `sourceNodeId`: the id of the source node.
- `targetNodeId`: the id of the target node.
- `role`: the connection role, either `flow` or `back-reference`.

Tags:

- `nodeId:<sourceNodeId>`
- `nodeId:<targetNodeId>`
- `role:<role>`

## NodesDisconnected

Removes the directed edge from one node to another.

Payload:

- `sourceNodeId`: the id of the source node.
- `targetNodeId`: the id of the target node.

Tags:

- `nodeId:<sourceNodeId>`
- `nodeId:<targetNodeId>`
- `connection:<sourceNodeId>-><targetNodeId>`

## NodeSchemaChanged

Replaces the persisted schema for a logical node. The `nodeId` refers to the shared logical node, not to a future 
diagram-specific node instance. Example values should not be stored in this event, even if the editor UI shows 
schema and examples together.

Payload:

- `nodeId`: the id of the logical node whose schema changed.
- `schema`: the full schema for the node, including property names, types, nesting, list/optional/generated/tag 
            settings, and stable property ids where available.

Tags:

- `nodeId:<nodeId>`

## NodeExampleValuesChanged

Replaces the persisted example values for a logical node. These values are intentionally separated from 
`NodeSchemaChanged` so multiple future node instances can share the same schema while having different examples.

Payload:

- `nodeId`: the id of the logical node the example values belong to.
- `exampleValues`: the full set of example values for the node, preferably keyed by stable property id rather than property name so property renames do not lose examples.

Future payload extension:

- `nodeInstanceId`: the id of a specific diagram/scenario instance when examples become instance-specific.

Tags:

- `nodeId:<nodeId>`

