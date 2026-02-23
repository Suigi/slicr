export const NODE_MEASURE_NODE_CLASS = 'node-measure-box';
export const NODE_MEASURE_NODE_SELECTOR = `.${NODE_MEASURE_NODE_CLASS}[data-node-key]`;

export function measureNodeHeights(root: ParentNode = document): Record<string, number> {
  const measured: Record<string, number> = {};
  const elements = root.querySelectorAll<HTMLElement>(NODE_MEASURE_NODE_SELECTOR);
  elements.forEach((element) => {
    const key = element.dataset.nodeKey;
    if (!key) {
      return;
    }
    const height = Math.round(element.getBoundingClientRect().height);
    if (Number.isFinite(height) && height > 0) {
      measured[key] = height;
    }
  });
  return measured;
}
