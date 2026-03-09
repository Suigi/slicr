import type { NodeDimensions } from './domain/nodeSizing';

export const NODE_MEASURE_NODE_CLASS = 'node-measure-box';
export const NODE_MEASURE_NODE_SELECTOR = `.${NODE_MEASURE_NODE_CLASS}[data-node-key]`;
export const SCENARIO_GROUP_MEASURE_CLASS = 'scenario-group-measure';
export const SCENARIO_GROUP_SELECTOR = `.${SCENARIO_GROUP_MEASURE_CLASS}[data-scenario-group-key]`;

export function measureNodeDimensions(root: ParentNode = document): Record<string, NodeDimensions> {
  const measured: Record<string, NodeDimensions> = {};
  const elements = root.querySelectorAll<HTMLElement>(NODE_MEASURE_NODE_SELECTOR);
  elements.forEach((element) => {
    const key = element.dataset.nodeKey;
    if (!key) {
      return;
    }
    const width = Math.ceil(element.getBoundingClientRect().width);
    const height = Math.ceil(element.getBoundingClientRect().height);
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      measured[key] = { width, height };
    }
  });
  return measured;
}

export function measureScenarioGroupWidths(root: ParentNode = document): Record<string, number> {
  const measured: Record<string, number> = {};
  const elements = root.querySelectorAll<HTMLElement>(SCENARIO_GROUP_SELECTOR);
  elements.forEach((element) => {
    const key = element.dataset.scenarioGroupKey;
    if (!key) {
      return;
    }
    const width = Math.ceil(element.getBoundingClientRect().width);
    if (Number.isFinite(width) && width > 0) {
      measured[key] = width;
    }
  });
  return measured;
}
