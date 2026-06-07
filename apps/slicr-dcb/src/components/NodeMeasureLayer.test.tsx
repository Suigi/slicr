// @vitest-environment jsdom

import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, describe, expect, it} from 'vitest';

import {DCB_NODE_MEASURE_CLASS} from '../nodeMeasurement';
import {NodeMeasureLayer} from './NodeMeasureLayer';

const nodes = [
  {
    id: 'node-1',
    label: 'Checkout Completed',
    type: 'evt' as const,
    laneId: 'lane-0',
    width: 230,
    height: 86,
    x: 10,
    y: 20,
  },
  {
    id: 'node-2',
    label: 'Read Model',
    type: 'rm' as const,
    laneId: 'lane-0',
    width: 240,
    height: 90,
    x: 40,
    y: 140,
  },
];

describe('NodeMeasureLayer', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container?.remove();
    container = null;
  });

  it('renders one hidden measurement target per graph node with selector markup', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(NodeMeasureLayer, {
          nodes,
          nodePropertiesById: { 'node-1': [{id: 'prop-title', name: 'title', type: 'string', example: 'Hello'}] },
          editingNodeId: null,
          draftLabel: '',
        }),
      );
    });

    const layer = container.querySelector<HTMLElement>('.node-measure-layer');
    const measurementTargets = container.querySelectorAll<HTMLElement>(`.${DCB_NODE_MEASURE_CLASS}[data-node-id]`);

    expect(layer).not.toBeNull();
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
    expect(layer?.tabIndex).toBe(-1);
    expect(measurementTargets).toHaveLength(nodes.length);
    expect([...measurementTargets].map((target) => target.dataset.nodeId)).toEqual(nodes.map((node) => node.id));
    expect(measurementTargets[0]?.textContent).toContain('Checkout Completed');
    expect(measurementTargets[0]?.querySelector('property-grid')).not.toBeNull();
    expect(measurementTargets[1]?.textContent).toContain('Read Model');
  });

  it('renders the active editing node with the current draft label in measurement mode', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(NodeMeasureLayer, {nodes, editingNodeId: 'node-1', draftLabel: 'Checkout Draft'}));
    });

    const editingInput = container.querySelector<HTMLInputElement>('.node-measure-layer [data-node-id="node-1"] .node-label-input');
    const otherNodeButton = container.querySelector<HTMLButtonElement>('.node-measure-layer [data-node-id="node-2"] .node-label-button');

    expect(editingInput).not.toBeNull();
    expect(editingInput?.value).toBe('Checkout Draft');
    expect(editingInput?.readOnly).toBe(true);
    expect(otherNodeButton?.textContent).toContain('Read Model');
  });
});
