import { getSliceNameFromDsl } from '../sliceLibrary';
import { parseDsl } from './parseDsl';

export type CrossSliceDataDocument = {
  id: string;
  dsl: string;
};

export type CrossSliceDataValue = {
  sliceId: string;
  sliceName: string;
  value: unknown;
};

export type CrossSliceDataByKey = Record<string, CrossSliceDataValue[]>;

export type CrossSliceDataResult = {
  keys: string[];
  byKey: CrossSliceDataByKey;
};

export function getCrossSliceData(slices: CrossSliceDataDocument[], nodeRef: string): CrossSliceDataResult {
  const byKey: CrossSliceDataByKey = {};

  for (const slice of slices) {
    const parsed = parseDsl(slice.dsl);
    const node = [...parsed.nodes.values()].find((item) => toNodeRef(item) === nodeRef);
    if (!node || node.type === 'generic' || !node.data) {
      continue;
    }

    for (const [key, value] of Object.entries(node.data)) {
      byKey[key] ??= [];
      byKey[key].push({
        sliceId: slice.id,
        sliceName: getSliceNameFromDsl(slice.dsl),
        value
      });
    }
  }

  return {
    keys: Object.keys(byKey).sort((a, b) => a.localeCompare(b)),
    byKey
  };
}

function toNodeRef(node: { type: string; name: string }) {
  return `${node.type}:${node.name}`;
}
