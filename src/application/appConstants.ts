import { formatNodeData } from '../domain/formatNodeData';
import type { Parsed } from '../domain/types';

export type ParseResult =
  | { parsed: Parsed; error: ''; warnings: Parsed['warnings'] }
  | { parsed: null; error: string; warnings: [] };

export const TYPE_LABEL: Record<string, string> = {
  rm: 'rm',
  cmd: 'cmd',
  evt: 'evt',
  exc: 'exc',
  ui: 'ui',
  generic: '',
  aut: 'aut',
  ext: 'ext'
};

export const NODE_VERSION_SUFFIX = /@\d+$/;

export function formatTraceSource(source: unknown): string {
  const fields = formatNodeData({ value: source });
  return fields[0]?.text ?? 'value: undefined';
}
