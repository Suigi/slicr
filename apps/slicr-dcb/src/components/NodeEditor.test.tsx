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

function FocusSynchronizedNodeEditor({properties}: {properties: EditableProperty[]}) {
  const [focusedPropertyId, setFocusedPropertyId] = React.useState<string | null>(null);

  return (
    <NodeEditor
      properties={properties}
      onChange={() => undefined}
      focusedPropertyId={focusedPropertyId}
      onFocusedPropertyChange={setFocusedPropertyId}
    />
  );
}

function renderFocusSynchronizedNodeEditor(properties: EditableProperty[]) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<FocusSynchronizedNodeEditor properties={properties} />);
  });

  return {container};
}

function getDirectPropertyRows(section: HTMLElement) {
  return [...section.querySelectorAll<HTMLElement>(':scope .property-editor > .property-editor-grid > .property-editor-row:not(.property-editor-template-row)')];
}

function getTopLevelPropertyRows(section: HTMLElement) {
  const editor = section.querySelector<HTMLElement>(':scope > .property-editor');
  return [...(editor?.querySelectorAll<HTMLElement>(':scope > .property-editor-grid > .property-editor-row:not(.property-editor-template-row)') ?? [])];
}

function getNestedPropertyRows(section: HTMLElement) {
  const nestedEditor = section.querySelector<HTMLElement>('.property-editor-nested .property-editor');
  return [...(nestedEditor?.querySelectorAll<HTMLElement>(':scope > .property-editor-grid > .property-editor-row:not(.property-editor-template-row)') ?? [])];
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
  it('highlights the matching example value row when a schema property receives focus', () => {
    const properties: EditableProperty[] = [
      {id: 'prop-title', name: 'title', type: 'string', example: 'Hello world'},
      {id: 'prop-summary', name: 'summary', type: 'string', example: 'Short summary'},
    ];
    const {container} = renderFocusSynchronizedNodeEditor(properties);
    const schemaSection = container.querySelector<HTMLElement>('.node-editor-schema');
    const exampleSection = container.querySelector<HTMLElement>('.node-editor-example');
    const schemaNameInput = schemaSection?.querySelector<HTMLInputElement>('input[value="title"]');

    expect(schemaNameInput).toBeDefined();

    act(() => {
      schemaNameInput?.focus();
    });

    const exampleRows = getDirectPropertyRows(exampleSection!);
    expect(exampleRows[0]?.classList.contains('property-editor-row-focused')).toBe(true);
    expect(exampleRows[1]?.classList.contains('property-editor-row-focused')).toBe(false);
  });

  it('highlights the matching schema row when an example value property receives focus', () => {
    const properties: EditableProperty[] = [
      {id: 'prop-title', name: 'title', type: 'string', example: 'Hello world'},
      {id: 'prop-summary', name: 'summary', type: 'string', example: 'Short summary'},
    ];
    const {container} = renderFocusSynchronizedNodeEditor(properties);
    const schemaSection = container.querySelector<HTMLElement>('.node-editor-schema');
    const exampleSection = container.querySelector<HTMLElement>('.node-editor-example');
    const summaryExampleInput = exampleSection?.querySelector<HTMLInputElement>('input[value="Short summary"]');

    expect(summaryExampleInput).toBeDefined();

    act(() => {
      summaryExampleInput?.focus();
    });

    const schemaRows = getDirectPropertyRows(schemaSection!);
    expect(schemaRows[0]?.classList.contains('property-editor-row-focused')).toBe(false);
    expect(schemaRows[1]?.classList.contains('property-editor-row-focused')).toBe(true);
  });

  it('highlights only the exact nested property row when a nested property receives focus', () => {
    const properties: EditableProperty[] = [
      {
        id: 'prop-address',
        name: 'address',
        type: 'Object',
        properties: [
          {id: 'prop-street', name: 'street', type: 'string', example: 'Main St'},
          {id: 'prop-city', name: 'city', type: 'string', example: 'Springfield'},
        ],
      },
    ];
    const {container} = renderFocusSynchronizedNodeEditor(properties);
    const schemaSection = container.querySelector<HTMLElement>('.node-editor-schema');
    const exampleSection = container.querySelector<HTMLElement>('.node-editor-example');
    const schemaStreetInput = schemaSection?.querySelector<HTMLInputElement>('input[value="street"]');

    expect(schemaStreetInput).toBeDefined();

    act(() => {
      schemaStreetInput?.focus();
    });

    const schemaTopLevelRows = getTopLevelPropertyRows(schemaSection!);
    const schemaNestedRows = getNestedPropertyRows(schemaSection!);
    const exampleTopLevelRows = getTopLevelPropertyRows(exampleSection!);
    const exampleNestedRows = getNestedPropertyRows(exampleSection!);

    expect(schemaTopLevelRows[0]?.classList.contains('property-editor-row-focused')).toBe(false);
    expect(exampleTopLevelRows[0]?.classList.contains('property-editor-row-focused')).toBe(false);
    expect(schemaNestedRows[0]?.classList.contains('property-editor-row-focused')).toBe(true);
    expect(schemaNestedRows[1]?.classList.contains('property-editor-row-focused')).toBe(false);
    expect(exampleNestedRows[0]?.classList.contains('property-editor-row-focused')).toBe(true);
    expect(exampleNestedRows[1]?.classList.contains('property-editor-row-focused')).toBe(false);
  });

  it('highlights the matching schema property when an example list value receives focus', () => {
    const properties: EditableProperty[] = [
      {
        id: 'prop-tags',
        name: 'tags',
        type: 'string',
        list: true,
        exampleValues: ['alpha', 'beta'],
      },
      {
        id: 'prop-columns',
        name: 'columns',
        type: 'Object',
        list: true,
        properties: [
          {id: 'field-id', name: 'field', type: 'string', example: 'firstName'},
          {id: 'label-id', name: 'label', type: 'string', example: 'First name'},
        ],
        rows: [
          {'field-id': 'firstName', 'label-id': 'First name'},
          {'field-id': 'lastName', 'label-id': 'Last name'},
        ],
      },
    ];
    const {container} = renderFocusSynchronizedNodeEditor(properties);
    const schemaSection = container.querySelector<HTMLElement>('.node-editor-schema');
    const exampleSection = container.querySelector<HTMLElement>('.node-editor-example');
    const primitiveListValueInput = exampleSection?.querySelector<HTMLInputElement>('input[value="alpha"]');

    expect(primitiveListValueInput).toBeDefined();

    act(() => {
      primitiveListValueInput?.focus();
    });

    let schemaRows = getTopLevelPropertyRows(schemaSection!);
    expect(schemaRows.map((row) => row.classList.contains('property-editor-row-focused'))).toEqual([true, false]);

    const objectListValueInput = exampleSection?.querySelector<HTMLInputElement>('input[aria-label="field example value"]');

    expect(objectListValueInput).toBeDefined();

    act(() => {
      objectListValueInput?.focus();
    });

    schemaRows = getTopLevelPropertyRows(schemaSection!);
    const objectListNestedRows = getNestedPropertyRows(schemaSection!);

    expect(schemaRows.map((row) => row.classList.contains('property-editor-row-focused'))).toEqual([false, false]);
    expect(objectListNestedRows.map((row) => row.classList.contains('property-editor-row-focused'))).toEqual([true, false]);
  });

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
