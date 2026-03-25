import { describe, expect, it } from 'vitest';
import { parseUsesBlocks } from './dataMapping';

describe('parseUsesBlocks', () => {
  it('normalizes shorthand grouped uses keys into explicit source paths', () => {
    const dsl = `slice "Sales"

cmd:buy "Buy Ticket"
uses:
  session:
    customerId
  ui:buy:
    concertId
    quantity
`;

    const mappings = parseUsesBlocks(dsl);
    expect(mappings.get('cmd:buy')).toEqual([
      expect.objectContaining({ targetKey: 'customerId', sourcePath: 'session.customerId' }),
      expect.objectContaining({ targetKey: 'concertId', sourcePath: 'ui:buy.concertId' }),
      expect.objectContaining({ targetKey: 'quantity', sourcePath: 'ui:buy.quantity' })
    ]);
  });
});
