import { EditorState, RangeSetBuilder, StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import { tokenizeDslLine } from './dslTokenizer';

function buildHighlightDecorations(state: EditorState) {
  const builder = new RangeSetBuilder<Decoration>();

  for (let i = 1; i <= state.doc.lines; i += 1) {
    const line = state.doc.line(i);
    const tokens = tokenizeDslLine(line.text);
    for (const token of tokens) {
      builder.add(
        line.from + token.from,
        line.from + token.to,
        Decoration.mark({ class: `dsl-tok-${token.type}` })
      );
    }
  }

  return builder.finish();
}

const dslHighlightField = StateField.define({
  create(state) {
    return buildHighlightDecorations(state);
  },
  update(decorations, transaction) {
    if (!transaction.docChanged) {
      return decorations;
    }
    return buildHighlightDecorations(transaction.state);
  },
  provide(field) {
    return EditorView.decorations.from(field);
  }
});

export const dslHighlightDecorations = [dslHighlightField];
