// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  measureNodeDimensions,
  measureScenarioGroupWidths,
  NODE_MEASURE_NODE_CLASS,
  NODE_MEASURE_NODE_SELECTOR,
  SCENARIO_GROUP_MEASURE_CLASS,
  SCENARIO_GROUP_SELECTOR
} from './nodeMeasurement';

describe('nodeMeasurement', () => {
  it('measures only nodes matching the shared selector', () => {
    const container = document.createElement('div');

    const measuredNode = document.createElement('div');
    measuredNode.className = NODE_MEASURE_NODE_CLASS;
    measuredNode.dataset.nodeKey = 'buy-ticket';
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
    expect(measureNodeDimensions(container)).toEqual({
      'buy-ticket': { width: 181, height: 98 }
    });
  });

  it('measures only overview scenario groups matching the shared selector', () => {
    const container = document.createElement('div');

    const measuredGroup = document.createElement('div');
    measuredGroup.className = SCENARIO_GROUP_MEASURE_CLASS;
    measuredGroup.dataset.scenarioGroupKey = 'overview-scenario-group-slice-1';
    measuredGroup.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 235.2,
      height: 200,
      top: 0,
      right: 235.2,
      bottom: 200,
      left: 0,
      toJSON: () => ({})
    } as DOMRect);
    container.appendChild(measuredGroup);

    const wrongGroup = document.createElement('div');
    wrongGroup.className = 'scenario-area scenario-group';
    wrongGroup.dataset.scenarioGroupKey = 'missing-area-class';
    wrongGroup.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 999,
      height: 200,
      top: 0,
      right: 999,
      bottom: 200,
      left: 0,
      toJSON: () => ({})
    } as DOMRect);
    container.appendChild(wrongGroup);

    expect(SCENARIO_GROUP_SELECTOR).toBe(`.${SCENARIO_GROUP_MEASURE_CLASS}[data-scenario-group-key]`);
    expect(measureScenarioGroupWidths(container)).toEqual({
      'overview-scenario-group-slice-1': 236
    });
  });

});
