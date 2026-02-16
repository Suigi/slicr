import { EditorState, RangeSetBuilder, StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import { tokenizeDslLine } from './dslTokenizer';

function buildHighlightDecorations(state: EditorState) {
  const builder = new RangeSetBuilder<Decoration>();

  for (let i = 1; i <= state.doc.lines; i += 1) {
    const line = state.doc.line(i);
    const tokens = tokenizeDslLine(line.text);
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const className = getTokenClass(tokens, index);
      builder.add(
        line.from + token.from,
        line.from + token.to,
        Decoration.mark({ class: className })
      );
    }
  }

  return builder.finish();
}

function getTokenClass(tokens: ReturnType<typeof tokenizeDslLine>, index: number) {
  const token = tokens[index];
  if (token.type === 'string' && tokens[index + 1]?.type === 'punctuation' && tokens[index + 1].text.startsWith(':')) {
    return 'dsl-tok-jsonKey';
  }

  if (token.type === 'variableName' && tokens[index - 1]?.type === 'punctuation') {
    const typeToken = tokens[index - 2]?.type;
    const nameClassByType: Partial<Record<(typeof tokens)[number]['type'], string>> = {
      cmdType: 'dsl-tok-cmdName',
      evtType: 'dsl-tok-evtName',
      rmType: 'dsl-tok-rmName',
      uiType: 'dsl-tok-uiName'
    };
    const nameClass = typeToken ? nameClassByType[typeToken] : undefined;
    if (nameClass) {
      return nameClass;
    }
  }

  return `dsl-tok-${token.type}`;
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
