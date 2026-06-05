import { page, userEvent } from 'vitest/browser';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PropertyEditor, type EditableProperty } from './PropertyEditor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

function renderPropertyEditor(properties: EditableProperty[], onChange = vi.fn()) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<PropertyEditor properties={properties} onChange={onChange} />);
  });

  return { container, onChange };
}

function ControlledPropertyEditor({ initialProperties, onChange }: { initialProperties: EditableProperty[]; onChange: (properties: EditableProperty[]) => void }) {
  const [properties, setProperties] = useState(initialProperties);

  return (
    <PropertyEditor
      properties={properties}
      onChange={(updatedProperties) => {
        onChange(updatedProperties);
        setProperties(updatedProperties);
      }}
    />
  );
}

function renderControlledPropertyEditor(initialProperties: EditableProperty[], onChange = vi.fn()) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<ControlledPropertyEditor initialProperties={initialProperties} onChange={onChange} />);
  });

  return { container, onChange };
}

function propertyRows(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(':scope .property-editor > .property-editor-grid > .property-editor-row:not(.property-editor-template-row)')];
}

function waitForTimers() {
  return new Promise((resolve) => setTimeout(resolve));
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = undefined;
  document.body.replaceChildren();
});

describe('PropertyEditor browser interactions', () => {
  it('reorders top-level properties with browser drag and drop', async () => {
    const onChange = vi.fn();
    const { container } = renderPropertyEditor([
      { id: 'first-id', name: 'first', type: 'string', example: '1' },
      { id: 'second-id', name: 'second', type: 'number', example: '2' },
    ], onChange);
    const [firstRow, secondRow] = propertyRows(container);
    const firstDragHandle = firstRow?.querySelector<HTMLButtonElement>('.property-editor-drag-handle');

    expect(firstDragHandle).toBeDefined();
    expect(secondRow).toBeDefined();

    await page.elementLocator(firstDragHandle!).dropTo(page.elementLocator(secondRow!));

    expect(onChange).toHaveBeenCalledWith([
      { id: 'second-id', name: 'second', type: 'number', example: '2' },
      { id: 'first-id', name: 'first', type: 'string', example: '1' },
    ]);
  });

  it('reorders primitive list example values with browser drag and drop', async () => {
    const onChange = vi.fn();
    const { container } = renderPropertyEditor([
      {
        id: 'status-id',
        name: 'status',
        type: 'string',
        list: true,
        exampleValues: ['new', 'done'],
      },
    ], onChange);
    const exampleRows = [...container.querySelectorAll<HTMLElement>('.property-editor-list-value-row:not(.property-editor-template-row)')];
    const firstDragHandle = exampleRows[0]?.querySelector<HTMLButtonElement>('.property-editor-list-drag-handle');

    expect(firstDragHandle).toBeDefined();
    expect(exampleRows[1]).toBeDefined();

    await page.elementLocator(firstDragHandle!).dropTo(page.elementLocator(exampleRows[1]!));

    expect(onChange).toHaveBeenCalledWith([
      {
        id: 'status-id',
        name: 'status',
        type: 'string',
        list: true,
        exampleValues: ['done', 'new'],
      },
    ]);
  });

  it('reorders properties with the browser keyboard shortcut', async () => {
    const onChange = vi.fn();
    const { container } = renderPropertyEditor([
      { id: 'first-id', name: 'first', type: 'string', example: '1' },
      { id: 'second-id', name: 'second', type: 'number', example: '2' },
    ], onChange);
    const firstNameInput = propertyRows(container)[0]?.querySelector<HTMLInputElement>('input[type="text"]');

    expect(firstNameInput).toBeDefined();
    firstNameInput!.focus();
    await userEvent.keyboard('{Control>}{Shift>}{ArrowDown}{/Shift}{/Control}');

    expect(onChange).toHaveBeenCalledWith([
      { id: 'second-id', name: 'second', type: 'number', example: '2' },
      { id: 'first-id', name: 'first', type: 'string', example: '1' },
    ]);
  });

  it('adds a property from the template row with Tab and focuses the new type select', async () => {
    const onChange = vi.fn();
    const { container } = renderControlledPropertyEditor([], onChange);
    const addNameInput = container.querySelector<HTMLInputElement>('input[placeholder="Add property"]');

    expect(addNameInput).toBeDefined();
    await userEvent.fill(addNameInput!, 'title');
    await userEvent.tab();
    await waitForTimers();

    const rows = propertyRows(container);
    const newTypeSelect = rows[0]?.querySelector<HTMLSelectElement>('select');

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ name: 'title', type: 'string', example: '' })]);
    expect(document.activeElement).toBe(newTypeSelect);
  });
});
