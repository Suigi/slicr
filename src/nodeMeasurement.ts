import type { NodeDimensions } from './domain/nodeSizing';

export const NODE_MEASURE_NODE_CLASS = 'node-measure-box';
export const NODE_MEASURE_NODE_SELECTOR = `.${NODE_MEASURE_NODE_CLASS}[data-node-key]`;

export function measureNodeDimensions(root: ParentNode = document): Record<string, NodeDimensions> {
  const measured: Record<string, NodeDimensions> = {};
  const elements = root.querySelectorAll<HTMLElement>(NODE_MEASURE_NODE_SELECTOR);
  elements.forEach((element) => {
    const key = element.dataset.nodeKey;
    if (!key) {
      return;
    }
    const width = Math.round(element.getBoundingClientRect().width);
    const height = Math.round(element.getBoundingClientRect().height);
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      measured[key] = { width, height };
    }
  });
  return measured;
}
