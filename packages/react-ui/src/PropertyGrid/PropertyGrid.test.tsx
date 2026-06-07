// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { PropertyGrid, toPropertyGridProperties, type PropertyGridElement, type PropertyGridProperties } from './PropertyGrid';

let root: Root | undefined;

function renderPropertyGrid(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(ui);
  });

  return container;
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = undefined;
  document.body.replaceChildren();
});

describe('PropertyGrid React wrapper', () => {
  it('renders a property-grid custom element and assigns the properties DOM property', () => {
    const properties: PropertyGridProperties = {
      nodeId: { type: 'string' },
      enabled: { type: 'boolean', value: true },
    };

    const container = renderPropertyGrid(<PropertyGrid properties={properties} />);
    const element = container.querySelector<PropertyGridElement>('property-grid');

    expect(element).not.toBeNull();
    expect(element?.properties).toEqual(properties);
    expect(element?.shadowRoot?.textContent).toContain('nodeId');
    expect(element?.shadowRoot?.textContent).toContain('enabled');
    expect(element?.shadowRoot?.textContent).toContain('true');
  });

  it('passes ariaLabel and host HTML props to the custom element', () => {
    const container = renderPropertyGrid(
      <PropertyGrid
        properties={{ nodeId: { type: 'string' } }}
        ariaLabel="Node properties"
        className="external-property-grid"
        style={{ '--property-grid-line': 'rgb(255, 0, 0)' } as React.CSSProperties}
        data-node-type="evt"
      />,
    );
    const element = container.querySelector<PropertyGridElement>('property-grid');

    expect(element?.getAttribute('aria-label')).toBe('Node properties');
    expect(element?.getAttribute('data-node-type')).toBe('evt');
    expect(element?.className).toBe('external-property-grid');
    expect(element?.style.getPropertyValue('--property-grid-line')).toBe('rgb(255, 0, 0)');
    expect(element?.shadowRoot?.querySelector('.property-grid')?.getAttribute('aria-label')).toBe('Node properties');
  });

  it('normalizes editable object-list properties into table properties', () => {
    const properties = toPropertyGridProperties([
      {
        id: 'items-id',
        name: 'items',
        kind: 'object',
        type: 'Item',
        list: true,
        properties: [
          { id: 'sku-id', name: 'sku', kind: 'scalar', type: 'string' },
          { id: 'quantity-id', name: 'quantity', kind: 'scalar', type: 'number' },
        ],
        rows: [
          { 'sku-id': 'ABC', 'quantity-id': 2 },
          { 'sku-id': 'XYZ', 'quantity-id': 5 },
        ],
      },
    ]);

    expect(properties).toEqual({
      items: {
        kind: 'table',
        type: 'Item[]',
        columns: [
          { key: 'sku-id', label: 'sku', type: 'string' },
          { key: 'quantity-id', label: 'quantity', type: 'number' },
        ],
        rows: [
          { 'sku-id': 'ABC', 'quantity-id': 2 },
          { 'sku-id': 'XYZ', 'quantity-id': 5 },
        ],
      },
    });
  });

  it('renders editable object-list properties as tables', () => {
    const container = renderPropertyGrid(
      <PropertyGrid
        properties={[
          {
            id: 'items-id',
            name: 'items',
            kind: 'object',
            type: 'Item',
            list: true,
            properties: [
              { id: 'sku-id', name: 'sku', kind: 'scalar', type: 'string' },
              { id: 'quantity-id', name: 'quantity', kind: 'scalar', type: 'number' },
            ],
            rows: [{ 'sku-id': 'ABC', 'quantity-id': 2 }],
          },
        ]}
      />,
    );
    const element = container.querySelector<PropertyGridElement>('property-grid');
    const headers = [...(element?.shadowRoot?.querySelectorAll('.table-header th') ?? [])].map((header) => header.textContent);
    const cells = [...(element?.shadowRoot?.querySelectorAll('.table tbody td') ?? [])].map((cell) => cell.textContent);

    expect(headers).toEqual(['sku', 'quantity']);
    expect(cells).toEqual(['ABC', '2']);
  });

  it('renders nested property types when an editable object-list has no example rows', () => {
    const container = renderPropertyGrid(
      <PropertyGrid
        properties={[
          {
            id: 'items-id',
            name: 'items',
            kind: 'object',
            type: 'Item',
            list: true,
            properties: [
              { id: 'sku-id', name: 'sku', kind: 'scalar', type: 'string' },
              { id: 'quantity-id', name: 'quantity', kind: 'scalar', type: 'number' },
            ],
          },
        ]}
      />,
    );
    const element = container.querySelector<PropertyGridElement>('property-grid');
    const cells = [...(element?.shadowRoot?.querySelectorAll('.table tbody td') ?? [])].map((cell) => cell.textContent);

    expect(cells).toEqual([': string', ': number']);
  });

  it('renders the type fallback for editable scalar properties with an empty example', () => {
    const container = renderPropertyGrid(<PropertyGrid properties={[{ id: 'title-id', name: 'title', type: 'string', example: '' }]} />);
    const element = container.querySelector<PropertyGridElement>('property-grid');

    expect(element?.shadowRoot?.querySelector('.field-value')).toBeNull();
    expect(element?.shadowRoot?.querySelector('.field-separator')?.textContent).toBe(':');
    expect(element?.shadowRoot?.querySelector('.field-type')?.textContent).toBe('string');
  });

  it('renders the type fallback after an editable scalar example is cleared even if a legacy value remains', () => {
    const container = renderPropertyGrid(<PropertyGrid properties={[{ id: 'title-id', name: 'title', type: 'string', value: 'Legacy', example: '' }]} />);
    const element = container.querySelector<PropertyGridElement>('property-grid');

    expect(element?.shadowRoot?.querySelector('.field-value')).toBeNull();
    expect(element?.shadowRoot?.querySelector('.field-separator')?.textContent).toBe(':');
    expect(element?.shadowRoot?.querySelector('.field-type')?.textContent).toBe('string');
  });

  it('renders editable scalar examples instead of legacy values', () => {
    const container = renderPropertyGrid(<PropertyGrid properties={[{ id: 'title-id', name: 'title', type: 'string', value: 'Legacy', example: 'Edited' }]} />);
    const element = container.querySelector<PropertyGridElement>('property-grid');

    expect(element?.shadowRoot?.querySelector('.field-value')?.textContent).toBe('Edited');
  });

  it('updates the custom element properties when React props change', () => {
    const firstProperties: PropertyGridProperties = {
      before: { type: 'string' },
    };
    const secondProperties: PropertyGridProperties = {
      after: { type: 'number', value: 7 },
    };

    const container = renderPropertyGrid(<PropertyGrid properties={firstProperties} />);
    const element = container.querySelector<PropertyGridElement>('property-grid');

    act(() => {
      root?.render(<PropertyGrid properties={secondProperties} />);
    });

    expect(element?.properties).toEqual(secondProperties);
    expect(element?.shadowRoot?.textContent).not.toContain('before');
    expect(element?.shadowRoot?.textContent).toContain('after');
    expect(element?.shadowRoot?.textContent).toContain('7');
  });
});
