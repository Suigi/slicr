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

  it('does not parse scenario section keywords as top-level generic nodes', () => {
    const input = `slice "Scenarios"

scenario "Complete TODO Item"
given:
  evt:todo-added

when:
  cmd:complete-todo

then:
  evt:todo-completed

evt:existing-top-level`;

    const parsed = parseDsl(input);

    expect([...parsed.nodes.keys()]).toEqual(['existing-top-level']);
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

  it('reports unresolved dependencies as warnings', () => {
    const input = `slice "Warnings"

rm:orders <- evt:missing`;

    const parsed = parseDsl(input);

    expect(parsed.edges).toEqual([]);
    expect(parsed.warnings).toEqual([
      {
        message: 'Unresolved dependency: missing',
        range: { from: input.indexOf('evt:missing'), to: input.indexOf('evt:missing') + 'evt:missing'.length },
        level: 'error'
      }
    ]);
  });

  it('reports unresolved dependency warnings at the referenced unknown node token', () => {
    const input = `slice "Warnings"

cmd:command

evt:event
<- cmd:command
<- ui:unknown`;

    const parsed = parseDsl(input);
    const warning = parsed.warnings.find((value) => value.message === 'Unresolved dependency: unknown');
    expect(warning).toBeDefined();
    expect(warning?.range.from).toBe(input.indexOf('ui:unknown'));
    expect(warning?.range.to).toBe(input.indexOf('ui:unknown') + 'ui:unknown'.length);
  });

  it('does not warn for command-to-event entry dependencies when command is not declared', () => {
    const input = `slice "Buy Ticket"

evt:concert-scheduled <- cmd:schedule-concert
rm:available-concerts <- evt:concert-scheduled`;

    const parsed = parseDsl(input);

    expect(parsed.warnings).toEqual([]);
    expect(parsed.edges).toEqual([{ from: 'concert-scheduled', to: 'available-concerts', label: null }]);
  });

  it('reports missing required data keys across direct predecessor edges', () => {
    const input = `slice "Data Integrity"

ui:my-ui "UI"
data:
   alpha: value

cmd:my-cmd "Command"
<- ui:my-ui
data:
  alpha: value
  bravo: other-value

evt:my-evt "Event"
<- cmd:my-cmd
data:
  alpha: alpha-value
  bravo: bravo-value
  charlie: charlie-value`;

    const parsed = parseDsl(input);

    expect(parsed.warnings.map((warning) => warning.message)).toEqual([
      'Missing data source for key "bravo"',
      'Missing data source for key "charlie"'
    ]);
    expect(parsed.warnings.map((warning) => warning.range.from)).toEqual([
      input.indexOf('bravo: other-value'),
      input.indexOf('charlie: charlie-value')
    ]);
  });

  it('applies uses block values into node data', () => {
    const input = `slice "Mapped RM"

evt:alpha-updated
data:
  alpha: A-1

evt:bravo-updated
data:
  bravo: B-2

rm:combined-view
<- evt:alpha-updated
<- evt:bravo-updated
uses:
  alpha
  bravo <- bravo`;

    const parsed = parseDsl(input);
    expect(parsed.nodes.get('combined-view')?.data).toEqual({
      alpha: 'A-1',
      bravo: 'B-2'
    });
    expect(parsed.nodes.get('combined-view')?.mappedDataKeys).toEqual(new Set(['alpha', 'bravo']));
  });

  it('applies JSONPath uses mappings into node data', () => {
    const input = `slice "Buy Tickets"

rm:available-concerts
data:
  concerts:
    - id: c-101
      selected: false
    - id: c-202
      selected: true

cmd:buy-tickets
<- rm:available-concerts
uses:
  concert-id <- $.concerts[?(@.selected==true)].id`;

    const parsed = parseDsl(input);
    expect(parsed.nodes.get('buy-tickets')?.data).toEqual({
      'concert-id': 'c-202'
    });
    expect(parsed.nodes.get('buy-tickets')?.mappedDataKeys).toEqual(new Set(['concert-id']));
  });

  it('warns when a mapped key cannot be sourced from direct predecessors', () => {
    const input = `slice "Mapped Warnings"

ui:my-ui
data:
  alpha: value

cmd:my-cmd
<- ui:my-ui
uses:
  alpha
  bravo <- bravo`;

    const parsed = parseDsl(input);
    expect(parsed.nodes.get('my-cmd')?.data).toEqual({
      alpha: 'value',
      bravo: '<missing>'
    });
    expect(parsed.nodes.get('my-cmd')?.mappedDataKeys).toEqual(new Set(['alpha', 'bravo']));
    expect(parsed.warnings.map((warning) => warning.message)).toContain(
      'Missing data source for key "bravo"'
    );
    expect(
      parsed.warnings.filter((warning) => warning.message === 'Missing data source for key "bravo"')
    ).toHaveLength(1);
    expect(
      parsed.warnings.find((warning) => warning.message === 'Missing data source for key "bravo"')?.range.from
    ).toBe(input.indexOf('bravo <- bravo'));
  });

  it('keeps explicit data values when the same key is also mapped', () => {
    const input = `slice "Mapped Priority"

evt:alpha-updated
data:
  alpha: from-event

rm:combined-view
<- evt:alpha-updated
data:
  alpha: from-data
uses:
  alpha`;

    const parsed = parseDsl(input);
    expect(parsed.nodes.get('combined-view')?.data).toEqual({
      alpha: 'from-data'
    });
    expect(parsed.nodes.get('combined-view')?.mappedDataKeys).toBeUndefined();
  });

  it('warns when a key is declared in both data and uses', () => {
    const input = `slice "Mapped Duplicate Key"

evt:alpha-updated
data:
  alpha: from-event

rm:combined-view
<- evt:alpha-updated
data:
  alpha: from-data
uses:
  alpha`;

    const parsed = parseDsl(input);
    expect(parsed.warnings.map((warning) => warning.message)).toContain(
      'Duplicate data key "alpha" in node rm:combined-view (declared in both data and uses)'
    );
  });

  it('does not treat uses lines as generic dependency edges', () => {
    const input = `slice "Read Model from Two Events"

evt:alpha-updated "Alpha Updated"
data:
  alpha: alpha-value

evt:bravo-updated "Bravo Updated"
data:
  bravo: bravo-value

rm:combined-view "Combined View"
<- evt:alpha-updated
<- evt:bravo-updated
data:
  charlie: blub
uses:
  alpha
  bravo <- bravo
  charlie`;

    const parsed = parseDsl(input);
    expect(parsed.warnings.map((warning) => warning.message)).not.toContain(
      'Unresolved dependency: bravo'
    );
  });

  it('does not emit integrity warnings for keys satisfied via uses mapping', () => {
    const input = `slice "Read Model from Two Events"

evt:thing-added@1 "Thing Added"
data:
  id: 100
  name: alpha

evt:thing-added@2 "Thing Added"
data:
  id: 200
  name: bravo

rm:my-rm "All Things"
<- evt:thing-added@1
<- evt:thing-added@2
uses:
  things <- collect({id,name})

ui:my-ui "Rename Thing Form"
<- rm:my-rm
data:
  newName: ALPHA
uses:
  id <- $.things[0].id`;

    const parsed = parseDsl(input);
    expect(parsed.nodes.get('my-ui')?.data).toEqual({
      newName: 'ALPHA',
      id: 100
    });
    expect(parsed.warnings.map((warning) => warning.message)).not.toContain(
      'Missing data source for key "id"'
    );
  });

  it('parses backwards arrows when the incoming clause is on a separate line', () => {
    const input = `slice "Book Room"

evt:room-booked
  data:
    some: value

rm:available-rooms
  <- evt:room-booked
  data:
    some: value

rm:pending-bookings
  <- evt:room-booked
  data:
    some: value`;

    const parsed = parseDsl(input);

    expect(parsed.warnings).toEqual([]);
    expect(parsed.edges).toEqual([
      { from: 'room-booked', to: 'available-rooms', label: null },
      { from: 'room-booked', to: 'pending-bookings', label: null }
    ]);
  });

  it('parses forward arrows on separate lines as outgoing edges from the current node', () => {
    const input = `slice "Book Room"

evt:room-booked
  -> rm:available-rooms
  -> rm:pending-bookings
  data:
    some: value

rm:available-rooms
  data:
    some: value

rm:pending-bookings
  data:
    some: value`;

    const parsed = parseDsl(input);

    expect(parsed.warnings).toEqual([]);
    expect(parsed.edges).toEqual([
      { from: 'room-booked', to: 'available-rooms', label: null },
      { from: 'room-booked', to: 'pending-bookings', label: null }
    ]);
  });

  it('treats inline <-, multiline <-, and multiline -> notations as equivalent edge definitions', () => {
    const inlineInput = `slice "Book Room"

evt:room-booked
  data:
    some: value

rm:available-rooms <- evt:room-booked
  data:
    some: value

rm:pending-bookings <- evt:room-booked
  data:
    some: value`;

    const multilineBackwardInput = `slice "Book Room"

evt:room-booked
  data:
    some: value

rm:available-rooms
  <- evt:room-booked
  data:
    some: value

rm:pending-bookings
  <- evt:room-booked
  data:
    some: value`;

    const multilineForwardInput = `slice "Book Room"

evt:room-booked
  -> rm:available-rooms
  -> rm:pending-bookings
  data:
    some: value

rm:available-rooms
  <- evt:room-booked
  data:
    some: value

rm:pending-bookings
  <- evt:room-booked
  data:
    some: value`;

    const inlineParsed = parseDsl(inlineInput);
    const multilineBackwardParsed = parseDsl(multilineBackwardInput);
    const multilineForwardParsed = parseDsl(multilineForwardInput);

    expect(multilineBackwardParsed.edges).toEqual(inlineParsed.edges);
    expect(multilineForwardParsed.edges).toEqual(inlineParsed.edges);
    expect(multilineForwardParsed.warnings).toEqual([]);
  });

  it('parses optional quoted aliases and keeps dependency refs canonical', () => {
    const input = `slice "Aliases"

rm:my-rm "My Read Model"
ui:my-ui "My UI"
  <- rm:my-rm`;

    const parsed = parseDsl(input);

    expect(parsed.nodes.get('my-rm')?.name).toBe('my-rm');
    expect(parsed.nodes.get('my-rm')?.alias).toBe('My Read Model');
    expect(parsed.nodes.get('my-ui')?.name).toBe('my-ui');
    expect(parsed.nodes.get('my-ui')?.alias).toBe('My UI');
    expect(parsed.edges).toEqual([{ from: 'my-rm', to: 'my-ui', label: null }]);
  });

  it('parses unprefixed generic nodes and places them in dependencies', () => {
    const input = `slice "Generic"

checkout-screen
cmd:place-order <- checkout-screen`;

    const parsed = parseDsl(input);

    expect(parsed.nodes.get('checkout-screen')?.type).toBe('generic');
    expect(parsed.nodes.get('place-order')?.type).toBe('cmd');
    expect(parsed.edges).toEqual([{ from: 'checkout-screen', to: 'place-order', label: null }]);
  });

  it('decodes escaped quotes and backslashes in quoted aliases', () => {
    const input = `slice "Aliases"

rm:item "My \\"Label\\" and \\\\ path"`;

    const parsed = parseDsl(input);

    expect(parsed.nodes.get('item')?.alias).toBe('My "Label" and \\ path');
  });

  it('parses --- as a slice boundary after the preceding node', () => {
    const input = `slice "Split"

cmd:first
---
evt:second <- cmd:first`;

    const parsed = parseDsl(input);

    expect(parsed.boundaries).toEqual([{ after: 'first' }]);
    expect(parsed.edges).toEqual([{ from: 'first', to: 'second', label: null }]);
  });

  it('attaches stream metadata to preceding event nodes', () => {
    const input = `slice "Streams"

evt:first-event
stream: first

evt:second-event
stream: second

rm:read-model
  <- evt:first-event
  <- evt:second-event`;

    const parsed = parseDsl(input);

    expect(parsed.nodes.get('first-event')?.stream).toBe('first');
    expect(parsed.nodes.get('second-event')?.stream).toBe('second');
    expect(parsed.nodes.get('read-model')?.stream).toBeNull();
    expect(parsed.edges).toEqual([
      { from: 'first-event', to: 'read-model', label: null },
      { from: 'second-event', to: 'read-model', label: null }
    ]);
  });

  it('ignores stream metadata when the preceding node is not an event', () => {
    const input = `slice "Streams"

rm:read-model
stream: first`;

    const parsed = parseDsl(input);

    expect(parsed.nodes.get('read-model')?.stream).toBeNull();
  });
});
