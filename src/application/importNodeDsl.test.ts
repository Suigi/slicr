import { describe, expect, it } from 'vitest';
import { buildImportNodeDsl } from './importNodeDsl';
import { parseDsl } from '../domain/parseDsl';

describe('buildImportNodeDsl', () => {
  it('preserves source type and name in the header', () => {
    const dsl = buildImportNodeDsl({
      sourceRef: 'evt:payment-authorized',
      alias: 'Payment Authorized',
      dataRows: [
        { id: 'amount', key: 'amount', value: '89.00' }
      ],
      selectedRowIds: ['amount']
    });

    expect(dsl.startsWith('evt:payment-authorized "Payment Authorized"')).toBe(true);
  });

  it('includes only selected data keys and values in the data block', () => {
    const dsl = buildImportNodeDsl({
      sourceRef: 'rm:payment-read-model',
      alias: 'Payment Read Model',
      dataRows: [
        { id: 'status', key: 'status', value: 'approved' },
        { id: 'capturedAt', key: 'capturedAt', value: '2026-03-03T09:13:00Z' }
      ],
      selectedRowIds: ['capturedAt']
    });

    expect(dsl.includes('data:')).toBe(true);
    expect(dsl.includes('capturedAt: "2026-03-03T09:13:00Z"')).toBe(true);
    expect(dsl.includes('status: "approved"')).toBe(false);
  });

  it('emits data: {} when no rows are selected', () => {
    const dsl = buildImportNodeDsl({
      sourceRef: 'cmd:capture-payment',
      alias: 'Capture Payment',
      dataRows: [{ id: 'paymentId', key: 'paymentId', value: 'pay-774' }],
      selectedRowIds: []
    });

    expect(dsl.endsWith('data: {}')).toBe(true);
  });

  it('preserves non-string values in data entries', () => {
    const dsl = buildImportNodeDsl({
      sourceRef: 'evt:sample',
      alias: 'Sample',
      dataRows: [
        { id: 'count', key: 'count', value: 2 },
        { id: 'ok', key: 'ok', value: true }
      ],
      selectedRowIds: ['count', 'ok']
    });

    expect(dsl.includes('count: 2')).toBe(true);
    expect(dsl.includes('ok: true')).toBe(true);
  });

  it('generates a block that parses as valid DSL', () => {
    const block = buildImportNodeDsl({
      sourceRef: 'evt:sample',
      alias: 'Sample',
      dataRows: [{ id: 'payment-id', key: 'payment-id', value: 'pay-1' }],
      selectedRowIds: ['payment-id']
    });
    const parsed = parseDsl(`slice "Test"\n\n${block}`);

    expect(parsed.nodes.has('sample')).toBe(true);
    expect(parsed.warnings.length).toBe(0);
  });
});
