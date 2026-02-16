export const DEFAULT_DSL = `slice "Book Room"

evt:room-opened@1
  data:
    room-number: 101
    capacity: 2

evt:room-opened@2
  data:
    room-number: 102
    capacity: 4

rm:available-rooms <- evt:room-opened@1, evt:room-opened@2
  data:
    rooms:
      - room-number: 101
        capacity: 2
      - room-number: 102
        capacity: 4

ui:room-list <- rm:available-rooms
  data:
    rooms:
      - room-number: 101
      - room-number: 102

cmd:book-room <- ui:room-list
  data:
    room-number: 101
    customer-id: C_400

evt:room-booked <- cmd:book-room
  data:
    room-number: 101
    customer-id: C_400

rm:available-rooms@2 <- evt:room-booked
  data:
    rooms:
      - room-number: 102
        capacity: 4

ui:room-list@2 <- rm:available-rooms@2
  data:
    rooms:
      - room-number: 102

rm:pending-bookings <- evt:room-booked
  data:
    bookings:
      - room-number: 101
        customer-id: C_400`;
