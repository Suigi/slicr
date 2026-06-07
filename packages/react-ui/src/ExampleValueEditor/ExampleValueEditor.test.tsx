// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExampleValueEditor, type EditableProperty } from '../index';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

function renderExampleValueEditor(properties: EditableProperty[], onChange = vi.fn()) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<ExampleValueEditor properties={properties} onChange={onChange} />);
  });

  return { container, onChange };
}

function renderFocusedExampleValueEditor(properties: EditableProperty[], focusedPropertyId: string | null) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<ExampleValueEditor properties={properties} onChange={() => undefined} focusedPropertyId={focusedPropertyId} />);
  });

  return { container };
}

function setInputValue(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function click(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = undefined;
  document.body.replaceChildren();
});

describe('ExampleValueEditor', () => {
  it('is exported publicly and shows Name and Value headers without schema controls', () => {
    const property: EditableProperty = { id: 'title-id', name: 'title', type: 'string', example: 'Draft' };
    const onChange = vi.fn();
    const { container } = renderExampleValueEditor([property], onChange);
    const row = container.querySelector<HTMLElement>(':scope .property-editor > .property-editor-grid > .property-editor-row');
    const exampleInput = row?.querySelector<HTMLInputElement>('input[type="text"]');
    const headers = [...container.querySelectorAll('[role="columnheader"]')].map((header) => header.textContent);

    expect(ExampleValueEditor).toBeTypeOf('function');
    expect(headers).toEqual(['Name', 'Value']);
    expect(container.querySelector('button[aria-label="Property settings"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Remove property"]')).toBeNull();
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('input[placeholder="Add property"]')).toBeNull();
    expect(row?.textContent).toContain('title');
    expect(row?.querySelector('input[value="title"]')).toBeNull();
    expect(exampleInput?.value).toBe('Draft');

    setInputValue(exampleInput!, 'Published');

    expect(onChange).toHaveBeenCalledWith([{ ...property, example: 'Published' }]);
  });

  it('edits object-list example rows without rendering duplicate nested property rows', () => {
    const property: EditableProperty = {
      id: 'item-id',
      name: 'item',
      type: 'Object',
      list: true,
      properties: [{ id: 'sku-id', name: 'sku', type: 'string', example: 'ABC' }],
      rows: [{ 'sku-id': 'ABC' }],
    };
    const onChange = vi.fn();
    const { container } = renderExampleValueEditor([property], onChange);
    const topLevelRow = container.querySelector<HTMLElement>(':scope .property-editor > .property-editor-grid > .property-editor-row');
    const nestedEditor = container.querySelector<HTMLElement>('.property-editor-nested .property-editor');
    const listHeaderCells = [...container.querySelectorAll<HTMLElement>('.property-editor-list-table thead th')].map((cell) => cell.textContent);
    const listValueInput = container.querySelector<HTMLInputElement>('input[aria-label="sku example value"]');
    const addValueInput = container.querySelector<HTMLInputElement>('input[aria-label="Add sku example value"]');
    const removeButton = container.querySelector<HTMLButtonElement>('button[aria-label="Remove example value"]');

    expect(topLevelRow?.textContent).toContain('item');
    expect(topLevelRow?.textContent).toContain('{...}');
    expect(nestedEditor).toBeNull();
    expect(listHeaderCells).toEqual(['', 'sku', '']);
    expect(listValueInput?.value).toBe('ABC');

    setInputValue(listValueInput!, 'DEF');
    expect(onChange).toHaveBeenNthCalledWith(1, [{ ...property, rows: [{ 'sku-id': 'DEF' }] }]);

    setInputValue(addValueInput!, 'XYZ');
    act(() => {
      addValueInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(onChange).toHaveBeenNthCalledWith(2, [{ ...property, rows: [{ 'sku-id': 'ABC' }, { 'sku-id': 'XYZ' }] }]);

    click(removeButton!);
    expect(onChange).toHaveBeenNthCalledWith(3, [{ ...property, rows: [] }]);
  });

  it('keeps the top-level placeholder row for complex list values', () => {
    const property: EditableProperty = {
      id: 'items-id',
      name: 'items',
      type: 'Object',
      list: true,
      properties: [{ id: 'sku-id', name: 'sku', type: 'string' }],
      rows: [{ 'sku-id': 'ABC' }, { 'sku-id': 'DEF' }],
    };
    const { container } = renderExampleValueEditor([property]);
    const rootEditor = container.querySelector<HTMLElement>(':scope > .property-editor');
    const topLevelRows = rootEditor?.querySelectorAll<HTMLElement>(':scope > .property-editor-grid > .property-editor-row');
    const listTableRows = container.querySelectorAll<HTMLElement>('.property-editor-list-table tbody tr');
    const nestedEditor = container.querySelector('.property-editor-nested .property-editor');

    expect(topLevelRows).toHaveLength(1);
    expect(listTableRows).toHaveLength(3);
    expect(nestedEditor).toBeNull();
    expect(container.textContent).toContain('{...}');
  });

  it('drops stale scalar example data after a property becomes complex', () => {
    const property: EditableProperty = {
      id: 'item-id',
      name: 'item',
      type: 'Object',
      example: 'Legacy scalar',
      properties: [{ id: 'sku-id', name: 'sku', type: 'string', example: 'ABC' }],
    };
    const onChange = vi.fn();
    const { container } = renderExampleValueEditor([property], onChange);
    const nestedExampleInput = container.querySelector<HTMLInputElement>('.property-editor-nested input[type="text"]');

    setInputValue(nestedExampleInput!, 'DEF');

    expect(onChange).toHaveBeenCalledWith([
      {
        id: 'item-id',
        name: 'item',
        type: 'Object',
        properties: [{ id: 'sku-id', name: 'sku', type: 'string', example: 'DEF' }],
      },
    ]);
  });

  it('applies focusedPropertyId to the matching object-list example table column in value-only mode', () => {
    const property: EditableProperty = {
      id: 'columns-id',
      name: 'columns',
      type: 'Object',
      list: true,
      properties: [
        { id: 'field-id', name: 'field', type: 'string', example: 'firstName' },
        { id: 'label-id', name: 'label', type: 'string', example: 'First name' },
      ],
      rows: [
        { 'field-id': 'firstName', 'label-id': 'First name' },
        { 'field-id': 'lastName', 'label-id': 'Last name' },
      ],
    };
    const { container } = renderFocusedExampleValueEditor([property], 'field-id');

    const highlightedCells = [...container.querySelectorAll<HTMLElement>('.property-editor-list-table .is-property-highlighted')];
    const highlightedValues = highlightedCells.map((cell) => {
      const input = cell.querySelector<HTMLInputElement>('input');
      return input ? input.value : cell.textContent;
    });
    const topLevelRow = container.querySelector<HTMLElement>(':scope .property-editor > .property-editor-grid > .property-editor-row');

    expect(topLevelRow?.classList.contains('property-editor-row-focused')).toBe(false);
    expect(highlightedValues).toEqual(['field', 'firstName', 'lastName']);
  });

  it('highlights the primitive-list property when focusedPropertyId matches the parent list property id', () => {
    const property: EditableProperty = {
      id: 'tags-id',
      name: 'tags',
      type: 'string',
      list: true,
      exampleValues: ['alpha', 'beta'],
    };
    const { container } = renderFocusedExampleValueEditor([property], 'tags-id');

    const topLevelRow = container.querySelector<HTMLElement>(':scope .property-editor > .property-editor-grid > .property-editor-row');
    const listEditor = container.querySelector<HTMLElement>('.property-editor-list-editor');
    const listRows = [...container.querySelectorAll<HTMLElement>('.property-editor-list-value-row:not(.property-editor-template-row)')];

    expect(topLevelRow?.classList.contains('property-editor-row-focused')).toBe(true);
    expect(listEditor?.classList.contains('is-property-highlighted')).toBe(true);
    expect(listRows.every((row) => row.classList.contains('property-editor-row-focused'))).toBe(false);
  });
});
