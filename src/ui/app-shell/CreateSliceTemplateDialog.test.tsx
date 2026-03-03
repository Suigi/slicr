// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Parsed } from '../../domain/types';
import type { ParsedSliceProjection } from '../../domain/parsedSliceProjection';
import { CreateSliceTemplateDialog } from './CreateSliceTemplateDialog';

let root: ReactDOM.Root | null = null;
let host: HTMLDivElement | null = null;

function makeParsed(
  nodes: Array<{ key: string; type: string; name: string; alias: string | null; data?: Record<string, unknown> | null }>,
  sliceName = 'Test'
): Parsed {
  return {
    sliceName,
    nodes: new Map(
      nodes.map((node) => [
        node.key,
        {
          ...node,
          data: node.data ?? null,
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
  targetSliceId?: string;
  onSubmit?: (args: { targetMode: 'create-new' | 'add-current'; text: string }) => void;
}) {
  const projections = props?.projections ?? [
    {
      id: 'payments',
      dsl: 'slice "Payments"',
      parsed: makeParsed(
        [
          {
            key: 'payment-authorized',
            type: 'evt',
            name: 'payment-authorized',
            alias: 'Payment Authorized'
          }
        ],
        'Payments'
      )
    }
  ];

  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);

  act(() => {
    root?.render(
      <CreateSliceTemplateDialog
        parsedSliceProjectionList={projections}
        targetSliceId={props?.targetSliceId ?? 'checkout'}
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

describe('CreateSliceTemplateDialog', () => {
  it('shows slice name only for create-new mode', () => {
    renderDialog();

    const sliceName = document.querySelector('#slice-template-slice-name') as HTMLInputElement | null;
    expect(sliceName).not.toBeNull();

    const addCurrent = document.querySelector('#slice-template-target-add-current') as HTMLInputElement | null;
    expect(addCurrent).not.toBeNull();

    act(() => {
      addCurrent?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('#slice-template-slice-name')).toBeNull();
  });

  it('auto-generates alias from name until alias is manually edited', () => {
    renderDialog();

    const nameInput = document.querySelector('input[data-role="node-name"][data-slot="entry-ui"]') as HTMLInputElement | null;
    const aliasInput = document.querySelector('input[data-role="node-alias"][data-slot="entry-ui"]') as HTMLInputElement | null;
    expect(nameInput).not.toBeNull();
    expect(aliasInput).not.toBeNull();

    act(() => {
      if (nameInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        setter?.call(nameInput, 'payment-form');
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    expect(aliasInput?.value).toBe('Payment Form');

    act(() => {
      if (aliasInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        setter?.call(aliasInput, 'Custom Alias');
        aliasInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    act(() => {
      if (nameInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        setter?.call(nameInput, 'other-name');
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    expect(aliasInput?.value).toBe('Custom Alias');
  });

  it('lets event rows pick event names from cross-slice autocomplete', () => {
    renderDialog();

    const eventNameInput = document.querySelector('input[data-role="node-name"][data-slot="result-evt"]') as HTMLInputElement | null;
    expect(eventNameInput).not.toBeNull();

    act(() => {
      if (eventNameInput) {
        eventNameInput.focus();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        setter?.call(eventNameInput, 'authorized');
        eventNameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const suggestions = document.querySelector('.slice-template-dialog__event-suggestions');
    expect(suggestions?.textContent?.includes('Payment Authorized')).toBe(true);

    act(() => {
      eventNameInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      eventNameInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(eventNameInput?.value).toBe('payment-authorized');
    const aliasInput = document.querySelector('input[data-role="node-alias"][data-slot="result-evt"]') as HTMLInputElement | null;
    expect(aliasInput?.value).toBe('Payment Authorized');
  });

  it('submits create-new generated text', () => {
    const onSubmit = vi.fn();
    renderDialog({ onSubmit });

    const submit = [...document.querySelectorAll('.project-modal-button.primary')]
      .find((button) => button.textContent?.trim() === 'Apply Template') as HTMLButtonElement | undefined;
    expect(submit).toBeDefined();

    act(() => {
      submit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as { targetMode: 'create-new' | 'add-current'; text: string };
    expect(payload.targetMode).toBe('create-new');
    expect(payload.text.startsWith('slice "')).toBe(true);
  });
});
