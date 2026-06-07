// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PropertyEditor, type EditableProperty } from './PropertyEditor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let nextId = 0;

function renderPropertyEditor(properties: EditableProperty[], onChange = vi.fn(), props: Partial<Parameters<typeof PropertyEditor>[0]> = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<PropertyEditor properties={properties} onChange={onChange} {...props} />);
  });

  return { container, onChange };
}

function getPropertyRows(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(':scope .property-editor > .property-editor-grid > .property-editor-row:not(.property-editor-template-row)')];
}

function setInputValue(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function click(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function keyDown(element: HTMLElement, key: string) {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

beforeEach(() => {
  nextId = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `property-${++nextId}` as `${string}-${string}-${string}-${string}-${string}`);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('PropertyEditor', () => {
  it('renders existing properties with column headers', () => {
    const { container } = renderPropertyEditor([
      { id: 'name-id', name: 'name', type: 'string', example: 'Alice' },
      { id: 'age-id', name: 'age', type: 'number', example: '42' },
    ]);

    expect([...container.querySelectorAll('[role="columnheader"]')].map((header) => header.textContent)).toEqual([
      '',
      'Name',
      'Type',
      'Example',
      '',
    ]);
    expect(getPropertyRows(container)).toHaveLength(2);
    expect(container.querySelector<HTMLInputElement>('input[value="name"]')?.value).toBe('name');
    expect(container.querySelector<HTMLInputElement>('input[value="Alice"]')?.value).toBe('Alice');
    expect(container.querySelector<HTMLInputElement>('input[value="age"]')?.value).toBe('age');
  });

  it('does not synthesize ids for invalid id-less input during normal rendering', () => {
    const onChange = vi.fn();

    renderPropertyEditor([
      {
        name: 'items',
        type: 'Object',
        list: true,
        properties: [{ name: 'sku', type: 'string', example: 'ABC' }],
        rows: [{ sku: 'ABC' }],
      } as unknown as EditableProperty,
    ], onChange);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('adds a property from the template row when Enter is pressed', () => {
    const onChange = vi.fn();
    const { container } = renderPropertyEditor([], onChange);
    const addNameInput = container.querySelector<HTMLInputElement>('input[placeholder="Add property"]');

    expect(addNameInput).not.toBeNull();
    setInputValue(addNameInput!, 'title');
    keyDown(addNameInput!, 'Enter');

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'property-1', name: 'title', type: 'string', example: '' }),
    ]);
    expect(addNameInput?.value).toBe('');
  });

  it('edits a property name, type, and example value', () => {
    const property: EditableProperty = { id: 'title-id', name: 'title', type: 'string', example: 'old' };
    const onChange = vi.fn();
    const { container } = renderPropertyEditor([property], onChange);
    const row = getPropertyRows(container)[0]!;
    const [nameInput, exampleInput] = [...row.querySelectorAll<HTMLInputElement>('input[type="text"]')];
    const typeSelect = row.querySelector<HTMLSelectElement>('select');

    setInputValue(nameInput!, 'heading');
    expect(onChange).toHaveBeenLastCalledWith([{ ...property, name: 'heading' }]);

    setSelectValue(typeSelect!, 'number');
    expect(onChange).toHaveBeenLastCalledWith([{ ...property, type: 'number', properties: undefined }]);

    setInputValue(exampleInput!, 'new');
    expect(onChange).toHaveBeenLastCalledWith([{ ...property, example: 'new' }]);
  });

  it('removes a property', () => {
    const onChange = vi.fn();
    const { container } = renderPropertyEditor([
      { id: 'first-id', name: 'first', type: 'string', example: '' },
      { id: 'second-id', name: 'second', type: 'boolean', example: 'true' },
    ], onChange);
    const firstRemoveButton = getPropertyRows(container)[0]?.querySelector<HTMLButtonElement>('button[aria-label="Remove property"]');

    expect(firstRemoveButton).not.toBeNull();
    click(firstRemoveButton!);

    expect(onChange).toHaveBeenCalledWith([{ id: 'second-id', name: 'second', type: 'boolean', example: 'true' }]);
  });

  it('initializes primitive example values when list mode is enabled', () => {
    const property: EditableProperty = { id: 'tags-id', name: 'tags', type: 'string', example: 'urgent' };
    const onChange = vi.fn();
    const { container } = renderPropertyEditor([property], onChange);
    const settingsButton = container.querySelector<HTMLButtonElement>('button[aria-label="Property settings"]');

    click(settingsButton!);
    const listCheckbox = container.querySelector<HTMLInputElement>('.property-editor-toolbar input[type="checkbox"]');
    click(listCheckbox!);

    expect(onChange).toHaveBeenCalledWith([{ ...property, list: true, exampleValues: ['urgent'] }]);
  });

  it('renders and updates nested object properties through the parent onChange', () => {
    const property: EditableProperty = {
      id: 'item-id',
      name: 'item',
      type: 'Object',
      properties: [{ id: 'sku-id', name: 'sku', type: 'string', example: 'ABC' }],
    };
    const onChange = vi.fn();
    const { container } = renderPropertyEditor([property], onChange);
    const nestedEditor = container.querySelector<HTMLElement>('.property-editor-nested .property-editor');
    const nestedNameInput = nestedEditor?.querySelector<HTMLInputElement>('input[value="sku"]');

    expect(nestedEditor).not.toBeNull();
    expect(nestedNameInput).not.toBeNull();

    setInputValue(nestedNameInput!, 'code');

    expect(onChange).toHaveBeenCalledWith([
      {
        ...property,
        properties: [{ id: 'sku-id', name: 'code', type: 'string', example: 'ABC' }],
      },
    ]);
  });

  it('shows a limited settings toolbar for nested object properties', () => {
    const property: EditableProperty = {
      id: 'item-id',
      name: 'item',
      type: 'Object',
      properties: [{ id: 'sku-id', name: 'sku', type: 'string', example: 'ABC' }],
    };
    const { container } = renderPropertyEditor([property]);
    const nestedEditor = container.querySelector<HTMLElement>('.property-editor-nested .property-editor');
    const nestedSettingsButton = nestedEditor?.querySelector<HTMLButtonElement>('button[aria-label="Property settings"]');

    expect(nestedSettingsButton).not.toBeNull();

    click(nestedSettingsButton!);

    const nestedToolbar = nestedEditor?.querySelector<HTMLElement>('.property-editor-toolbar');
    const nestedToolbarText = nestedToolbar?.textContent ?? '';

    expect(nestedToolbar).not.toBeNull();
    expect(nestedToolbarText).toContain('List');
    expect(nestedToolbarText).toContain('Optional');
    expect(nestedToolbarText).not.toContain('Generated');
    expect(nestedToolbarText).not.toContain('Tag');
    expect(nestedToolbar?.querySelector('.property-editor-tag-name-input')).toBeNull();
  });

  it('hides property toolbar, column headers, and editable examples when configured', () => {
    const { container } = renderPropertyEditor(
      [{ id: 'title-id', name: 'title', type: 'string', example: 'hello' }],
      vi.fn(),
      { showPropertyToolbar: false, showColumnHeaders: false, disableExampleValues: true },
    );
    const row = getPropertyRows(container)[0]!;

    expect(container.querySelector('[role="columnheader"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Property settings"]')).toBeNull();
    expect(row.querySelector('input[placeholder="optional"]')).toBeNull();
    expect(row.textContent).toContain('[...]');
  });
});
