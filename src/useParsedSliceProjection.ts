import { useMemo } from 'react';
import { parseDsl } from './domain/parseDsl';
import { updateParsedSliceProjection } from './domain/parsedSliceProjection';

type SliceTextDocument = {
  id: string;
  dsl: string;
};

export function useParsedSliceProjection(slices: SliceTextDocument[]) {
  const bySliceId = useMemo(
    () => updateParsedSliceProjection(new Map(), slices, parseDsl),
    [slices]
  );

  const list = useMemo(() => [...bySliceId.values()], [bySliceId]);

  return { bySliceId, list };
}
