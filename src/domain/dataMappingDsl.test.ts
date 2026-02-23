import { describe, expect, it } from 'vitest';
import { parseDsl } from './parseDsl';

describe('uses block DSL (spec)', () => {
  it('uses alpha and bravo in a read model from two predecessor events', () => {
    const dsl = `slice "Mapped RM"

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

    const parsed = parseDsl(dsl);
    expect(parsed.nodes.get('combined-view')?.data).toEqual({
      alpha: 'A-1',
      bravo: 'B-2'
    });
  });

  it.skip('uses selected concert id for cmd:buy-tickets from rm:available-concerts', () => {
    const dsl = `slice "Buy Tickets"

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
  concert-id <- concerts[?selected=true].id`;

    const parsed = parseDsl(dsl);
    expect(parsed.nodes.get('buy-tickets')?.data).toEqual({
      'concert-id': 'c-202'
    });
  });

  it('resolves uses value through JSONPath when source path starts with $', () => {
    const dsl = `slice "Buy Tickets"

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

    const parsed = parseDsl(dsl);
    expect(parsed.nodes.get('buy-tickets')?.data).toEqual({
      'concert-id': 'c-202'
    });
  });

  it('emits missing warning and <missing> value when JSONPath finds no match', () => {
    const dsl = `slice "Buy Tickets"

rm:available-concerts
data:
  concerts:
    - id: c-101
      selected: false
    - id: c-202
      selected: false

cmd:buy-tickets
<- rm:available-concerts
uses:
  concert-id <- $.concerts[?(@.selected==true)].id`;

    const parsed = parseDsl(dsl);
    expect(parsed.nodes.get('buy-tickets')?.data).toEqual({
      'concert-id': '<missing>'
    });
    expect(parsed.warnings.map((warning) => warning.message)).toContain(
      'Missing data source for key "concert-id"'
    );
  });

  it('treats invalid JSONPath as missing source without crashing', () => {
    const dsl = `slice "Buy Tickets"

rm:available-concerts
data:
  concerts:
    - id: c-101
      selected: true

cmd:buy-tickets
<- rm:available-concerts
uses:
  concert-id <- $.concerts[?(@.selected==true].id`;

    const parsed = parseDsl(dsl);
    expect(parsed.nodes.get('buy-tickets')?.data).toEqual({
      'concert-id': '<missing>'
    });
    expect(parsed.warnings.map((warning) => warning.message)).toContain(
      'Missing data source for key "concert-id"'
    );
  });

  it('collects values from direct predecessors into an array', () => {
    const dsl = `slice "Available Rooms"

evt:room-opened@1
data:
  room-number: 101
  capacity: 2

evt:room-opened@2
data:
  room-number: 102
  capacity: 4

rm:available-rooms
<- evt:room-opened@1
<- evt:room-opened@2
uses:
  rooms <- collect({ room-number, capacity })`;

    const parsed = parseDsl(dsl);
    expect(parsed.nodes.get('available-rooms')?.data).toEqual({
      rooms: [
        { 'room-number': 101, capacity: 2 },
        { 'room-number': 102, capacity: 4 }
      ]
    });
  });
});
