export type DocumentationFeature = {
  id: string;
  title: string;
  description: string;
  dsl: string;
};

export type DocumentationGroup = {
  id: string;
  title: string;
  description: string;
  features: DocumentationFeature[];
};

export const DOCUMENTATION_GROUPS: DocumentationGroup[] = [
  {
    id: 'nodes',
    title: 'Nodes',
    description: 'Declare nodes in your slice with explicit types, aliases, and optional node versions.',
    features: [
      {
        id: 'node-types',
        title: 'Node types',
        description: 'Supported typed nodes plus generic (unprefixed) nodes.',
        dsl: `slice "Node Types"

ui:booking-form "Booking Form"
cmd:book-room "Book Room"
evt:room-booked "Room Booked"
rm:available-rooms "Available Rooms"
exc:room-conflict "Room Conflict"
aut:process-booking "Process Booking"
ext:payment-gateway "Payment Gateway"
generic-node "Generic Node"`
      },
      {
        id: 'aliases-and-versions',
        title: 'Aliases and versions',
        description: 'Use quoted aliases for display names and @version suffixes for evolving nodes.',
        dsl: `slice "Aliases and Versions"

evt:room-opened "Room Opened"
data:
  room-number: 101

rm:available-rooms@1 "Available Rooms (Version 1)"
<- evt:room-opened
data:
  rooms:
    - 101

evt:customer-checked-out "Customer Checked Out"
data:
  room-number: 202

rm:available-rooms@2 "Available Rooms (Version 2)"
<- evt:room-opened
<- evt:customer-checked-out
data:
  rooms:
    - 101
    - 202

`
      }
    ]
  },
  {
    id: 'connections',
    title: 'Connections',
    description: 'Model dependencies with incoming (<-) and outgoing (->) edge clauses.',
    features: [
      {
        id: 'incoming-inline',
        title: 'Incoming arrows (inline <-)',
        description: 'Attach predecessors on the same line as the target node.',
        dsl: `slice "Inline Incoming"

ui:room-list
cmd:book-room <- ui:room-list
evt:room-booked <- cmd:book-room
rm:bookings <- evt:room-booked`
      },
      {
        id: 'incoming-and-outgoing-multiline',
        title: 'Incoming and outgoing arrows (multiline <- and ->)',
        description: 'Standalone clauses under a node are equivalent to inline edge syntax.',
        dsl: `slice "Arrow Directions"

evt:room-booked
  -> rm:available-rooms
  -> rm:pending-bookings

rm:available-rooms
  <- evt:room-booked

rm:pending-bookings
  <- evt:room-booked`
      }
    ]
  },
  {
    id: 'data',
    title: 'Data and mappings',
    description: 'Declare node-local data and pull values from direct predecessors with maps blocks.',
    features: [
      {
        id: 'node-data',
        title: 'Node data blocks',
        description: 'Attach YAML-style data to nodes.',
        dsl: `slice "Node Data"

ui:booking-form
data:
  selected-room: 101
  customer-id: C_400

cmd:book-room <- ui:booking-form
data:
  selected-room: 101
  customer-id: C_400`
      },
      {
        id: 'maps-from-predecessors',
        title: 'maps: from predecessor data',
        description: 'Map keys from direct predecessor nodes into the current node.',
        dsl: `slice "Maps from Predecessors"

evt:room-selected
data:
  room-number: 101

evt:customer-selected
data:
  customer-id: C_400

cmd:book-room
<- evt:room-selected
<- evt:customer-selected
maps:
  room-number
  customer <- customer-id`
      }
    ]
  },
  {
    id: 'layout',
    title: 'Layout controls',
    description: 'Use boundaries and streams to influence visual grouping in the rendered diagram.',
    features: [
      {
        id: 'slice-dividers',
        title: 'Slice dividers (---)',
        description: 'A boundary marker adds a visual divider after the preceding node.',
        dsl: `slice "Slice Dividers"

cmd:enter-flow
evt:step-one <- cmd:enter-flow
---
evt:step-two <- evt:step-one
rm:summary <- evt:step-two`
      },
      {
        id: 'stream-lanes',
        title: 'Stream lanes',
        description: 'Assign stream labels to events to split them into named event lanes.',
        dsl: `slice "Stream Lanes"

evt:room-opened
stream: inventory

evt:room-booked
stream: booking

evt:room-cleaned
stream: inventory

rm:ops-dashboard
  <- evt:room-opened
  <- evt:room-booked
  <- evt:room-cleaned`
      }
    ]
  }
];
