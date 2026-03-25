import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import App from './App';

afterEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

async function renderApp() {
  return render(<App />);
}

async function waitForNode(text: string, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    const match = [...document.querySelectorAll('.main .node')]
      .find((element) => element.textContent?.includes(text));
    if (match instanceof HTMLElement) {
      return match;
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  return [...document.querySelectorAll('.main .node')]
    .find((element) => element.textContent?.includes(text)) as HTMLElement | undefined;
}

describe('App editor panel interactions', () => {
  it('opens and closes the editor panel via toggle and outside click', async () => {
    await renderApp();

    const toggle = page.getByRole('button', { name: 'Toggle DSL editor' });
    const panel = document.querySelector('.editor-panel');

    expect(panel?.classList.contains('open')).toBe(false);

    await toggle.click();

    expect(panel?.classList.contains('open')).toBe(true);

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    await expect.poll(() => panel?.classList.contains('open')).toBe(false);
  });

  it('keeps the panel open when pointerdown happens inside the editor', async () => {
    await renderApp();

    const toggle = page.getByRole('button', { name: 'Toggle DSL editor' });
    const panel = document.querySelector('.editor-panel');
    const editor = document.querySelector('.dsl-editor');

    await toggle.click();

    expect(panel?.classList.contains('open')).toBe(true);

    editor?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    await expect.poll(() => panel?.classList.contains('open')).toBe(true);
  });

  it('opens the editor and moves cursor to declaration line when double-clicking a node', async () => {
    await renderApp();

    const panel = document.querySelector('.editor-panel');
    expect(panel?.classList.contains('open')).toBe(false);

    const node = await waitForNode('room-opened');
    expect(node).toBeDefined();

    await userEvent.dblClick(node!);

    await expect.poll(() => panel?.classList.contains('open')).toBe(true);
    await expect.poll(() => document.activeElement?.closest('.dsl-editor')).not.toBeNull();
  });
});
