import { NodeData } from './types';

export type FormattedNodeField = {
  key: string;
  text: string;
  lineCount: number;
};

export function formatNodeData(data: NodeData): FormattedNodeField[] {
  if (!data) {
    return [];
  }

  return Object.entries(data).map(([key, value]) => {
    const lines = formatField(key, value);
    return {
      key,
      text: lines.join('\n'),
      lineCount: lines.length
    };
  });
}

export function countNodeDataLines(data: NodeData): number {
  return formatNodeData(data).reduce((total, field) => total + field.lineCount, 0);
}

function formatField(key: string, value: unknown): string[] {
  if (isScalar(value)) {
    return [`${key}: ${formatScalar(value)}`];
  }

  const lines = [`${key}:`];
  lines.push(...formatComplex(value, 2));
  return lines;
}

function formatComplex(value: unknown, indent: number): string[] {
  if (Array.isArray(value)) {
    return formatArray(value, indent);
  }
  if (isRecord(value)) {
    return formatObject(value, indent);
  }
  return [`${' '.repeat(indent)}${formatScalar(value)}`];
}

function formatArray(items: unknown[], indent: number): string[] {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];

  if (items.length === 0) {
    lines.push(`${pad}[]`);
    return lines;
  }

  for (const item of items) {
    if (isScalar(item)) {
      lines.push(`${pad}- ${formatScalar(item)}`);
      continue;
    }

    if (Array.isArray(item)) {
      lines.push(`${pad}-`);
      lines.push(...formatArray(item, indent + 2));
      continue;
    }

    if (isRecord(item)) {
      const entries = Object.entries(item);
      if (entries.length === 0) {
        lines.push(`${pad}- {}`);
        continue;
      }

      const [firstKey, firstValue] = entries[0];
      if (isScalar(firstValue)) {
        lines.push(`${pad}- ${firstKey}: ${formatScalar(firstValue)}`);
      } else {
        lines.push(`${pad}- ${firstKey}:`);
        lines.push(...formatComplex(firstValue, indent + 4));
      }

      for (const [key, value] of entries.slice(1)) {
        const itemPad = `${pad}  `;
        if (isScalar(value)) {
          lines.push(`${itemPad}${key}: ${formatScalar(value)}`);
        } else {
          lines.push(`${itemPad}${key}:`);
          lines.push(...formatComplex(value, indent + 4));
        }
      }
      continue;
    }

    lines.push(`${pad}- ${formatScalar(item)}`);
  }

  return lines;
}

function formatObject(value: Record<string, unknown>, indent: number): string[] {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];
  const entries = Object.entries(value);

  if (entries.length === 0) {
    lines.push(`${pad}{}`);
    return lines;
  }

  for (const [key, fieldValue] of entries) {
    if (isScalar(fieldValue)) {
      lines.push(`${pad}${key}: ${formatScalar(fieldValue)}`);
    } else {
      lines.push(`${pad}${key}:`);
      lines.push(...formatComplex(fieldValue, indent + 2));
    }
  }

  return lines;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isScalar(value: unknown) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function formatScalar(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
}
