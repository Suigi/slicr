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
});
