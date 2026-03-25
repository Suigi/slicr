export type SliceTextDocument = {
  id: string;
  dsl: string;
};

export type ParsedSliceProjection<TParsed> = {
  id: string;
  dsl: string;
  parsed: TParsed;
};

export function updateParsedSliceProjection<TParsed>(
  previous: Map<string, ParsedSliceProjection<TParsed>>,
  slices: SliceTextDocument[],
  parse: (dsl: string) => TParsed
): Map<string, ParsedSliceProjection<TParsed>> {
  const next = new Map<string, ParsedSliceProjection<TParsed>>();
  const previousIds = [...previous.keys()];
  let changed = slices.length !== previous.size;

  for (const [index, slice] of slices.entries()) {
    if (!changed && previousIds[index] !== slice.id) {
      changed = true;
    }
    const existing = previous.get(slice.id);
    if (existing && existing.dsl === slice.dsl) {
      next.set(slice.id, existing);
      continue;
    }
    changed = true;

    next.set(slice.id, {
      id: slice.id,
      dsl: slice.dsl,
      parsed: parse(slice.dsl)
    });
  }

  return changed ? next : previous;
}
