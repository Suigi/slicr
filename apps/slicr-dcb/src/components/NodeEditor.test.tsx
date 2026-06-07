// @vitest-environment jsdom

import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {EditableProperty} from '@slicr/react-ui';
import {NodeEditor} from './NodeEditor';

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

function renderNodeEditor(properties: EditableProperty[], onChange = vi.fn()) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<NodeEditor properties={properties} onChange={onChange} />);
  });

  return {container, onChange};
}

function ControlledNodeEditor({
  initialProperties,
  onChange,
}: {
  initialProperties: EditableProperty[];
  onChange: (properties: EditableProperty[]) => void;
}) {
  const [properties, setProperties] = React.useState(initialProperties);

  return (
    <NodeEditor
      properties={properties}
      onChange={(updatedProperties) => {
        onChange(updatedProperties);
        setProperties(updatedProperties);
      }}
    />
  );
}

function renderControlledNodeEditor(initialProperties: EditableProperty[], onChange = vi.fn()) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<ControlledNodeEditor initialProperties={initialProperties} onChange={onChange} />);
  });

  return {container, onChange};
}

function setInputValue(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = undefined;
  document.body.replaceChildren();
});

describe('NodeEditor', () => {
  it('preserves example values when schema edits rename a property', () => {
    const properties: EditableProperty[] = [
      {id: 'prop-title', name: 'title', type: 'string', example: 'Hello world'},
    ];
    const onChange = vi.fn();
    const {container} = renderNodeEditor(properties, onChange);
    const schemaNameInput = container.querySelector<HTMLInputElement>('.node-editor-schema input[value="title"]');

    expect(schemaNameInput).toBeDefined();

    setInputValue(schemaNameInput!, 'headline');

    expect(onChange).toHaveBeenCalledWith([
      {id: 'prop-title', name: 'headline', type: 'string', example: 'Hello world'},
    ]);
  });

  it('preserves nested object-list example values added from the template row', () => {
    const properties: EditableProperty[] = [
      {
        id: 'prop-lines',
        name: 'lines',
        type: 'Object',
        list: true,
        properties: [
          {
            id: 'prop-discount',
            name: 'discount',
            type: 'Object',
            properties: [{id: 'prop-code', name: 'code', type: 'string'}],
          },
        ],
      },
    ];
    const onChange = vi.fn();
    const {container} = renderControlledNodeEditor(properties, onChange);
    const addDiscountInput = container.querySelector<HTMLInputElement>('[aria-label="Add discount example value"]');

    expect(addDiscountInput).toBeDefined();

    setInputValue(addDiscountInput!, 'SPRING');
    act(() => {
      addDiscountInput?.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
    });

    expect(onChange).toHaveBeenCalledWith([
      {
        id: 'prop-lines',
        name: 'lines',
        type: 'Object',
        list: true,
        properties: [
          {
            id: 'prop-discount',
            name: 'discount',
            type: 'Object',
            properties: [{id: 'prop-code', name: 'code', type: 'string'}],
          },
        ],
        rows: [{
          'prop-discount': {
            'prop-code': 'SPRING',
          },
        }],
      },
    ]);
  });

  it('preserves newly added nested complex-list example rows', () => {
    const properties: EditableProperty[] = [
      {
        id: 'prop-order',
        name: 'order',
        type: 'Object',
        properties: [
          {
            id: 'prop-lines',
            name: 'lines',
            type: 'Object',
            list: true,
            properties: [{id: 'prop-sku', name: 'sku', type: 'string'}],
          },
        ],
      },
    ];
    const onChange = vi.fn();
    const {container} = renderControlledNodeEditor(properties, onChange);
    const addSkuInput = container.querySelector<HTMLInputElement>('[aria-label="Add sku example value"]');

    expect(addSkuInput).toBeDefined();

    setInputValue(addSkuInput!, 'ABC-123');
    act(() => {
      addSkuInput?.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
    });

    expect(onChange).toHaveBeenCalledWith([
      {
        id: 'prop-order',
        name: 'order',
        type: 'Object',
        properties: [
          {
            id: 'prop-lines',
            name: 'lines',
            type: 'Object',
            list: true,
            properties: [{id: 'prop-sku', name: 'sku', type: 'string'}],
            rows: [{'prop-sku': 'ABC-123'}],
          },
        ],
      },
    ]);
  });
});
