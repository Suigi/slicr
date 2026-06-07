// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import './property-grid.js';

type PropertyGridTestElement = HTMLElement & {
  properties: Record<string, unknown>;
  focusedPropertyId: string | null;
};

function createPropertyGrid(properties: Record<string, unknown>, ariaLabel?: string) {
  const element = document.createElement('property-grid') as PropertyGridTestElement;

  if (ariaLabel) {
    element.setAttribute('aria-label', ariaLabel);
  }

  document.body.append(element);
  element.properties = properties;

  return element;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('property-grid custom element', () => {
  it('defines the property-grid custom element', () => {
    expect(customElements.get('property-grid')).toBeDefined();
  });

  it('renders scalar property types and scalar values', () => {
    const element = createPropertyGrid({
      nodeId: { type: 'string' },
      enabled: { type: 'boolean', value: true },
      attempts: { type: 'number', value: 3 },
      empty: { type: 'string', value: null },
      missing: { type: 'string', value: undefined },
    });

    const text = element.shadowRoot?.textContent ?? '';

    expect(text).toContain('nodeId');
    expect(text).toContain('string');
    expect(text).toContain('enabled');
    expect(text).toContain('true');
    expect(text).toContain('attempts');
    expect(text).toContain('3');
    expect(text).toContain('empty');
    expect(text).toContain('null');
    expect(text).toContain('missing');
    expect(text).toContain('undefined');
  });

  it('renders nested object properties', () => {
    const element = createPropertyGrid({
      address: {
        kind: 'object',
        type: 'Address',
        properties: {
          street: { type: 'string', value: 'Fake Street 123' },
          city: { type: 'string', value: 'Springfield' },
        },
      },
    });

    const shadow = element.shadowRoot;
    const nestedGrid = shadow?.querySelector('.nested-property-grid');
    const nestedRows = shadow?.querySelectorAll('.nested-property-row');
    const text = shadow?.textContent ?? '';

    expect(nestedGrid?.getAttribute('aria-label')).toBe('address properties');
    expect(nestedRows).toHaveLength(2);
    expect(text).toContain('address');
    expect(text).toContain('Address');
    expect(text).toContain('street');
    expect(text).toContain('Fake Street 123');
    expect(text).toContain('city');
    expect(text).toContain('Springfield');
  });

  it('highlights only the nested object row matching focusedPropertyId', () => {
    const element = createPropertyGrid({
      address: {
        id: 'address-id',
        kind: 'object',
        type: 'Address',
        properties: {
          street: { id: 'street-id', type: 'string', value: 'Fake Street 123' },
          location: {
            id: 'location-id',
            kind: 'object',
            type: 'Location',
            properties: {
              lat: { id: 'lat-id', type: 'number', value: 1 },
            },
          },
        },
      },
    });

    element.focusedPropertyId = 'location-id';

    const highlightedRows = [...(element.shadowRoot?.querySelectorAll('.is-property-highlighted') ?? [])];

    expect(highlightedRows).toHaveLength(1);
    expect(highlightedRows[0]?.textContent).toContain('location');
    expect(highlightedRows[0]?.classList.contains('nested-property-row')).toBe(true);
  });

  it('renders table properties with headers and rows', () => {
    const element = createPropertyGrid({
      tags: {
        kind: 'table',
        columns: [{ key: 'key' }, { key: 'value', label: 'Value Label' }],
        rows: [
          { key: 'nodeId', value: 'node-42' },
          { key: 'active', value: false },
        ],
      },
    });

    const shadow = element.shadowRoot;
    const table = shadow?.querySelector<HTMLTableElement>('.table');
    const headers = [...(shadow?.querySelectorAll('.table-header th') ?? [])].map((header) => header.textContent);
    const cells = [...(shadow?.querySelectorAll('.table tbody td') ?? [])].map((cell) => cell.textContent);

    expect(table?.getAttribute('aria-label')).toBe('tags property');
    expect(table?.style.getPropertyValue('--property-grid-table-column-count')).toBe('2');
    expect(headers).toEqual(['key', 'Value Label']);
    expect(cells).toEqual(['nodeId', 'node-42', 'active', 'false']);
  });

  it('highlights the table column matching focusedPropertyId', () => {
    const element = createPropertyGrid({
      columns: {
        id: 'columns-id',
        kind: 'table',
        columns: [
          { id: 'field-id', key: 'field-id', label: 'field', type: 'string' },
          { id: 'label-id', key: 'label-id', label: 'label', type: 'string' },
        ],
        rows: [
          { 'field-id': 'firstName', 'label-id': 'First name' },
          { 'field-id': 'lastName', 'label-id': 'Last name' },
        ],
      },
    });

    element.focusedPropertyId = 'field-id';

    const highlightedCells = [...(element.shadowRoot?.querySelectorAll('.table .is-property-highlighted') ?? [])];

    expect(highlightedCells.map((cell) => cell.textContent)).toEqual(['field', 'firstName', 'lastName']);
    expect(element.shadowRoot?.querySelector('th:nth-child(2)')?.classList.contains('is-property-highlighted')).toBe(false);
  });

  it('renders empty object-list placeholder cells with property type styling', () => {
    const element = createPropertyGrid({
      items: {
        kind: 'table',
        columns: [
          { key: 'sku', type: 'string' },
          { key: 'quantity', type: 'number' },
        ],
        rows: [],
      },
    });

    const shadow = element.shadowRoot;
    const placeholderCells = [...(shadow?.querySelectorAll('.table tbody td') ?? [])];
    const typeSpans = placeholderCells.map((cell) => cell.querySelector('.field-type'));
    const separatorSpans = placeholderCells.map((cell) => cell.querySelector('.field-separator'));

    expect(placeholderCells.map((cell) => cell.textContent)).toEqual([': string', ': number']);
    expect(separatorSpans.map((span) => span?.textContent)).toEqual([':', ':']);
    expect(typeSpans.map((span) => span?.textContent)).toEqual(['string', 'number']);
    expect(typeSpans.every((span) => span?.classList.contains('field-type'))).toBe(true);
  });

  it('emits hovered scalar property changes and clears on panel leave', () => {
    const element = createPropertyGrid({
      title: { id: 'title-id', type: 'string', value: 'Hello' },
    });
    const hoveredPropertyIds: Array<string | null> = [];
    element.addEventListener('property-grid-hovered-property-change', (event) => {
      hoveredPropertyIds.push((event as CustomEvent<{ propertyId: string | null }>).detail.propertyId);
    });

    element.shadowRoot?.querySelector('.property-row')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }));
    element.shadowRoot?.querySelector('.property-panel')?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, composed: true }));

    expect(hoveredPropertyIds).toEqual(['title-id', null]);
  });

  it('emits nested table column property ids when columns are hovered', () => {
    const element = createPropertyGrid({
      columns: {
        id: 'columns-id',
        kind: 'table',
        columns: [
          { id: 'field-id', key: 'field-id', label: 'field', type: 'string' },
          { id: 'label-id', key: 'label-id', label: 'label', type: 'string' },
        ],
        rows: [{ 'field-id': 'firstName', 'label-id': 'First name' }],
      },
    });
    const hoveredPropertyIds: Array<string | null> = [];
    element.addEventListener('property-grid-hovered-property-change', (event) => {
      hoveredPropertyIds.push((event as CustomEvent<{ propertyId: string | null }>).detail.propertyId);
    });

    element.shadowRoot?.querySelector('.table-header th')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }));
    element.shadowRoot?.querySelector('.table tbody td')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }));

    expect(hoveredPropertyIds).toEqual(['field-id', 'field-id']);
  });

  it('updates rendered rows when the properties DOM property changes', () => {
    const element = createPropertyGrid({
      before: { type: 'string' },
    });

    element.properties = {
      after: { type: 'number', value: 7 },
    };

    const text = element.shadowRoot?.textContent ?? '';

    expect(text).not.toContain('before');
    expect(text).toContain('after');
    expect(text).toContain('7');
  });

  it('uses the aria-label attribute on the internal table', () => {
    const element = createPropertyGrid({ nodeId: { type: 'string' } }, 'Node properties');

    expect(element.shadowRoot?.querySelector('.property-grid')?.getAttribute('aria-label')).toBe('Node properties');

    element.setAttribute('aria-label', 'Updated node properties');

    expect(element.shadowRoot?.querySelector('.property-grid')?.getAttribute('aria-label')).toBe('Updated node properties');
  });
});
