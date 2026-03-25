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

async function waitForSliceTitle(text?: string) {
  await expect.poll(() => document.querySelector('.slice-title')?.textContent?.trim() ?? '').toSatisfy((title) => {
    if (!text) {
      return Boolean(title);
    }
    return title === text;
  });
}

async function ensureProjectRailOpen() {
  const rail = document.querySelector('.project-rail') as HTMLElement | null;
  if (rail && !rail.classList.contains('hidden')) {
    return rail;
  }

  await page.getByRole('button', { name: 'Toggle project rail' }).click();
  await expect.poll(() => document.querySelector('.project-rail')?.classList.contains('hidden')).toBe(false);
  return document.querySelector('.project-rail') as HTMLElement;
}

function projectRailItems() {
  return [...document.querySelectorAll('.project-rail-slice-item')].map((element) => element.textContent?.trim());
}

function setProjectStorage(events: unknown[]) {
  localStorage.setItem('slicr.es.v1.stream.app', JSON.stringify(events));
}

function setSliceStorage(sliceId: string, initialDsl: string) {
  localStorage.setItem(
    `slicr.es.v1.stream.${sliceId}`,
    JSON.stringify([
      {
        id: `${sliceId}-1`,
        sliceId,
        version: 1,
        at: '2026-01-01T00:00:01.000Z',
        type: 'slice-created',
        payload: { initialDsl }
      }
    ])
  );
}

async function openProjectMenu() {
  const rail = await ensureProjectRailOpen();
  const toggle = rail.querySelector('button[aria-label="Select project"]') as HTMLButtonElement | null;
  expect(toggle).not.toBeNull();
  await toggle!.click();
  await expect.element(page.getByRole('menu', { name: 'Project list' })).toBeVisible();
}

