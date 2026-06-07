// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SchemaEditor, type EditableProperty } from '../index';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

function renderSchemaEditor(properties: EditableProperty[], onChange = vi.fn()) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<SchemaEditor properties={properties} onChange={onChange} />);
  });

  return { container, onChange };
}

function setInputValue(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = undefined;
  document.body.replaceChildren();
});

describe('SchemaEditor', () => {
  it('is exported from the package root', () => {
    expect(SchemaEditor).toBeTypeOf('function');
  });

  it('keeps schema settings but hides editable example-value inputs', () => {
    const { container } = renderSchemaEditor([
      {
        id: 'status-id',
        name: 'status',
        type: 'string',
        example: 'draft',
        list: true,
        exampleValues: ['draft', 'published'],
      },
    ]);

    expect(container.querySelector('button[aria-label="Property settings"]')).not.toBeNull();
    expect(container.querySelector('input[placeholder="optional"]')).toBeNull();
    expect(container.querySelector('input[aria-label="Add example value"]')).toBeNull();
    expect(container.querySelector('.property-editor-list-value-row')).toBeNull();
  });

  it('edits nested object schema rows without showing nested example-value list editors', () => {
    const property: EditableProperty = {
      id: 'item-id',
      name: 'item',
      type: 'Object',
      properties: [
        {
          id: 'tags-id',
          name: 'tags',
          type: 'string',
          list: true,
          exampleValues: ['a'],
        },
      ],
    };
    const onChange = vi.fn();
    const { container } = renderSchemaEditor([property], onChange);
    const nestedEditor = container.querySelector<HTMLElement>('.property-editor-nested .property-editor');
    const nestedNameInput = nestedEditor?.querySelector<HTMLInputElement>('input[value="tags"]');

    expect(nestedEditor).not.toBeNull();
    expect(nestedEditor?.querySelector('input[aria-label="Add example value"]')).toBeNull();
    expect(nestedEditor?.querySelector('.property-editor-list-value-row')).toBeNull();
    expect(nestedEditor?.querySelector('input[aria-label="Example is available after adding the property"]')).toBeNull();

    setInputValue(nestedNameInput!, 'labels');

    expect(onChange).toHaveBeenCalledWith([
      {
        ...property,
        properties: [
          {
            id: 'tags-id',
            name: 'labels',
            type: 'string',
            list: true,
            exampleValues: ['a'],
          },
        ],
      },
    ]);
  });
});
