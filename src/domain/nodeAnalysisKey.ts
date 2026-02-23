const NODE_VERSION_SUFFIX = /@\d+$/;

export function toNodeAnalysisKey(nodeKey: string): string {
  return nodeKey.replace(NODE_VERSION_SUFFIX, '');
}

export function toNodeAnalysisRef(nodeRef: string): string {
  const splitAt = nodeRef.indexOf(':');
  if (splitAt < 0) {
    return toNodeAnalysisKey(nodeRef);
  }
  const type = nodeRef.slice(0, splitAt);
  const name = nodeRef.slice(splitAt + 1);
  return `${type}:${toNodeAnalysisKey(name)}`;
}

export function toNodeAnalysisRefFromNode(node: { type: string; name: string }): string {
  return `${node.type}:${toNodeAnalysisKey(node.name)}`;
}
