export type AddNodeType =
  | 'generic'
  | 'event'
  | 'read-model'
  | 'ui'
  | 'command'
  | 'exception'
  | 'automation'
  | 'external';

export type BuildAddNodeDslArgs = {
  type: AddNodeType;
  name: string;
  alias?: string | null;
  predecessors: string[];
  usesKeys: string[];
  collections?: Array<{ name: string; keys: string[] }>;
};

const TYPE_PREFIX: Record<AddNodeType, string> = {
  generic: '',
  event: 'evt',
  'read-model': 'rm',
  ui: 'ui',
  command: 'cmd',
  exception: 'exc',
  automation: 'aut',
  external: 'ext'
};

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
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

export function buildAddNodeDsl(args: BuildAddNodeDslArgs): string {
  const prefix = TYPE_PREFIX[args.type];
  const name = args.name.trim();
  const alias = args.alias?.trim();
  const predecessors = uniqueNonEmpty(args.predecessors);
  const uses = uniqueNonEmpty(args.usesKeys);
  const collections = (args.collections ?? [])
    .map((collection) => ({
      name: collection.name.trim(),
      keys: uniqueNonEmpty(collection.keys)
    }))
    .filter((collection) => collection.name.length > 0 && collection.keys.length > 0);

  const lines: string[] = [];
  const ref = prefix ? `${prefix}:${name}` : name;
  lines.push(alias ? `${ref} "${alias}"` : ref);
  for (const predecessor of predecessors) {
    lines.push(`<- ${predecessor}`);
  }
  if (uses.length > 0 || collections.length > 0) {
    lines.push('uses:');
    for (const key of uses) {
      lines.push(`  ${key}`);
    }
    for (const collection of collections) {
      lines.push(`  ${collection.name} <- collect ( { ${collection.keys.join(', ')} } )`);
    }
  }

  return lines.join('\n');
}
