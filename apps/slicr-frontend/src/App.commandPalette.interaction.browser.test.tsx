import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import App from './App';
import { SLICES_STORAGE_KEY } from './sliceLibrary';

afterEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

async function renderApp() {
  return render(<App />);
}

async function openCommandPalette() {
  await userEvent.keyboard('{Control>}k{/Control}');
  await expect.element(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
}

function palette() {
  return page.getByRole('dialog', { name: 'Command palette' });
}

async function waitForScenarioNode(attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    const match = document.querySelector('.scenario-group .scenario-node-card.node');
    if (match) {
      return match as HTMLElement;
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }
  return document.querySelector('.scenario-group .scenario-node-card.node') as HTMLElement | null;
}

describe('App command palette interactions', () => {
  it('shows Show Project Overview in slice mode and enters overview from the command palette', async () => {
    await renderApp();

    await openCommandPalette();

    await expect.element(palette().getByText('Show Project Overview')).toBeVisible();
    expect(
      [...document.querySelectorAll('.command-palette-item-title')]
        .some((element) => element.textContent?.trim() === 'Hide Project Overview')
    ).toBe(false);

    await palette().getByText('Show Project Overview').click();

    await expect.element(page.getByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument();

    await openCommandPalette();

    expect(
      [...document.querySelectorAll('.command-palette-item-title')]
        .some((element) => element.textContent?.trim() === 'Show Project Overview')
    ).toBe(false);
    await expect.element(palette().getByText('Hide Project Overview')).toBeVisible();
  });

  it('shows Hide Project Overview in overview mode and exits overview from the command palette', async () => {
    await renderApp();

    await openCommandPalette();
    await palette().getByText('Show Project Overview').click();

    await openCommandPalette();

    await expect.element(palette().getByText('Hide Project Overview')).toBeVisible();

    await palette().getByText('Hide Project Overview').click();

    await expect.element(page.getByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument();

    await openCommandPalette();

    await expect.element(palette().getByText('Show Project Overview')).toBeVisible();
    expect(
      [...document.querySelectorAll('.command-palette-item-title')]
        .some((element) => element.textContent?.trim() === 'Hide Project Overview')
    ).toBe(false);
  });

  it('keeps dot-prefixed slice filtering focused on slices instead of overview commands', async () => {
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

    await renderApp();

    await openCommandPalette();

    const search = page.getByRole('textbox', { name: 'Filter commands' });
    await search.fill('.be');

    await expect.element(palette().getByText('Beta')).toBeVisible();
    expect(
      [...document.querySelectorAll('.command-palette-item-title')]
        .map((element) => element.textContent?.trim())
        .filter(Boolean)
    ).toEqual(['Beta']);
  });

  it('opens create project dialog from command palette', async () => {
    await renderApp();

    await openCommandPalette();
    await palette().getByText('Create Project...').click();

    await expect.element(page.getByRole('heading', { name: 'Create Project' })).toBeVisible();
  });

  it('does not crash when hovering a scenario node in overview mode', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [
          {
            id: 'slice-a',
            dsl: [
              'slice "Alpha"',
              '',
              'cmd:rename',
              '',
              'scenario "Rename"',
              'given:',
              '  evt:item-created',
              '',
              'when:',
              '  cmd:rename',
              '',
              'then:',
              '  evt:item-renamed'
            ].join('\n')
          }
        ]
      })
    );

    await renderApp();

    await openCommandPalette();
    await palette().getByText('Show Project Overview').click();

    const scenarioNode = await waitForScenarioNode();
    expect(scenarioNode).not.toBeNull();

    scenarioNode?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    expect(document.querySelector('.main .canvas-panel')).not.toBeNull();
  });

  it('opens add node dialog from command palette', async () => {
    await renderApp();

    await openCommandPalette();
    await palette().getByText('Add Node...').click();

    await expect.element(page.getByRole('heading', { name: 'Add Node' })).toBeVisible();
  });

  it('opens import node dialog from command palette', async () => {
    await renderApp();

    await openCommandPalette();
    await palette().getByText('Import Node...').click();

    await expect.element(page.getByRole('heading', { name: 'Import Node' })).toBeVisible();
  });

  it('opens apply slice template dialog from command palette', async () => {
    await renderApp();

    await openCommandPalette();
    await palette().getByText('Apply Slice Template...').click();

    await expect.element(page.getByRole('heading', { name: 'Apply Slice Template' })).toBeVisible();
  });

  it('opens compact event streams dialog from command palette', async () => {
    await renderApp();

    await openCommandPalette();
    await palette().getByText('Compact Event Streams...').click();

    await expect.element(page.getByRole('heading', { name: 'Compact Event Streams' })).toBeVisible();
  });
});
