export const DEFAULT_DSL = `slice "Book Room"

  rm:available-rooms
  data: {"room_number": 101, "check_in": "2025-03-01"}
    -> ui:room-list
      -> cmd:book-room
         data: {"customer_id": "cust-abc", "room_number": 101}
         -> evt:room-booked
              data: {"reservation_id": "res-xyz", "room_number": 101}
              -> rm:available-rooms
                -> ui:room-list
         -> evt:booking-confirmed
              -> rm:pending-bookings
              data: {"reservation_id": "res-xyz", "status": "pending"}`;
