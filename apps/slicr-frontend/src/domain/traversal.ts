import { Parsed } from './types';

export function getRelatedElements(parsed: Parsed, selectedKey: string | null) {
  if (!selectedKey || !parsed.nodes.has(selectedKey)) {
    return { nodes: new Set<string>(), edges: new Set<string>() };
  }

  const relatedNodes = new Set<string>([selectedKey]);
  const relatedEdges = new Set<string>();

  // Descendants (outgoing)
  const queueOut = [selectedKey];
  while (queueOut.length > 0) {
    const current = queueOut.shift()!;
    for (const edge of parsed.edges) {
      if (edge.from === current && !relatedNodes.has(edge.to)) {
        relatedNodes.add(edge.to);
        queueOut.push(edge.to);
      }
    }
  }

  // Ancestors (incoming)
  const queueIn = [selectedKey];
  while (queueIn.length > 0) {
    const current = queueIn.shift()!;
    for (const edge of parsed.edges) {
      if (edge.to === current && !relatedNodes.has(edge.from)) {
        relatedNodes.add(edge.from);
        queueIn.push(edge.from);
      }
    }
  }

  // Find edges connecting related nodes
  for (const edge of parsed.edges) {
    if (relatedNodes.has(edge.from) && relatedNodes.has(edge.to)) {
      relatedEdges.add(`${edge.from}->${edge.to}`);
    }
  }

  return { nodes: relatedNodes, edges: relatedEdges };
}
