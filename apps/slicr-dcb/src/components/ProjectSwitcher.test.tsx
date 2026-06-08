// @vitest-environment jsdom

import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ProjectSwitcher} from './ProjectSwitcher';

describe('ProjectSwitcher', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
  });

  it('renders an Add new Project ... entry at the bottom of the dropdown', async () => {
    const onSelectProject = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(ProjectSwitcher, {
          projects: [
            {id: 'project-1', name: 'Checkout Platform'},
            {id: 'project-2', name: 'Inventory System'},
          ],
          activeProjectId: 'project-1',
          onSelectProject,
        }),
      );
    });

    await act(async () => {
      container?.querySelector<HTMLButtonElement>('.project-switcher')?.click();
    });

    const optionLabels = [...container!.querySelectorAll<HTMLButtonElement>('.project-switcher-option')].map((button) => button.textContent);
    expect(optionLabels[optionLabels.length - 1]).toBe('Add new Project ...');
  });

  it('renders a separator line before the Add new Project ... item', async () => {
    const onSelectProject = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(ProjectSwitcher, {
          projects: [
            {id: 'project-1', name: 'Checkout Platform'},
            {id: 'project-2', name: 'Inventory System'},
          ],
          activeProjectId: 'project-1',
          onSelectProject,
        }),
      );
    });

    await act(async () => {
      container?.querySelector<HTMLButtonElement>('.project-switcher')?.click();
    });

    const addButton = container.querySelector<HTMLButtonElement>('.project-switcher-option-add');
    const separator = addButton?.previousElementSibling;

    expect(separator?.classList.contains('project-switcher-separator')).toBe(true);
    expect(separator?.getAttribute('aria-hidden')).toBe('true');
  });

  it('replaces Add new Project ... with an inline input and checkmark button when clicked', async () => {
    const onSelectProject = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(ProjectSwitcher, {
          projects: [
            {id: 'project-1', name: 'Checkout Platform'},
            {id: 'project-2', name: 'Inventory System'},
          ],
          activeProjectId: 'project-1',
          onSelectProject,
        }),
      );
    });

    await act(async () => {
      container?.querySelector<HTMLButtonElement>('.project-switcher')?.click();
    });
    await act(async () => {
      [...container!.querySelectorAll<HTMLButtonElement>('.project-switcher-option')]
        .find((button) => button.textContent === 'Add new Project ...')
        ?.click();
    });

    const inlineInput = container.querySelector<HTMLInputElement>('.project-switcher-option-add-input');
    const checkButton = container.querySelector<HTMLButtonElement>('.project-switcher-option-add-confirm');
    const addOption = container.querySelector('.project-switcher-option-add');

    expect(addOption).toBeNull();
    expect(inlineInput).not.toBeNull();
    expect(inlineInput?.value).toBe('New Project');
    expect(document.activeElement).toBe(inlineInput);
    expect(inlineInput?.selectionStart).toBe(0);
    expect(inlineInput?.selectionEnd).toBe('New Project'.length);
    expect(checkButton).not.toBeNull();
  });

  it('closes the inline project creation without calling AddProject when Escape is pressed', async () => {
    const onSelectProject = vi.fn();
    const onAddProject = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(ProjectSwitcher, {
          projects: [
            {id: 'project-1', name: 'Checkout Platform'},
            {id: 'project-2', name: 'Inventory System'},
          ],
          activeProjectId: 'project-1',
          onSelectProject,
          onAddProject,
        }),
      );
    });

    await act(async () => {
      container?.querySelector<HTMLButtonElement>('.project-switcher')?.click();
    });
    await act(async () => {
      [...container!.querySelectorAll<HTMLButtonElement>('.project-switcher-option')]
        .find((button) => button.textContent === 'Add new Project ...')
        ?.click();
    });
    await act(async () => {
      container?.querySelector<HTMLInputElement>('.project-switcher-option-add-input')?.dispatchEvent(
        new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}),
      );
    });

    expect(onAddProject).not.toHaveBeenCalled();
    expect(container.querySelector('.project-switcher-option-add-input')).toBeNull();
    expect(container.querySelector('.project-switcher-option-add-confirm')).toBeNull();
  });

  it('issues AddProject when Enter is pressed in the inline project-name input', async () => {
    const onSelectProject = vi.fn();
    const onAddProject = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(ProjectSwitcher, {
          projects: [
            {id: 'project-1', name: 'Checkout Platform'},
            {id: 'project-2', name: 'Inventory System'},
          ],
          activeProjectId: 'project-1',
          onSelectProject,
          onAddProject,
        }),
      );
    });

    await act(async () => {
      container?.querySelector<HTMLButtonElement>('.project-switcher')?.click();
    });
    await act(async () => {
      [...container!.querySelectorAll<HTMLButtonElement>('.project-switcher-option')]
        .find((button) => button.textContent === 'Add new Project ...')
        ?.click();
    });
    await act(async () => {
      container?.querySelector<HTMLInputElement>('.project-switcher-option-add-input')?.dispatchEvent(
        new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}),
      );
    });

    expect(onAddProject).toHaveBeenCalledWith('New Project');
    expect(container.querySelector('.project-switcher-option-add-input')).toBeNull();
    expect(container.querySelector('.project-switcher-option-add-confirm')).toBeNull();
  });

  it('issues AddProject when the inline checkmark button is clicked', async () => {
    const onSelectProject = vi.fn();
    const onAddProject = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(ProjectSwitcher, {
          projects: [
            {id: 'project-1', name: 'Checkout Platform'},
            {id: 'project-2', name: 'Inventory System'},
          ],
          activeProjectId: 'project-1',
          onSelectProject,
          onAddProject,
        }),
      );
    });

    await act(async () => {
      container?.querySelector<HTMLButtonElement>('.project-switcher')?.click();
    });
    await act(async () => {
      [...container!.querySelectorAll<HTMLButtonElement>('.project-switcher-option')]
        .find((button) => button.textContent === 'Add new Project ...')
        ?.click();
    });
    await act(async () => {
      container?.querySelector<HTMLButtonElement>('.project-switcher-option-add-confirm')?.click();
    });

    expect(onAddProject).toHaveBeenCalledWith('New Project');
    expect(container.querySelector('.project-switcher-option-add-input')).toBeNull();
    expect(container.querySelector('.project-switcher-option-add-confirm')).toBeNull();
  });

  it('closes the inline project creation without calling AddProject when the input blurs', async () => {
    const onSelectProject = vi.fn();
    const onAddProject = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(ProjectSwitcher, {
          projects: [
            {id: 'project-1', name: 'Checkout Platform'},
            {id: 'project-2', name: 'Inventory System'},
          ],
          activeProjectId: 'project-1',
          onSelectProject,
          onAddProject,
        }),
      );
    });

    await act(async () => {
      container?.querySelector<HTMLButtonElement>('.project-switcher')?.click();
    });
    await act(async () => {
      [...container!.querySelectorAll<HTMLButtonElement>('.project-switcher-option')]
        .find((button) => button.textContent === 'Add new Project ...')
        ?.click();
    });
    await act(async () => {
      container?.querySelector<HTMLInputElement>('.project-switcher-option-add-input')?.blur();
    });

    expect(onAddProject).not.toHaveBeenCalled();
    expect(container.querySelector('.project-switcher-option-add-input')).toBeNull();
    expect(container.querySelector('.project-switcher-option-add-confirm')).toBeNull();
  });
});
