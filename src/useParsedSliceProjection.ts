import { useMemo } from 'react';
import { parseDsl } from './domain/parseDsl';
import type { Parsed } from './domain/types';
import type { ParsedSliceProjection } from './domain/parsedSliceProjection';
import { updateParsedSliceProjection } from './domain/parsedSliceProjection';

type SliceTextDocument = {
  id: string;
  dsl: string;
};

function createProjectionUpdater() {
  let previous = new Map<string, ParsedSliceProjection<Parsed>>();
  return (slices: SliceTextDocument[]) => {
    previous = updateParsedSliceProjection(previous, slices, parseDsl);
    return previous;
  };
}

export function useParsedSliceProjection(slices: SliceTextDocument[]) {
  const updateProjection = useMemo(() => createProjectionUpdater(), []);
  const bySliceId = useMemo(() => updateProjection(slices), [slices, updateProjection]);

  const list = useMemo(() => [...bySliceId.values()], [bySliceId]);

  return { bySliceId, list };
}
