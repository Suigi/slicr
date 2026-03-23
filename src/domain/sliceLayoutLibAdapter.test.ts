import { describe, expect, it } from 'vitest';
import { parseDsl } from './parseDsl';
import { buildSliceLayoutLibRequest } from './sliceLayoutLibAdapter';

describe('buildSliceLayoutLibRequest', () => {
  it('derives semantic lanes from slice node types and event streams', () => {
    const parsed = parseDsl(`slice "Orders"

ui:orders-page
cmd:submit-order <- ui:orders-page
evt:order-submitted <- cmd:submit-order
stream: orders
evt:audit-recorded <- cmd:submit-order
rm:orders-view <- evt:order-submitted
exc:payment-failed`);

    const result = buildSliceLayoutLibRequest(parsed);

    expect(result.request.lanes).toEqual([
      { id: 'lane-0', order: 0 },
      { id: 'lane-1', order: 1 },
      { id: 'lane-2', order: 2 },
      { id: 'lane-3', order: 3 }
    ]);
    expect(result.request.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'orders-page', laneId: 'lane-0' }),
      expect.objectContaining({ id: 'submit-order', laneId: 'lane-1' }),
      expect.objectContaining({ id: 'order-submitted', laneId: 'lane-2' }),
      expect.objectContaining({ id: 'orders-view', laneId: 'lane-1' }),
      expect.objectContaining({ id: 'payment-failed', laneId: 'lane-3' }),
      expect.objectContaining({ id: 'audit-recorded', laneId: 'lane-3' })
    ]));
    expect(result.laneByKey).toEqual(new Map([
      ['orders-page', 0],
      ['submit-order', 1],
      ['order-submitted', 2],
      ['orders-view', 1],
      ['payment-failed', 3],
      ['audit-recorded', 3]
    ]));
    expect(result.rowStreamLabels).toEqual({
      2: 'orders'
    });
  });

  it('derives ordered layout groups from slice boundaries', () => {
    const parsed = parseDsl(`slice "Orders"

ui:orders-page
cmd:submit-order <- ui:orders-page
---
evt:order-submitted <- cmd:submit-order
rm:orders-view <- evt:order-submitted`);

    const result = buildSliceLayoutLibRequest(parsed);

    expect(result.request.groups).toEqual([
      { id: 'group-0', order: 0 },
      { id: 'group-1', order: 1 }
    ]);
    expect(result.request.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'orders-page', groupId: 'group-0' }),
      expect.objectContaining({ id: 'submit-order', groupId: 'group-0' }),
      expect.objectContaining({ id: 'order-submitted', groupId: 'group-1' }),
      expect.objectContaining({ id: 'orders-view', groupId: 'group-1' })
    ]));
  });

  it('forwards measured node dimensions into layout-lib node overrides', () => {
    const parsed = parseDsl(`slice "Orders"

ui:orders-page
cmd:submit-order <- ui:orders-page`);

    const result = buildSliceLayoutLibRequest(parsed, {
      'orders-page': { width: 211.8, height: 91.2 },
      'submit-order': { width: 199.4, height: 63.6 }
    });

    expect(result.request.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'orders-page', width: 212, height: 91 }),
      expect.objectContaining({ id: 'submit-order', width: 199, height: 64 })
    ]));
  });
});
