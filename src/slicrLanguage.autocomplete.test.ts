import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { slicr } from './slicrLanguage';

type CompletionResult = null | { from: number; options: Array<{ label: string; type?: string }> };

function getAutocompleteSource(state: EditorState, pos: number) {
  const data = state.languageDataAt('autocomplete', pos);
  return data.find((item) => typeof item === 'function') as ((context: unknown) => CompletionResult | Promise<CompletionResult>) | undefined;
}

function makeContext(state: EditorState, pos: number) {
  return {
    state,
    pos,
    explicit: true,
    matchBefore: (pattern: RegExp) => {
      const line = state.doc.lineAt(pos);
      const text = line.text.slice(0, pos - line.from);
      const match = text.match(pattern);
      if (!match || match.index === undefined) {
        return null;
      }
      return {
        from: line.from + match.index,
        to: pos,
        text: match[0]
      };
    }
  };
}

describe('slicr autocomplete wiring', () => {
  it('registers an autocomplete source in language data', () => {
    const doc = `slice "Orders"

evt:order-created
cmd:create-order <- `;
    const state = EditorState.create({ doc, extensions: [slicr()] });
    const source = getAutocompleteSource(state, doc.length);

    expect(source).toBeDefined();
  });

  it('suggests existing node refs for dependency editing context', async () => {
    const doc = `slice "Orders"

evt:order-created
rm:orders <- evt:order-created
cmd:create-order <- `;
    const state = EditorState.create({ doc, extensions: [slicr()] });
    const pos = doc.length;
    const source = getAutocompleteSource(state, pos);

    expect(source).toBeDefined();
    const result = source ? await source(makeContext(state, pos)) : null;

    expect(result).not.toBeNull();
    const labels = result?.options.map((option) => option.label) ?? [];
    expect(labels).toContain('evt:order-created');
    expect(labels).toContain('rm:orders');
  });

  it('emits completion option types that match node prefixes', async () => {
    const doc = `slice "Orders"

evt:order-created
cmd:create-order
rm:orders
cmd:place-order <- `;
    const state = EditorState.create({ doc, extensions: [slicr()] });
    const pos = doc.length;
    const source = getAutocompleteSource(state, pos);
    expect(source).toBeDefined();

    const result = source ? await source(makeContext(state, pos)) : null;
    expect(result).not.toBeNull();

    const byLabel = new Map((result?.options ?? []).map((option) => [option.label, option.type]));
    expect(byLabel.get('evt:order-created')).toBe('evt');
    expect(byLabel.get('cmd:create-order')).toBe('cmd');
    expect(byLabel.get('rm:orders')).toBe('rm');
  });
});
