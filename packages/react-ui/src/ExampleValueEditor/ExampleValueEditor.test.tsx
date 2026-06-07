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
  it('is exported publicly and shows scalar value editing without schema controls', () => {
    const property: EditableProperty = { id: 'title-id', name: 'title', type: 'string', example: 'Draft' };
    const onChange = vi.fn();
    const { container } = renderExampleValueEditor([property], onChange);
    const row = container.querySelector<HTMLElement>(':scope .property-editor > .property-editor-grid > .property-editor-row');
    const exampleInput = row?.querySelector<HTMLInputElement>('input[type="text"]');

    expect(ExampleValueEditor).toBeTypeOf('function');
    expect(container.querySelector('[role="columnheader"]')).toBeNull();
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

  it('edits object-list example rows with read-only schema labels', () => {
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
    const nestedEditor = container.querySelector<HTMLElement>('.property-editor-nested .property-editor');
    const nestedSkuInput = nestedEditor?.querySelector('input[value="sku"]');
    const listValueInput = container.querySelector<HTMLInputElement>('input[aria-label="sku example value"]');
    const addValueInput = container.querySelector<HTMLInputElement>('input[aria-label="Add sku example value"]');
    const removeButton = container.querySelector<HTMLButtonElement>('button[aria-label="Remove example value"]');

    expect(nestedEditor).not.toBeNull();
    expect(nestedSkuInput).toBeNull();
    expect(nestedEditor?.textContent).toContain('sku');
    expect(nestedEditor?.querySelector('button[aria-label="Property settings"]')).toBeNull();
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
});
