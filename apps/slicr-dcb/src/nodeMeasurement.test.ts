// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { NODE_HEIGHT, NODE_WIDTH } from './graph/constants';
import {
  DCB_NODE_MEASURE_CLASS,
  DCB_NODE_MEASURE_SELECTOR,
  measureNodeDimensions
} from './nodeMeasurement';

describe('nodeMeasurement', () => {
  it('measures only DCB nodes matching the shared selector and clamps to shared minimum dimensions', () => {
    const container = document.createElement('div');

    const measuredNode = document.createElement('div');
    measuredNode.className = DCB_NODE_MEASURE_CLASS;
    measuredNode.dataset.nodeId = 'node-1';
    measuredNode.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 180.2,
      height: 97.4,
      top: 0,
      right: 180.2,
      bottom: 97.4,
      left: 0,
      toJSON: () => ({})
    } as DOMRect);
    container.appendChild(measuredNode);

    const wrongClassNode = document.createElement('div');
    wrongClassNode.className = 'node-measure';
    wrongClassNode.dataset.nodeId = 'node-2';
    wrongClassNode.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 333,
      height: 444,
      top: 0,
      right: 333,
      bottom: 444,
      left: 0,
      toJSON: () => ({})
    } as DOMRect);
    container.appendChild(wrongClassNode);

    expect(DCB_NODE_MEASURE_SELECTOR).toBe(`.${DCB_NODE_MEASURE_CLASS}[data-node-id]`);
    expect(measureNodeDimensions(container)).toEqual({
      'node-1': { width: NODE_WIDTH, height: 98 }
    });
  });

  it('ignores missing node ids and invalid measured dimensions', () => {
    const container = document.createElement('div');

    const missingIdNode = document.createElement('div');
    missingIdNode.className = DCB_NODE_MEASURE_CLASS;
    missingIdNode.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 180,
      height: 90,
      top: 0,
      right: 180,
      bottom: 90,
      left: 0,
      toJSON: () => ({})
    } as DOMRect);
    container.appendChild(missingIdNode);

    const invalidSizes = [
      { nodeId: 'zero-width', width: 0, height: 90 },
      { nodeId: 'negative-height', width: 180, height: -1 },
      { nodeId: 'nan-width', width: Number.NaN, height: 90 },
      { nodeId: 'infinite-height', width: 180, height: Number.POSITIVE_INFINITY }
    ];

    invalidSizes.forEach(({ nodeId, width, height }) => {
      const node = document.createElement('div');
      node.className = DCB_NODE_MEASURE_CLASS;
      node.dataset.nodeId = nodeId;
      node.getBoundingClientRect = () => ({
        x: 0,
        y: 0,
        width,
        height,
        top: 0,
        right: width,
        bottom: height,
        left: 0,
        toJSON: () => ({})
      } as DOMRect);
      container.appendChild(node);
    });

    expect(measureNodeDimensions(container)).toEqual({});
  });
});
