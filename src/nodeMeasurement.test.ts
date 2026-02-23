// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { measureNodeHeights, NODE_MEASURE_NODE_CLASS, NODE_MEASURE_NODE_SELECTOR } from './nodeMeasurement';

describe('nodeMeasurement', () => {
  it('measures only nodes matching the shared selector', () => {
    const container = document.createElement('div');

    const measuredNode = document.createElement('div');
    measuredNode.className = NODE_MEASURE_NODE_CLASS;
    measuredNode.dataset.nodeKey = 'buy-ticket';
    measuredNode.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 180,
      height: 97.4,
      top: 0,
      right: 180,
      bottom: 97.4,
      left: 0,
      toJSON: () => ({})
    } as DOMRect);
    container.appendChild(measuredNode);

    const wrongClassNode = document.createElement('div');
    wrongClassNode.className = 'node-measure';
    wrongClassNode.dataset.nodeKey = 'should-not-match';
    wrongClassNode.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 180,
      height: 333,
      top: 0,
      right: 180,
      bottom: 333,
      left: 0,
      toJSON: () => ({})
    } as DOMRect);
    container.appendChild(wrongClassNode);

    expect(NODE_MEASURE_NODE_SELECTOR).toBe(`.${NODE_MEASURE_NODE_CLASS}[data-node-key]`);
    expect(measureNodeHeights(container)).toEqual({ 'buy-ticket': 97 });
  });
});
