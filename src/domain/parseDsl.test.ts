import { describe, expect, it } from 'vitest';
import { parseDsl } from './parseDsl';

describe('parseDsl', () => {
  it('parses slice name, edges, labels, and data attachments', () => {
    const input = `slice "Orders"

  rm:orders
    -> ui:orders-page [open]
      data: {"page": 1}
      -> cmd:create-order
        data: {"order_id": "o-1"}
        -> evt:order-created`;

    const parsed = parseDsl(input);

    expect(parsed.sliceName).toBe('Orders');
    expect(parsed.nodes.has('orders')).toBe(true);
    expect(parsed.nodes.has('orders-page')).toBe(true);
    expect(parsed.nodes.has('create-order')).toBe(true);
    expect(parsed.nodes.has('order-created')).toBe(true);

    expect(parsed.edges).toEqual([
      { from: 'orders', to: 'orders-page', label: 'open' },
      { from: 'orders-page', to: 'create-order', label: null },
      { from: 'create-order', to: 'order-created', label: null }
    ]);

    expect(parsed.nodes.get('orders-page')?.data).toEqual({ page: 1 });
    expect(parsed.nodes.get('create-order')?.data).toEqual({ order_id: 'o-1' });
  });

  it('ignores malformed data blocks without throwing', () => {
    const input = `slice "Bad Data"

  cmd:place-order
    data: {"order_id": }
    -> evt:order-failed`;

    expect(() => parseDsl(input)).not.toThrow();
    const parsed = parseDsl(input);

    expect(parsed.nodes.get('place-order')?.data).toBeNull();
    expect(parsed.edges).toEqual([{ from: 'place-order', to: 'order-failed', label: null }]);
  });

  it('disambiguates repeated rm/ui names with suffixed keys', () => {
    const input = `slice "Dupes"

  rm:inventory
    -> ui:inventory-view
      -> rm:inventory
        -> ui:inventory-view`;

    const parsed = parseDsl(input);

    expect(parsed.nodes.has('inventory')).toBe(true);
    expect(parsed.nodes.has('inventory#2')).toBe(true);
    expect(parsed.nodes.has('inventory-view')).toBe(true);
    expect(parsed.nodes.has('inventory-view#2')).toBe(true);
    expect(parsed.edges).toEqual([
      { from: 'inventory', to: 'inventory-view', label: null },
      { from: 'inventory-view', to: 'inventory#2', label: null },
      { from: 'inventory#2', to: 'inventory-view#2', label: null }
    ]);
  });
});
