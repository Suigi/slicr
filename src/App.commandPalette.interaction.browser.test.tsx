import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { SLICES_STORAGE_KEY } from './sliceLibrary';

let root: ReactDOM.Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root && host) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  host = null;
  document.body.innerHTML = '';
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

function renderApp() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);
  act(() => {
    root?.render(<App />);
  });
}

describe('App command palette interactions', () => {
  it('shows Show Project Overview in slice mode and enters overview from the command palette', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const showOverviewItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Show Project Overview')
    ) as HTMLButtonElement | undefined;
    expect(showOverviewItem).toBeDefined();
    expect(
      [...document.querySelectorAll('.command-palette-item')]
        .some((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Hide Project Overview')
    ).toBe(false);

    act(() => {
      showOverviewItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.command-palette')).toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    expect(
      [...document.querySelectorAll('.command-palette-item')]
        .some((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Show Project Overview')
    ).toBe(false);
    expect(
      [...document.querySelectorAll('.command-palette-item')]
        .some((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Hide Project Overview')
    ).toBe(true);
  });

  it('shows Hide Project Overview in overview mode and exits overview from the command palette', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const showOverviewItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Show Project Overview')
    ) as HTMLButtonElement | undefined;
    expect(showOverviewItem).toBeDefined();

    act(() => {
      showOverviewItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const hideOverviewItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Hide Project Overview')
    ) as HTMLButtonElement | undefined;
    expect(hideOverviewItem).toBeDefined();

    act(() => {
      hideOverviewItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.command-palette')).toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    expect(
      [...document.querySelectorAll('.command-palette-item')]
        .some((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Show Project Overview')
    ).toBe(true);
    expect(
      [...document.querySelectorAll('.command-palette-item')]
        .some((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Hide Project Overview')
    ).toBe(false);
  });

  it('keeps dot-prefixed slice filtering focused on slices instead of overview commands', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [
          { id: 'slice-a', dsl: 'slice "Alpha"\n\nevt:first' },
          { id: 'slice-b', dsl: 'slice "Beta"\n\nevt:second' }
        ]
      })
    );

    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const search = document.querySelector('.command-palette-search') as HTMLInputElement | null;
    expect(search).not.toBeNull();

    act(() => {
      if (search) {
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setValue?.call(search, '.be');
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const items = [...document.querySelectorAll('.command-palette-item-title')]
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    expect(items).toEqual(['Beta']);
    expect(items).not.toContain('Show Project Overview');
    expect(items).not.toContain('Hide Project Overview');
  });

  it('opens create project dialog from command palette', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const createProjectItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Create Project...')
    ) as HTMLButtonElement | undefined;
    expect(createProjectItem).toBeDefined();

    act(() => {
      createProjectItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.project-modal')).not.toBeNull();
  });

  it('opens add node dialog from command palette', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const addNodeItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Add Node...')
    ) as HTMLButtonElement | undefined;
    expect(addNodeItem).toBeDefined();

    act(() => {
      addNodeItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.add-node-dialog')).not.toBeNull();
  });

  it('opens import node dialog from command palette', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const importNodeItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Import Node...')
    ) as HTMLButtonElement | undefined;
    expect(importNodeItem).toBeDefined();

    act(() => {
      importNodeItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.import-node-dialog')).not.toBeNull();
  });

  it('opens apply slice template dialog from command palette', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const applyTemplateItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Apply Slice Template...')
    ) as HTMLButtonElement | undefined;
    expect(applyTemplateItem).toBeDefined();

    act(() => {
      applyTemplateItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.create-slice-template-dialog')).not.toBeNull();
  });

  it('opens compact event streams dialog from command palette', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const compactItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Compact Event Streams...')
    ) as HTMLButtonElement | undefined;
    expect(compactItem).toBeDefined();

    act(() => {
      compactItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.compact-events-dialog')).not.toBeNull();
  });
});
