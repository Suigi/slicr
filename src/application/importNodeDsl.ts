export type ImportNodeDslRow = {
  id: string;
  key: string;
  value: unknown;
};

export type BuildImportNodeDslArgs = {
  sourceRef: string;
  alias?: string | null;
  dataRows: ImportNodeDslRow[];
  selectedRowIds: string[];
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

function quote(value: string): string {
  return JSON.stringify(value);
}

function formatDataKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_\-#]*$/.test(key) ? key : quote(key);
}

function formatDataValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return quote('undefined');
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export function buildImportNodeDsl(args: BuildImportNodeDslArgs): string {
  const alias = args.alias?.trim() ?? '';
  const header = alias ? `${args.sourceRef.trim()} ${quote(alias)}` : args.sourceRef.trim();

  const selected = uniqueNonEmpty(args.selectedRowIds);
  const rowsById = new Map(args.dataRows.map((row) => [row.id, row]));
  const lines = selected
    .map((rowId) => rowsById.get(rowId))
    .filter((row): row is ImportNodeDslRow => Boolean(row))
    .map((row) => `  ${formatDataKey(row.key)}: ${formatDataValue(row.value)}`);

  if (lines.length === 0) {
    return `${header}\ndata: {}`;
  }

  return [header, 'data:', ...lines].join('\n');
}
