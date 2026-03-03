import type { FocusEvent } from 'react';

export type DataKeyEntry = {
  key: string;
  value: unknown;
};

export function flattenDataKeysWithValue(data: unknown, prefix = ''): DataKeyEntry[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return [];
  }

  const entries: DataKeyEntry[] = [];
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${key}` : key;
    entries.push({ key: full, value });
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      entries.push(...flattenDataKeysWithValue(value, full));
    }
  }
  return entries;
}

export function stringifyValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function selectAllInputText(event: FocusEvent<HTMLInputElement>) {
  event.currentTarget.setSelectionRange(0, event.currentTarget.value.length);
}

export function kebabToTitle(value: string): string {
  return value
    .trim()
    .replace(/[\s_]+/g, '-')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function colorClassForNodeType(type: string): string {
  if (type === 'generic') return 'type-generic';
  if (type === 'event' || type === 'evt') return 'type-event';
  if (type === 'read-model' || type === 'rm') return 'type-read-model';
  if (type === 'ui') return 'type-ui';
  if (type === 'command' || type === 'cmd') return 'type-command';
  if (type === 'exception' || type === 'exc') return 'type-exception';
  if (type === 'automation' || type === 'aut') return 'type-automation';
  if (type === 'external' || type === 'ext') return 'type-external';
  return '';
}
