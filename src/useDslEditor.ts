import { Dispatch, RefObject, SetStateAction, useEffect, useRef } from 'react';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { slicr } from './slicrLanguage';

export type Range = { from: number; to: number };

const setHighlight = StateEffect.define<Range | null>();

const highlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(highlights, tr) {
    highlights = highlights.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setHighlight)) {
        if (e.value) {
          const deco = [];
          const lineFrom = tr.state.doc.lineAt(e.value.from).number;
          const lineTo = tr.state.doc.lineAt(e.value.to).number;

          for (let i = lineFrom; i <= lineTo; i++) {
            const line = tr.state.doc.line(i);
            deco.push(Decoration.line({ class: 'cm-node-highlight' }).range(line.from));
          }
          highlights = Decoration.set(deco);
        } else {
          highlights = Decoration.none;
        }
      }
    }
    return highlights;
  },
  provide: (f) => EditorView.decorations.from(f)
});

export type EditorViewLike = {
  state: {
    doc: {
      toString: () => string;
      length: number;
    };
  };
  dispatch: (spec: { changes: { from: number; to: number; insert: string } }) => void;
  destroy: () => void;
};

type CreateEditorView = (args: {
  parent: HTMLDivElement;
  doc: string;
  onDocChanged: (nextDoc: string) => void;
}) => EditorViewLike;

const defaultCreateEditorView: CreateEditorView = ({ parent, doc, onDocChanged }) =>
  new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        slicr(),
        highlightField,
        EditorView.lineWrapping,
        EditorView.theme({
          '&': {
            height: '100%',
            backgroundColor: 'transparent'
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '13px',
            lineHeight: '1.7',
            padding: '16px'
          },
          '.cm-content': {
            caretColor: '#f97316'
          },
          '.cm-cursor, .cm-dropCursor': {
            borderLeftColor: '#f97316'
          },
          '.cm-selectionBackground, ::selection': {
            backgroundColor: 'rgb(59 130 246 / 30%)'
          },
          '&.cm-focused': {
            outline: 'none'
          },
          '.cm-activeLine': {
            backgroundColor: 'rgb(255 255 255 / 2%)'
          }
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) {
            return;
          }

          onDocChanged(update.state.doc.toString());
        })
      ]
    }),
    parent
  });

export function useDslEditor({
  dsl,
  onDslChange,
  onRangeHover,
  editorMountRef,
  highlightRange,
  createEditorView = defaultCreateEditorView
}: {
  dsl: string;
  onDslChange: Dispatch<SetStateAction<string>>;
  onRangeHover?: (range: Range | null) => void;
  editorMountRef: RefObject<HTMLDivElement>;
  highlightRange?: Range | null;
  createEditorView?: CreateEditorView;
}) {
  const editorViewRef = useRef<EditorViewLike | null>(null);
  const initialDslRef = useRef(dsl);

  useEffect(() => {
    const editorView = editorViewRef.current;
    if (!editorView) {
      return;
    }

    if (highlightRange) {
      (editorView as EditorView).dispatch({
        effects: setHighlight.of(highlightRange)
      });
    } else {
      (editorView as EditorView).dispatch({
        effects: setHighlight.of(null)
      });
    }
  }, [highlightRange]);

  useEffect(() => {
    if (!editorMountRef.current || editorViewRef.current) {
      return;
    }

    const editorView = createEditorView({
      parent: editorMountRef.current,
      doc: initialDslRef.current,
      onDocChanged: (nextValue) => {
        onDslChange((current) => (current === nextValue ? current : nextValue));
      }
    });

    if (onRangeHover) {
      const view = editorView as EditorView;
      view.dom.addEventListener('mousemove', (event) => {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos !== null) {
          onRangeHover({ from: pos, to: pos });
        } else {
          onRangeHover(null);
        }
      });
      view.dom.addEventListener('mouseleave', () => {
        onRangeHover(null);
      });
    }

    editorViewRef.current = editorView;

    return () => {
      editorView.destroy();
      editorViewRef.current = null;
    };
  }, [createEditorView, editorMountRef, onDslChange]);

  useEffect(() => {
    const editorView = editorViewRef.current;
    if (!editorView) {
      return;
    }

    const current = editorView.state.doc.toString();
    if (current === dsl) {
      return;
    }

    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: dsl }
    });
  }, [dsl]);
}
