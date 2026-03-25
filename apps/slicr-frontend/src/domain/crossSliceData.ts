import { getSliceNameFromDsl } from '../sliceLibrary';
import { parseDsl } from './parseDsl';
import { toNodeAnalysisRef, toNodeAnalysisRefFromNode } from './nodeAnalysisKey';
import type { ParsedSliceProjection } from './parsedSliceProjection';
import type { Parsed } from './types';

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
  return getCrossSliceDataFromParsed(
    slices.map((slice) => ({ id: slice.id, dsl: slice.dsl, parsed: parseDsl(slice.dsl) })),
    nodeRef
  );
}

export type CrossSliceDataParsedDocument = ParsedSliceProjection<Parsed>;

export function getCrossSliceDataFromParsed(slices: CrossSliceDataParsedDocument[], nodeRef: string): CrossSliceDataResult {
  const byKey: CrossSliceDataByKey = {};
  const analysisRef = toNodeAnalysisRef(nodeRef);

  for (const slice of slices) {
    const matchingNodes = [...slice.parsed.nodes.values()]
      .filter((item) => toNodeAnalysisRefFromNode(item) === analysisRef);
    for (const node of matchingNodes) {
      if (node.type === 'generic' || !node.data) {
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
  }

  for (const values of Object.values(byKey)) {
    values.sort((a, b) => {
      const byName = a.sliceName.localeCompare(b.sliceName);
      if (byName !== 0) {
        return byName;
      }
      return a.sliceId.localeCompare(b.sliceId);
    });
  }

  return {
    keys: Object.keys(byKey).sort((a, b) => a.localeCompare(b)),
    byKey
  };
}
