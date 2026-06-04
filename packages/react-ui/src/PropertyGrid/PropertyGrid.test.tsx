// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { PropertyGrid, type PropertyGridElement, type PropertyGridProperties } from './PropertyGrid';

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
