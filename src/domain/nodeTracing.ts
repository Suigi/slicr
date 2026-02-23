import { VisualNode } from './types';

export function isTraceableNode(node: VisualNode): boolean {
  return node.type !== 'generic';
}
