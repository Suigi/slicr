import { getSliceTemplateById, type SliceNodeType, type SliceTargetMode, type SliceTemplateId } from './sliceTemplateCatalog';

export type SliceTemplateNodeInput = {
  type: SliceNodeType;
  name: string;
  alias: string;
};

export type BuildSliceTemplateTextArgs = {
  templateId: SliceTemplateId;
  targetMode: SliceTargetMode;
  sliceName: string;
  includeReadModelInStateChange: boolean;
  nodes: Record<string, SliceTemplateNodeInput>;
};

function uniqueNonEmpty(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function includeOptionalReadModel(args: BuildSliceTemplateTextArgs): boolean {
  return args.templateId !== 'state-change' || args.includeReadModelInStateChange;
}

function nodeLine(node: SliceTemplateNodeInput): string {
  const ref = nodeRef(node);
  const alias = node.alias.trim();
  return alias ? `${ref} "${alias}"` : ref;
}

function nodeRef(node: SliceTemplateNodeInput): string {
  const prefix = node.type === 'aut' ? 'aut' : node.type;
  return `${prefix}:${node.name.trim()}`;
}

export function buildSliceTemplateText(args: BuildSliceTemplateTextArgs): string {
  const template = getSliceTemplateById(args.templateId);
  const includeReadModel = includeOptionalReadModel(args);

  const activeNodes = template.nodes
    .filter((node) => includeReadModel || node.type !== 'rm' || node.slot !== 'projection-rm')
    .map((node) => ({ slot: node.slot, ...(args.nodes[node.slot] ?? { type: node.type, name: node.defaultName, alias: node.defaultAlias }) }));

  const activeNodeBySlot = new Map(activeNodes.map((node) => [node.slot, node]));

  const inboundBySlot = new Map<string, string[]>();
  for (const edge of template.edges) {
    if (edge.optional === 'state-change-read-model' && !includeReadModel) {
      continue;
    }
    const fromNode = activeNodeBySlot.get(edge.fromSlot);
    const toNode = activeNodeBySlot.get(edge.toSlot);
    if (!fromNode || !toNode) {
      continue;
    }
    const toList = inboundBySlot.get(edge.toSlot) ?? [];
    toList.push(nodeRef(fromNode));
    inboundBySlot.set(edge.toSlot, toList);
  }

  const lines: string[] = [];
  if (args.targetMode === 'create-new') {
    const name = args.sliceName.trim() || 'Untitled';
    lines.push(`slice "${name}"`);
    lines.push('');
  }

  activeNodes.forEach((node, index) => {
    if (index > 0) {
      lines.push('');
    }
    lines.push(nodeLine(node));
    const inbound = uniqueNonEmpty(inboundBySlot.get(node.slot) ?? []);
    inbound.forEach((sourceRef) => lines.push(`<- ${sourceRef}`));
  });
  return lines.join('\n').trimEnd();
}
