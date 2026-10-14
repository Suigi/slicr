import {NODE_HEIGHT, NODE_WIDTH} from './graph/constants';

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

    const measuredWidth = Math.ceil(element.getBoundingClientRect().width);
    const measuredHeight = Math.ceil(element.getBoundingClientRect().height);

    if (Number.isFinite(measuredWidth) && measuredWidth > 0 && Number.isFinite(measuredHeight) && measuredHeight > 0) {
      measured[nodeId] = {
        width: Math.max(NODE_WIDTH, measuredWidth),
        height: Math.max(NODE_HEIGHT, measuredHeight),
      };
    }
  });

  return measured;
}
