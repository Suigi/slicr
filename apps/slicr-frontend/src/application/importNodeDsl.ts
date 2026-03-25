import { formatNodeData } from '../domain/formatNodeData';

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

export function buildImportNodeDsl(args: BuildImportNodeDslArgs): string {
  const alias = args.alias?.trim() ?? '';
  const header = alias ? `${args.sourceRef.trim()} ${quote(alias)}` : args.sourceRef.trim();

  const selected = uniqueNonEmpty(args.selectedRowIds);
  const rowsById = new Map(args.dataRows.map((row) => [row.id, row]));
  const selectedRows = selected
    .map((rowId) => rowsById.get(rowId))
    .filter((row): row is ImportNodeDslRow => Boolean(row));

  if (selectedRows.length === 0) {
    return `${header}\ndata: {}`;
  }

  const selectedData: Record<string, unknown> = {};
  for (const row of selectedRows) {
    selectedData[row.key] = row.value;
  }

  const lines = formatNodeData(selectedData)
    .flatMap((field) => field.text.split('\n'))
    .map((line) => `  ${line}`);

  return [header, 'data:', ...lines].join('\n');
}
