// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Parsed, VisualNode } from '../../domain/types';
import { AddNodeDialog } from './AddNodeDialog';

let root: ReactDOM.Root | null = null;
let host: HTMLDivElement | null = null;

function makeNode(key: string, type: string, name: string, data: Record<string, unknown> | null = null): VisualNode {
  return {
    key,
    type,
    name,
    alias: null,
    stream: null,
    data,
    srcRange: { from: 0, to: 0 }
  };
}

function renderDialog(props: {
  parsed?: Parsed | null;
  onSubmit?: (args: { dslBlock: string; insertionHint?: { preferCursor: boolean } }) => void;
  onCancel?: () => void;
}) {
  const parsed = props.parsed ?? {
    sliceName: 'Test',
    nodes: new Map([
      ['evt:seed', makeNode('evt:seed', 'evt', 'seed', { alpha: 'a', nested: { beta: 2 } })],
      ['rm:view', makeNode('rm:view', 'rm', 'view', { gamma: true })]
    ]),
    edges: [],
    warnings: [],
    boundaries: [],
    scenarios: [],
    scenarioOnlyNodeKeys: []
  };

  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);
  act(() => {
    root?.render(
      <AddNodeDialog
        parsed={parsed}
        onCancel={props.onCancel ?? (() => undefined)}
        onSubmit={props.onSubmit ?? (() => undefined)}
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

describe('AddNodeDialog', () => {
  it('normalizes type on blur and moves focus to name when tabbing from type', async () => {
    renderDialog({});

    const typeInput = document.querySelector('#add-node-type') as HTMLInputElement | null;
    const nameInput = document.querySelector('#add-node-name') as HTMLInputElement | null;
    expect(typeInput).not.toBeNull();
    expect(nameInput).not.toBeNull();

    act(() => {
      if (typeInput) {
        typeInput.focus();
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(typeInput, 'co');
        typeInput.dispatchEvent(new Event('input', { bubbles: true }));
        typeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        typeInput.blur();
      }
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });

    expect(typeInput?.value).toBe('command');
    expect(document.activeElement).toBe(nameInput);
  });

  it('adds incoming predecessor from keyboard and emits real DSL preview on submit', () => {
    const onSubmit = vi.fn();
    renderDialog({ onSubmit });

    const incomingInput = document.querySelector('#add-node-incoming') as HTMLInputElement | null;
    expect(incomingInput).not.toBeNull();

    act(() => {
      incomingInput?.focus();
      incomingInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      incomingInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    const addButton = [...document.querySelectorAll('.project-modal-button.primary')]
      .find((button) => button.textContent?.trim() === 'Add Node') as HTMLButtonElement | undefined;
    expect(addButton).toBeDefined();

    act(() => {
      addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as { dslBlock: string };
    expect(payload.dslBlock.startsWith('evt:ticket-booked "Ticket Booked"')).toBe(true);
    expect(payload.dslBlock.includes('<- evt:seed')).toBe(true);
    expect(payload.dslBlock.includes('slice "')).toBe(false);
  });

  it('does not duplicate incoming data keys after selecting a predecessor', () => {
    renderDialog({});

    const incomingInput = document.querySelector('#add-node-incoming') as HTMLInputElement | null;
    expect(incomingInput).not.toBeNull();

    act(() => {
      incomingInput?.focus();
      incomingInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      incomingInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    const rowLabels = [...document.querySelectorAll('.add-node-dialog__row')]
      .map((row) => row.querySelector('span')?.textContent?.trim() ?? '');
    const alphaRows = rowLabels.filter((label) => label === 'alpha');
    expect(alphaRows).toHaveLength(1);
  });

  it('pre-checks all data rows when an incoming node is added', () => {
    renderDialog({});

    const incomingInput = document.querySelector('#add-node-incoming') as HTMLInputElement | null;
    expect(incomingInput).not.toBeNull();

    act(() => {
      incomingInput?.focus();
      incomingInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      incomingInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    const checkboxes = [...document.querySelectorAll('.add-node-dialog__row input[type="checkbox"]')] as HTMLInputElement[];
    expect(checkboxes.length).toBeGreaterThan(0);
    expect(checkboxes.every((checkbox) => checkbox.checked)).toBe(true);
  });

  it('renders generic predecessors without a generic: prefix in emitted DSL', () => {
    const onSubmit = vi.fn();
    const parsed: Parsed = {
      sliceName: 'Test',
      nodes: new Map([
        ['generic:catalog', makeNode('generic:catalog', 'generic', 'catalog', { alpha: 'a' })]
      ]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    renderDialog({ onSubmit, parsed });

    const incomingInput = document.querySelector('#add-node-incoming') as HTMLInputElement | null;
    expect(incomingInput).not.toBeNull();

    act(() => {
      incomingInput?.focus();
      incomingInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      incomingInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    const addButton = [...document.querySelectorAll('.project-modal-button.primary')]
      .find((button) => button.textContent?.trim() === 'Add Node') as HTMLButtonElement | undefined;
    expect(addButton).toBeDefined();

    act(() => {
      addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const payload = onSubmit.mock.calls[0][0] as { dslBlock: string };
    expect(payload.dslBlock.includes('<- catalog')).toBe(true);
    expect(payload.dslBlock.includes('<- generic:catalog')).toBe(false);
  });

  it('submits on Cmd/Ctrl+Enter', () => {
    const onSubmit = vi.fn();
    renderDialog({ onSubmit });

    const aliasInput = document.querySelector('#add-node-alias') as HTMLInputElement | null;
    expect(aliasInput).not.toBeNull();

    act(() => {
      aliasInput?.focus();
      aliasInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('emits collection DSL from collection form selections', () => {
    const onSubmit = vi.fn();
    renderDialog({ onSubmit });

    const incomingInput = document.querySelector('#add-node-incoming') as HTMLInputElement | null;
    expect(incomingInput).not.toBeNull();

    act(() => {
      incomingInput?.focus();
      incomingInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      incomingInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    const addCollection = [...document.querySelectorAll('.project-modal-button')]
      .find((button) => button.textContent?.trim() === '+ collection') as HTMLButtonElement | undefined;
    expect(addCollection).toBeDefined();
    act(() => {
      addCollection?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const collectionNameInput = document.querySelector('input[id^="collection-name-"]') as HTMLInputElement | null;
    expect(collectionNameInput).not.toBeNull();
    expect(document.activeElement).toBe(collectionNameInput);
    act(() => {
      if (collectionNameInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        setter?.call(collectionNameInput, 'items');
        collectionNameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const collectionRows = [...document.querySelectorAll('.add-node-dialog__collection .add-node-dialog__row')];
    const alphaRow = collectionRows.find((row) => row.querySelector('span')?.textContent?.trim() === 'alpha');
    expect(alphaRow).toBeDefined();
    const alphaCheckbox = alphaRow?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(alphaCheckbox).not.toBeNull();
    act(() => {
      alphaCheckbox?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const addButton = [...document.querySelectorAll('.project-modal-button.primary')]
      .find((button) => button.textContent?.trim() === 'Add Node') as HTMLButtonElement | undefined;
    expect(addButton).toBeDefined();
    act(() => {
      addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const payload = onSubmit.mock.calls[0][0] as { dslBlock: string };
    expect(payload.dslBlock.includes('items <- collect ( { alpha } )')).toBe(true);
  });
});
