// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Parsed } from '../../domain/types';
import type { ParsedSliceProjection } from '../../domain/parsedSliceProjection';
import { ImportNodeDialog } from './ImportNodeDialog';

let root: ReactDOM.Root | null = null;
let host: HTMLDivElement | null = null;

function makeParsed(nodes: Array<{ key: string; type: string; name: string; alias: string | null; data: Record<string, unknown> | null }>): Parsed {
  return {
    sliceName: 'Test',
    nodes: new Map(
      nodes.map((node) => [
        node.key,
        {
          ...node,
          stream: null,
          srcRange: { from: 0, to: 0 }
        }
      ])
    ),
    edges: [],
    warnings: [],
    boundaries: [],
    scenarios: [],
    scenarioOnlyNodeKeys: []
  };
}

function renderDialog(props?: {
  projections?: ParsedSliceProjection<Parsed>[];
  onSubmit?: (args: { dslBlock: string; insertionHint?: { preferCursor: boolean } }) => void;
}) {
  const projections = props?.projections ?? [
    {
      id: 'payments',
      dsl: 'slice "Payments"',
      parsed: makeParsed([
        {
          key: 'payment-authorized',
          type: 'evt',
          name: 'payment-authorized',
          alias: 'Payment Authorized',
          data: {
            paymentId: 'pay-774',
            amount: '89.00'
          }
        }
      ])
    },
    {
      id: 'support',
      dsl: 'slice "Support"',
      parsed: makeParsed([
        {
          key: 'override-approved',
          type: 'evt',
          name: 'override-approved',
          alias: 'Override Approved',
          data: {
            ticketId: 'tck-771'
          }
        }
      ])
    }
  ];

  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);

  act(() => {
    root?.render(
      <ImportNodeDialog
        parsedSliceProjectionList={projections}
        targetSliceId="checkout"
        onCancel={() => undefined}
        onSubmit={props?.onSubmit ?? (() => undefined)}
      />
    );
  });
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  host = null;
  document.body.innerHTML = '';
});

describe('ImportNodeDialog', () => {
  it('focuses node search on open', async () => {
    renderDialog();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const search = document.querySelector('#import-node-search') as HTMLInputElement | null;
    expect(document.activeElement).toBe(search);
  });

  it('finds nodes from multiple slices through autocomplete search', () => {
    renderDialog();

    const search = document.querySelector('#import-node-search') as HTMLInputElement | null;
    expect(search).not.toBeNull();

    act(() => {
      if (search) {
        search.focus();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        setter?.call(search, 'override');
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const list = document.querySelector('.import-node-dialog__suggestions');
    expect(list?.textContent?.includes('Override Approved')).toBe(true);
    expect(list?.querySelector('.type-event')).not.toBeNull();
  });

  it('prefills alias and pre-checks all data keys when a node is selected', () => {
    renderDialog();

    const search = document.querySelector('#import-node-search') as HTMLInputElement | null;
    expect(search).not.toBeNull();

    act(() => {
      search?.focus();
      search?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      search?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    const alias = document.querySelector('#import-node-alias') as HTMLInputElement | null;
    expect(alias?.value).toBe('Payment Authorized');

    const checkboxes = [...document.querySelectorAll('.import-node-dialog__data-row input[type="checkbox"]')] as HTMLInputElement[];
    expect(checkboxes.length).toBeGreaterThan(0);
    expect(checkboxes.every((checkbox) => checkbox.checked)).toBe(true);
  });

  it('submits DSL with only checked keys in a data block', () => {
    const onSubmit = vi.fn();
    renderDialog({ onSubmit });

    const search = document.querySelector('#import-node-search') as HTMLInputElement | null;
    expect(search).not.toBeNull();

    act(() => {
      search?.focus();
      search?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      search?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    const amountRow = [...document.querySelectorAll('.import-node-dialog__data-row')].find((row) => row.textContent?.includes('amount'));
    const amountCheckbox = amountRow?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(amountCheckbox).not.toBeNull();

    act(() => {
      amountCheckbox?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const submit = [...document.querySelectorAll('.project-modal-button.primary')].find((button) => button.textContent?.trim() === 'Import Node') as HTMLButtonElement | undefined;
    expect(submit).toBeDefined();

    act(() => {
      submit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as { dslBlock: string };
    expect(payload.dslBlock.startsWith('evt:payment-authorized "Payment Authorized"')).toBe(true);
    expect(payload.dslBlock.includes('data:')).toBe(true);
    expect(payload.dslBlock.includes('paymentId: "pay-774"')).toBe(true);
    expect(payload.dslBlock.includes('amount: "89.00"')).toBe(false);
  });
});
