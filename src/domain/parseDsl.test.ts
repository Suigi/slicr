import { describe, expect, it } from 'vitest';
import { parseDsl } from './parseDsl';

describe('parseDsl', () => {
  it('parses node dependencies via <- and data attachments', () => {
    const input = `slice "Orders"

evt:order-created@1
  data:
    order-id: o-1

evt:order-created@2
  data:
    order-id: o-2

rm:orders <- evt:order-created@1, evt:order-created@2
  data:
    ids:
      - o-1
      - o-2

ui:orders-list <- rm:orders
cmd:create-order <- ui:orders-list`;

    const parsed = parseDsl(input);

    expect(parsed.sliceName).toBe('Orders');
    expect(parsed.nodes.has('order-created@1')).toBe(true);
    expect(parsed.nodes.has('order-created@2')).toBe(true);
    expect(parsed.nodes.has('orders')).toBe(true);
    expect(parsed.nodes.has('orders-list')).toBe(true);
    expect(parsed.nodes.has('create-order')).toBe(true);

    expect(parsed.edges).toEqual([
      { from: 'order-created@1', to: 'orders', label: null },
      { from: 'order-created@2', to: 'orders', label: null },
      { from: 'orders', to: 'orders-list', label: null },
      { from: 'orders-list', to: 'create-order', label: null }
    ]);
  });

  it('parses multiline YAML data blocks and attaches them to previous node', () => {
    const input = `slice "Yaml Data"

evt:room-opened
  data:
    room-number: 101
    capacity: 2
    meta:
      building: A
    tags:
      - near-window
      - quiet`;

    const parsed = parseDsl(input);

    expect(parsed.nodes.get('room-opened')?.data).toEqual({
      'room-number': 101,
      capacity: 2,
      meta: { building: 'A' },
      tags: ['near-window', 'quiet']
    });
  });

  it('parses YAML arrays of objects for node data', () => {
    const input = `slice "Arrays"

rm:available-rooms
  data:
    rooms:
      - room-number: 101
        capacity: 2
      - room-number: 102
        capacity: 4`;

    const parsed = parseDsl(input);

    expect(parsed.nodes.get('available-rooms')?.data).toEqual({
      rooms: [
        { 'room-number': 101, capacity: 2 },
        { 'room-number': 102, capacity: 4 }
      ]
    });
  });

  it('continues to parse one-line JSON data blocks', () => {
    const input = `slice "Mixed Data"

ui:booking-form
  data: {"step": 2}
cmd:book-room <- ui:booking-form
  data:
    room-id: 42
    notes: near-window`;

    const parsed = parseDsl(input);

    expect(parsed.nodes.get('booking-form')?.data).toEqual({ step: 2 });
    expect(parsed.nodes.get('book-room')?.data).toEqual({ 'room-id': 42, notes: 'near-window' });
    expect(parsed.edges).toEqual([{ from: 'booking-form', to: 'book-room', label: null }]);
  });

  it('ignores malformed data blocks without throwing', () => {
    const input = `slice "Bad Data"

cmd:place-order
  data: {"order_id": }
evt:order-failed <- cmd:place-order`;

    expect(() => parseDsl(input)).not.toThrow();
    const parsed = parseDsl(input);

    expect(parsed.nodes.get('place-order')?.data).toBeNull();
    expect(parsed.edges).toEqual([{ from: 'place-order', to: 'order-failed', label: null }]);
  });

  it('parses the room-opened flow with read-model update versions', () => {
    const input = `slice "Book Room"

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
cmd:book-room <- ui:room-list
evt:room-booked <- cmd:book-room
rm:available-rooms@2 <- evt:room-booked
ui:room-list@2 <- rm:available-rooms@2
rm:pending-bookings <- evt:room-booked`;

    const parsed = parseDsl(input);

    expect(parsed.nodes.get('room-opened@1')?.data).toEqual({ 'room-number': 101, capacity: 2 });
    expect(parsed.nodes.get('room-opened@2')?.data).toEqual({ 'room-number': 102, capacity: 4 });
    expect(parsed.edges).toEqual([
      { from: 'room-opened@1', to: 'available-rooms', label: null },
      { from: 'room-opened@2', to: 'available-rooms', label: null },
      { from: 'available-rooms', to: 'room-list', label: null },
      { from: 'room-list', to: 'book-room', label: null },
      { from: 'book-room', to: 'room-booked', label: null },
      { from: 'room-booked', to: 'available-rooms@2', label: null },
      { from: 'available-rooms@2', to: 'room-list@2', label: null },
      { from: 'room-booked', to: 'pending-bookings', label: null }
    ]);
  });

  it('does not create extra nodes from data properties', () => {
    const input = `slice "Book Room"

evt:room-opened@1
  data:
    room-number: 101
    capacity: 2`;

    const parsed = parseDsl(input);

    expect(parsed.nodes.size).toBe(1);
    const node = parsed.nodes.get('room-opened@1');
    expect(node).toBeDefined();
    expect(node?.srcRange).toEqual({ from: 19, to: 81 });
  });
});
