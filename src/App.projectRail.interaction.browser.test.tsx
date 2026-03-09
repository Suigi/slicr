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

async function waitForSliceTitle(text?: string) {
  await waitFor(() => {
    const title = document.querySelector('.slice-title')?.textContent?.trim();
    return text ? title === text : Boolean(title);
  });
}

function ensureProjectRailOpen() {
  const existingRail = document.querySelector('.project-rail') as HTMLElement | null;
  if (existingRail && !existingRail.classList.contains('hidden')) {
    return existingRail;
  }
  const railToggle = document.querySelector('button[aria-label="Toggle project rail"]') as HTMLButtonElement | null;
  expect(railToggle).not.toBeNull();
  act(() => {
    railToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const rail = document.querySelector('.project-rail') as HTMLElement | null;
  expect(rail).not.toBeNull();
  expect(rail?.classList.contains('hidden')).toBe(false);
  return rail as HTMLElement;
}

describe('App project rail interactions', () => {
  it('renders a project rail with all slices from the current project', () => {
    localStorage.setItem(
      'slicr.es.v1.stream.app',
      JSON.stringify([
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
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a1',
      JSON.stringify([
        {
          id: 'a1-1',
          sliceId: 'slice-a1',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Alpha One"\n\nrm:a1' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a2',
      JSON.stringify([
        {
          id: 'a2-1',
          sliceId: 'slice-a2',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Alpha Two"\n\nrm:a2' }
        }
      ])
    );

    renderApp();

    ensureProjectRailOpen();
    const items = [...document.querySelectorAll('.project-rail-slice-item')].map((el) => el.textContent?.trim());
    expect(items).toEqual(['Alpha One', 'Alpha Two']);
  });

  it('toggles project rail visibility from header hamburger button', () => {
    renderApp();

    expect(document.querySelector('.project-rail')?.classList.contains('hidden')).toBe(true);
    const railToggle = document.querySelector('button[aria-label="Toggle project rail"]') as HTMLButtonElement | null;
    expect(railToggle).not.toBeNull();

    act(() => {
      railToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.querySelector('.project-rail')?.classList.contains('hidden')).toBe(false);

    act(() => {
      railToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.querySelector('.project-rail')?.classList.contains('hidden')).toBe(true);
  });

  it('switches project from a dropdown at the top of the project rail', async () => {
    localStorage.setItem(
      'slicr.es.v1.stream.app',
      JSON.stringify([
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
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a1',
      JSON.stringify([
        {
          id: 'a1-1',
          sliceId: 'slice-a1',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Alpha One"\n\nrm:a1' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-b1',
      JSON.stringify([
        {
          id: 'b1-1',
          sliceId: 'slice-b1',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Beta One"\n\nrm:b1' }
        }
      ])
    );

    renderApp();
    await waitForSliceTitle('Alpha One');

    const rail = ensureProjectRailOpen();

    const projectToggle = rail?.querySelector('button[aria-label="Select project"]') as HTMLButtonElement | null;
    expect(projectToggle).not.toBeNull();
    act(() => {
      projectToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const projectBItem = [...(rail?.querySelectorAll('.project-menu-item') ?? [])]
      .find((button) => button.textContent?.includes('Project B')) as HTMLButtonElement | undefined;
    expect(projectBItem).toBeDefined();
    act(() => {
      projectBItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForSliceTitle('Beta One');

    const items = [...document.querySelectorAll('.project-rail-slice-item')].map((el) => el.textContent?.trim());
    expect(items).toEqual(['Beta One']);
    expect(document.querySelector('.slice-title')?.textContent).toBe('Beta One');
  });

  it('creates a project from the rail dropdown and appends a project-created event', () => {
    renderApp();
    const rail = ensureProjectRailOpen();

    const projectToggle = rail?.querySelector('button[aria-label="Select project"]') as HTMLButtonElement | null;
    expect(projectToggle).not.toBeNull();
    act(() => {
      projectToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createProjectItem = [...(rail?.querySelectorAll('.project-menu-item') ?? [])]
      .find((button) => button.textContent?.includes('Create Project')) as HTMLButtonElement | undefined;
    expect(createProjectItem).toBeDefined();
    act(() => {
      createProjectItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const modal = document.querySelector('.project-modal');
    expect(modal).not.toBeNull();
    const input = document.querySelector('#project-name-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    act(() => {
      if (input) {
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(input, 'Payments');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    const createButton = [...document.querySelectorAll('.project-modal-button')]
      .find((button) => button.textContent?.trim() === 'Create') as HTMLButtonElement | undefined;
    expect(createButton).toBeDefined();
    act(() => {
      createButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const appStreamRaw = localStorage.getItem('slicr.es.v1.stream.app');
    expect(appStreamRaw).not.toBeNull();
    const appEvents = JSON.parse(appStreamRaw ?? '[]') as Array<{ type?: string; payload?: { name?: string } }>;
    expect(appEvents.some((event) => event.type === 'project-created' && event.payload?.name === 'Payments')).toBe(true);
  });

  it('closes create project dialog on Escape', () => {
    renderApp();
    const rail = ensureProjectRailOpen();

    const projectToggle = rail?.querySelector('button[aria-label="Select project"]') as HTMLButtonElement | null;
    expect(projectToggle).not.toBeNull();
    act(() => {
      projectToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createProjectItem = [...(rail?.querySelectorAll('.project-menu-item') ?? [])]
      .find((button) => button.textContent?.includes('Create Project')) as HTMLButtonElement | undefined;
    expect(createProjectItem).toBeDefined();
    act(() => {
      createProjectItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const input = document.querySelector('#project-name-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    act(() => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(document.querySelector('.project-modal')).toBeNull();
  });

  it('closes create project dialog on Escape keyup after input blur', () => {
    renderApp();
    const rail = ensureProjectRailOpen();

    const projectToggle = rail?.querySelector('button[aria-label="Select project"]') as HTMLButtonElement | null;
    expect(projectToggle).not.toBeNull();
    act(() => {
      projectToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createProjectItem = [...(rail?.querySelectorAll('.project-menu-item') ?? [])]
      .find((button) => button.textContent?.includes('Create Project')) as HTMLButtonElement | undefined;
    expect(createProjectItem).toBeDefined();
    act(() => {
      createProjectItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const input = document.querySelector('#project-name-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    act(() => {
      input?.blur();
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    });

    expect(document.querySelector('.project-modal')).toBeNull();
  });

  it('creates project on Enter in the create project dialog', () => {
    renderApp();
    const rail = ensureProjectRailOpen();

    const projectToggle = rail?.querySelector('button[aria-label="Select project"]') as HTMLButtonElement | null;
    expect(projectToggle).not.toBeNull();
    act(() => {
      projectToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createProjectItem = [...(rail?.querySelectorAll('.project-menu-item') ?? [])]
      .find((button) => button.textContent?.includes('Create Project')) as HTMLButtonElement | undefined;
    expect(createProjectItem).toBeDefined();
    act(() => {
      createProjectItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const input = document.querySelector('#project-name-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    act(() => {
      if (input) {
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(input, 'Ledger');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    act(() => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(document.querySelector('.project-modal')).toBeNull();
    const appStreamRaw = localStorage.getItem('slicr.es.v1.stream.app');
    expect(appStreamRaw).not.toBeNull();
    const appEvents = JSON.parse(appStreamRaw ?? '[]') as Array<{ type?: string; payload?: { name?: string } }>;
    expect(appEvents.some((event) => event.type === 'project-created' && event.payload?.name === 'Ledger')).toBe(true);
  });
});
