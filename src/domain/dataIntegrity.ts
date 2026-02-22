import { Edge, ParseWarning, VisualNode } from './types';
import { MISSING_DATA_VALUE } from './dataMapping';

export function validateDataIntegrity(input: { nodes: Map<string, VisualNode>; edges: Edge[] }): ParseWarning[] {
  const warnings: ParseWarning[] = [];
  const predecessorsByTarget = new Map<string, string[]>();

  for (const edge of input.edges) {
    const predecessors = predecessorsByTarget.get(edge.to);
    if (predecessors) {
      predecessors.push(edge.from);
    } else {
      predecessorsByTarget.set(edge.to, [edge.from]);
    }
  }

  for (const [targetKey, predecessorKeys] of predecessorsByTarget.entries()) {
    const targetNode = input.nodes.get(targetKey);
    if (!targetNode) {
      continue;
    }

    const suppliedKeys = new Set<string>();
    for (const predecessorKey of predecessorKeys) {
      const predecessorNode = input.nodes.get(predecessorKey);
      if (!predecessorNode?.data) {
        continue;
      }
      for (const key of Object.keys(predecessorNode.data)) {
        suppliedKeys.add(key);
      }
    }

    for (const key of Object.keys(targetNode.data ?? {})) {
      if (targetNode.data?.[key] === MISSING_DATA_VALUE) {
        continue;
      }
      if (suppliedKeys.has(key)) {
        continue;
      }
      warnings.push({
        message: `Missing data source for key "${key}"`,
        range: targetNode.dataKeyRanges?.[key] ?? targetNode.srcRange,
        level: 'warning'
      });
    }
  }

  return warnings;
}
