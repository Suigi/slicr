export type NodeDimensions = {
  width: number;
  height: number;
};

export const DCB_NODE_MEASURE_CLASS = 'dcb-node-measure-box';
export const DCB_NODE_MEASURE_SELECTOR = `.${DCB_NODE_MEASURE_CLASS}[data-node-id]`;

export function measureNodeDimensions(root: ParentNode = document): Record<string, NodeDimensions> {
  const measured: Record<string, NodeDimensions> = {};
  const elements = root.querySelectorAll<HTMLElement>(DCB_NODE_MEASURE_SELECTOR);

  elements.forEach((element) => {
    const nodeId = element.dataset.nodeId;
    if (!nodeId) {
      return;
    }

    const width = Math.ceil(element.getBoundingClientRect().width);
    const height = Math.ceil(element.getBoundingClientRect().height);

    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      measured[nodeId] = { width, height };
    }
  });

  return measured;
}