describe('App project rail interactions', () => {
  it('renders a project rail with all slices from the current project', async () => {
    setProjectStorage([
      {
        id: 'p-1',
        version: 1,
        at: '2026-01-01T00:00:01.000Z',
        type: 'project-created',
        payload: { projectId: 'project-a', name: 'Project A' }
      },
      {
        id: 'p-2',
        version: 2,
        at: '2026-01-01T00:00:02.000Z',
        type: 'project-created',
        payload: { projectId: 'project-b', name: 'Project B' }
      },
      {
        id: 'p-3',
        version: 3,
        at: '2026-01-01T00:00:03.000Z',
        type: 'project-selected',
        payload: { projectId: 'project-a' }
      },
      {
        id: 'p-4',
        version: 4,
        at: '2026-01-01T00:00:04.000Z',
        type: 'slice-added-to-project',
        payload: { projectId: 'project-a', sliceId: 'slice-a1' }
      },
      {
        id: 'p-5',
        version: 5,
        at: '2026-01-01T00:00:05.000Z',
        type: 'slice-added-to-project',
        payload: { projectId: 'project-a', sliceId: 'slice-a2' }
      },
      {
        id: 'p-6',
        version: 6,
        at: '2026-01-01T00:00:06.000Z',
        type: 'slice-selected',
        payload: { projectId: 'project-a', selectedSliceId: 'slice-a1' }
      }
    ]);
    setSliceStorage('slice-a1', 'slice "Alpha One"\n\nrm:a1');
    setSliceStorage('slice-a2', 'slice "Alpha Two"\n\nrm:a2');

    await renderApp();
    await ensureProjectRailOpen();

    expect(projectRailItems()).toEqual(['Alpha One', 'Alpha Two']);
  });

  it('toggles project rail visibility from header hamburger button', async () => {
    await renderApp();

    expect(document.querySelector('.project-rail')?.classList.contains('hidden')).toBe(true);

    const railToggle = page.getByRole('button', { name: 'Toggle project rail' });
    await railToggle.click();
    expect(document.querySelector('.project-rail')?.classList.contains('hidden')).toBe(false);

    await railToggle.click();
    expect(document.querySelector('.project-rail')?.classList.contains('hidden')).toBe(true);
  });

  it('switches project from a dropdown at the top of the project rail', async () => {
    setProjectStorage([
      {
        id: 'p-1',
        version: 1,
        at: '2026-01-01T00:00:01.000Z',
        type: 'project-created',
        payload: { projectId: 'project-a', name: 'Project A' }
      },
      {
        id: 'p-2',
        version: 2,
        at: '2026-01-01T00:00:02.000Z',
        type: 'project-created',
        payload: { projectId: 'project-b', name: 'Project B' }
      },
      {
        id: 'p-3',
        version: 3,
        at: '2026-01-01T00:00:03.000Z',
        type: 'project-selected',
        payload: { projectId: 'project-a' }
      },
      {
        id: 'p-4',
        version: 4,
        at: '2026-01-01T00:00:04.000Z',
        type: 'slice-added-to-project',
        payload: { projectId: 'project-a', sliceId: 'slice-a1' }
      },
      {
        id: 'p-5',
        version: 5,
        at: '2026-01-01T00:00:05.000Z',
        type: 'slice-added-to-project',
        payload: { projectId: 'project-b', sliceId: 'slice-b1' }
      },
      {
        id: 'p-6',
        version: 6,
        at: '2026-01-01T00:00:06.000Z',
        type: 'slice-selected',
        payload: { projectId: 'project-a', selectedSliceId: 'slice-a1' }
      }
    ]);
    setSliceStorage('slice-a1', 'slice "Alpha One"\n\nrm:a1');
    setSliceStorage('slice-b1', 'slice "Beta One"\n\nrm:b1');

    await renderApp();
    await waitForSliceTitle('Alpha One');
    await openProjectMenu();

    await page.getByRole('menuitemradio', { name: 'Project B' }).click();
    await waitForSliceTitle('Beta One');

    expect(projectRailItems()).toEqual(['Beta One']);
    expect(document.querySelector('.slice-title')?.textContent).toBe('Beta One');
  });

  it('creates a project from the rail dropdown and appends a project-created event', async () => {
    await renderApp();
    await openProjectMenu();

    await page.getByRole('menuitem', { name: 'Create Project ...' }).click();
    await expect.element(page.getByRole('dialog', { name: 'Create project' })).toBeVisible();

    const input = page.getByLabelText('Project name');
    await input.fill('Payments');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect.element(page.getByRole('dialog', { name: 'Create project' })).not.toBeInTheDocument();
    const appEvents = JSON.parse(localStorage.getItem('slicr.es.v1.stream.app') ?? '[]') as Array<{ type?: string; payload?: { name?: string } }>;
    expect(appEvents.some((event) => event.type === 'project-created' && event.payload?.name === 'Payments')).toBe(true);
  });

  it('closes create project dialog on Escape', async () => {
    await renderApp();
    await openProjectMenu();

    await page.getByRole('menuitem', { name: 'Create Project ...' }).click();
    await expect.element(page.getByRole('dialog', { name: 'Create project' })).toBeVisible();

    await userEvent.keyboard('{Escape}');

    await expect.element(page.getByRole('dialog', { name: 'Create project' })).not.toBeInTheDocument();
  });

  it('closes create project dialog on Escape keyup after input blur', async () => {
    await renderApp();
    await openProjectMenu();

    await page.getByRole('menuitem', { name: 'Create Project ...' }).click();
    await expect.element(page.getByRole('dialog', { name: 'Create project' })).toBeVisible();

    const inputElement = document.querySelector('#project-name-input') as HTMLInputElement | null;
    inputElement?.blur();
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));

    await expect.element(page.getByRole('dialog', { name: 'Create project' })).not.toBeInTheDocument();
  });

  it('creates project on Enter in the create project dialog', async () => {
    await renderApp();
    await openProjectMenu();

    await page.getByRole('menuitem', { name: 'Create Project ...' }).click();
    await expect.element(page.getByRole('dialog', { name: 'Create project' })).toBeVisible();

    const input = page.getByLabelText('Project name');
    await input.fill('Ledger');
    await input.click();
    await userEvent.keyboard('{Enter}');

    await expect.element(page.getByRole('dialog', { name: 'Create project' })).not.toBeInTheDocument();
    const appEvents = JSON.parse(localStorage.getItem('slicr.es.v1.stream.app') ?? '[]') as Array<{ type?: string; payload?: { name?: string } }>;
    expect(appEvents.some((event) => event.type === 'project-created' && event.payload?.name === 'Ledger')).toBe(true);
  });
});
