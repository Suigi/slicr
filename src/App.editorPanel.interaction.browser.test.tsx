import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

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

async function waitFor(condition: () => boolean, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    if (condition()) {
      return;
    }
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    });
  }
}

async function waitForNodeText(text: string) {
  await waitFor(() => [...document.querySelectorAll('.main .node')].some((element) => element.textContent?.includes(text)));
}

describe('App editor panel interactions', () => {
  it('opens and closes the editor panel via toggle and outside click', () => {
    renderApp();

    const toggle = document.querySelector('button[aria-label="Toggle DSL editor"]');
    const panel = document.querySelector('.editor-panel');

    expect(toggle).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(panel?.classList.contains('open')).toBe(false);

    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(panel?.classList.contains('open')).toBe(true);

    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(panel?.classList.contains('open')).toBe(false);
  });

  it('keeps the panel open when pointerdown happens inside the editor', () => {
    renderApp();

    const toggle = document.querySelector('button[aria-label="Toggle DSL editor"]');
    const panel = document.querySelector('.editor-panel');
    const editor = document.querySelector('.dsl-editor');

    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(panel?.classList.contains('open')).toBe(true);

    act(() => {
      editor?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(panel?.classList.contains('open')).toBe(true);
  });

  it('opens the editor and moves cursor to declaration line when double-clicking a node', async () => {
    renderApp();
    await waitForNodeText('room-opened');

    const panel = document.querySelector('.editor-panel');
    expect(panel?.classList.contains('open')).toBe(false);

    const node = [...document.querySelectorAll('.main .node')]
      .find((element) => element.textContent?.includes('room-opened')) as HTMLElement | undefined;
    expect(node).toBeDefined();

    act(() => {
      node?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    expect(panel?.classList.contains('open')).toBe(true);
    const focusedElement = document.activeElement as HTMLElement | null;
    expect(focusedElement?.closest('.dsl-editor')).not.toBeNull();
  });
});
