// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeSearchCombobox } from './NodeSearchCombobox';

let root: ReactDOM.Root | null = null;
let host: HTMLDivElement | null = null;

function renderCombobox() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);

  act(() => {
    root?.render(
      <NodeSearchCombobox
        inputId="node-search"
        inputClassName="input"
        pickerClassName="picker"
        suggestionsClassName="suggestions"
        itemClassName="item"
        activeClassName="active"
        emptyClassName="empty"
        primaryClassName="primary"
        secondaryClassName="secondary"
        placeholder="Search nodes"
        options={[{
          id: 'node-1',
          primary: 'Node 1',
          secondary: 'evt:node-1',
          value: 'node-1'
        }]}
        query=""
        onQueryChange={() => undefined}
        onPick={() => undefined}
        autoFocus
      />
    );
  });
}

afterEach(() => {
  vi.useRealTimers();
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  host?.remove();
  host = null;
  document.body.innerHTML = '';
});

describe('NodeSearchCombobox', () => {
  it('clears deferred focus and blur timers on unmount', () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    renderCombobox();

    const input = document.querySelector('#node-search') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    act(() => {
      input?.focus();
      input?.blur();
    });

    act(() => {
      root?.unmount();
    });
    root = null;

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
