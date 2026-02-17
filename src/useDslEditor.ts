import { Dispatch, RefObject, SetStateAction, useEffect, useRef } from 'react';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { foldGutter, codeFolding, foldEffect, foldable } from '@codemirror/language';
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
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

const createFoldMarker = (open: boolean) => {
  const svgNS = 'http://www.w3.org/2000/svg';
  const marker = document.createElement('span');
  marker.className = 'cm-fold-marker';

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '10');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.6');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('d', open ? 'M2 4 Q6 9 10 4' : 'M4 2 Q9 6 4 10');

  svg.appendChild(path);
  marker.appendChild(svg);
  return marker;
};

const defaultCreateEditorView: CreateEditorView = ({ parent, doc, onDocChanged }) =>
  new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        slicr(),
        highlightField,
        foldGutter({
          markerDOM: (open) => createFoldMarker(open)
        }),
        codeFolding({
          placeholderText: '...',
        }),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': {
            height: '100%',
            backgroundColor: 'transparent'
          },
          '.cm-gutters': {
            backgroundColor: 'transparent',
            color: '#6b6b80',
            border: 'none',
            borderRight: '1px solid rgb(42 42 56 / 45%)'
          },
          '.cm-gutter': {
            backgroundColor: 'transparent',
            border: 'none'
          },
          '.cm-gutterElement': {
            color: '#6b6b80'
          },
          '.cm-foldGutter .cm-gutterElement': {
            color: '#8a8aa0'
          },
          '.cm-fold-marker': {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '12px',
            height: '12px'
          },
          '.cm-fold-marker svg': {
            display: 'block'
          },
          '.cm-foldGutter .cm-gutterElement:hover': {
            color: '#b8b8c7'
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
          },
          '.cm-foldPlaceholder': {
            backgroundColor: 'transparent',
            border: 'none',
            color: '#8a8aa0',
            fontWeight: '600'
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
  const onDocChangedRef = useRef(onDslChange);
  const onRangeHoverRef = useRef(onRangeHover);

  useEffect(() => {
    onDocChangedRef.current = onDslChange;
  }, [onDslChange]);

  useEffect(() => {
    onRangeHoverRef.current = onRangeHover;
  }, [onRangeHover]);

  const collapseAllDataRegions = () => {
    const editorView = editorViewRef.current as EditorView | null;
    if (!editorView) {
      return;
    }

    const effects: StateEffect<unknown>[] = [];
    for (let lineNumber = 1; lineNumber <= editorView.state.doc.lines; lineNumber++) {
      const line = editorView.state.doc.line(lineNumber);
      if (!/^\s*data:\s*$/.test(line.text)) {
        continue;
      }

      const foldRange = foldable(editorView.state, line.from, line.to);
      if (foldRange) {
        effects.push(foldEffect.of(foldRange));
      }
    }

    if (effects.length > 0) {
      editorView.dispatch({ effects });
    }
  };

  const collapseAllRegions = () => {
    const editorView = editorViewRef.current as EditorView | null;
    if (!editorView) {
      return;
    }

    const effects: StateEffect<unknown>[] = [];
    for (let lineNumber = 1; lineNumber <= editorView.state.doc.lines; lineNumber++) {
      const line = editorView.state.doc.line(lineNumber);
      const foldRange = foldable(editorView.state, line.from, line.to);
      if (foldRange) {
        effects.push(foldEffect.of(foldRange));
      }
    }

    if (effects.length > 0) {
      editorView.dispatch({ effects });
    }
  };

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
        onDocChangedRef.current((current) => (current === nextValue ? current : nextValue));
      }
    });

    if (onRangeHoverRef.current) {
      const view = editorView as EditorView;
      view.dom.addEventListener('mousemove', (event) => {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos !== null) {
          onRangeHoverRef.current?.({ from: pos, to: pos });
        } else {
          onRangeHoverRef.current?.(null);
        }
      });
      view.dom.addEventListener('mouseleave', () => {
        onRangeHoverRef.current?.(null);
      });
    }

    editorViewRef.current = editorView;

    return () => {
      editorView.destroy();
      editorViewRef.current = null;
    };
  }, [createEditorView, editorMountRef]);

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

  return { collapseAllDataRegions, collapseAllRegions };
}
