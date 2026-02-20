import { describe, expect, it } from 'vitest';
import { parseDsl } from './parseDsl';

describe('maps block DSL (spec)', () => {
  it('maps alpha and bravo into a read model from two predecessor events', () => {
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
maps:
  alpha
  bravo <- bravo`;

    const parsed = parseDsl(dsl);
    expect(parsed.nodes.get('combined-view')?.data).toEqual({
      alpha: 'A-1',
      bravo: 'B-2'
    });
  });

  it.skip('maps selected concert id for cmd:buy-tickets from rm:available-concerts', () => {
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
maps:
  concert-id <- concerts[?selected=true].id`;

    const parsed = parseDsl(dsl);
    expect(parsed.nodes.get('buy-tickets')?.data).toEqual({
      'concert-id': 'c-202'
    });
  });
});
