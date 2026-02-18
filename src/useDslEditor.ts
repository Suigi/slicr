import { Dispatch, RefObject, SetStateAction, useEffect, useRef } from 'react';
import { EditorSelection, EditorState, Prec, RangeSet, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { foldGutter, codeFolding, foldEffect, foldable, unfoldAll } from '@codemirror/language';
import { EditorView, Decoration, DecorationSet, GutterMarker, gutterLineClass, keymap } from '@codemirror/view';
import { acceptCompletion, completionStatus, currentCompletions, moveCompletionSelection, selectedCompletion, selectedCompletionIndex, setSelectedCompletion } from '@codemirror/autocomplete';
import { history, undo, redo } from '@codemirror/commands';
import { getDependencySuggestions } from './domain/dslAutocomplete';
import { slicr } from './slicrLanguage';

export type Range = { from: number; to: number };
export type EditorWarning = { range: Range; message: string };

function acceptActiveCompletion(view: EditorView): boolean {
  if (acceptCompletion(view)) {
    return true;
  }

  const options = currentCompletions(view.state);
  if (options.length === 0) {
    return false;
  }

  if (selectedCompletionIndex(view.state) === null) {
    if (!moveCompletionSelection(true)(view)) {
      view.dispatch({ effects: setSelectedCompletion(0) });
    }
  }

  return acceptCompletion(view);
}

function acceptCompletionFallback(view: EditorView): boolean {
  const { state } = view;
  const main = state.selection.main;
  const doc = state.doc.toString();

  let from = main.from;
  while (from > 0 && /[\w:@#-]/.test(doc[from - 1])) {
    from -= 1;
  }

  const picked = selectedCompletion(state);
  const label = (typeof picked?.label === 'string' ? picked.label : null) ?? getDependencySuggestions(doc, main.from)[0];
  if (!label) {
    return false;
  }

  view.dispatch({
    changes: { from, to: main.to, insert: label },
    selection: { anchor: from + label.length }
  });
  return true;
}

export function getNewLineIndent(previousLineText: string): string {
  const baseIndent = previousLineText.match(/^\s*/)?.[0] ?? '';
  if (previousLineText.trimEnd().endsWith(':')) {
    return `${baseIndent}  `;
  }
  return baseIndent;
}

export function insertNewLineWithIndent(view: EditorView): boolean {
  const { state } = view;
  const change = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);

    if (line.text.trim().length === 0) {
      return {
        changes: { from: line.from, to: line.to, insert: '\n' },
        range: EditorSelection.cursor(line.from + 1)
      };
    }

    const linePrefix = line.text.slice(0, range.from - line.from);
    const indent = getNewLineIndent(linePrefix);
    const insert = `\n${indent}`;

    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + insert.length)
    };
  });

  view.dispatch(change);

  return true;
}

const setHighlight = StateEffect.define<Range | null>();
const setWarnings = StateEffect.define<EditorWarning[]>();

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

class WarningMarker extends GutterMarker {
  readonly elementClass = 'cm-warning-line';

  constructor(private readonly message: string) {
    super();
  }

  eq(other: WarningMarker) {
    return this.message === other.message;
  }

  toDOM() {
    const marker = document.createElement('span');
    marker.className = 'cm-warning-line-marker';
    marker.setAttribute('aria-label', this.message);
    return marker;
  }

}

const warningGutterField = StateField.define<RangeSet<GutterMarker>>({
  create() {
    return RangeSet.empty;
  },
  update(markers, tr) {
    markers = markers.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setWarnings)) {
        continue;
      }

      const builder = new RangeSetBuilder<GutterMarker>();
      const seenLineStarts = new Set<number>();
      for (const warning of effect.value) {
        if (warning.range.from < 0 || warning.range.from > tr.state.doc.length) {
          continue;
        }
        const line = tr.state.doc.lineAt(warning.range.from);
        if (seenLineStarts.has(line.from)) {
          continue;
        }
        seenLineStarts.add(line.from);
        builder.add(line.from, line.from, new WarningMarker(warning.message));
      }
      markers = builder.finish();
    }
    return markers;
  },
  provide: (field) => gutterLineClass.from(field)
});

const warningMessagesField = StateField.define<Map<number, string>>({
  create() {
    return new Map();
  },
  update(messages, tr) {
    for (const effect of tr.effects) {
      if (!effect.is(setWarnings)) {
        continue;
      }

      const next = new Map<number, string>();
      for (const warning of effect.value) {
        if (warning.range.from < 0 || warning.range.from > tr.state.doc.length) {
          continue;
        }
        const lineFrom = tr.state.doc.lineAt(warning.range.from).from;
        const previous = next.get(lineFrom);
        next.set(lineFrom, previous ? `${previous}\n${warning.message}` : warning.message);
      }
      return next;
    }
    return messages;
  }
});

export function indentCurrentLineByTwo(view: EditorView): boolean {
  const state = view.state;
  const lineStarts = collectSelectedLineStarts(state);

  const changes = [...lineStarts].sort((a, b) => a - b).map((from) => ({
    from,
    insert: '  '
  }));

  if (changes.length === 0) {
    return false;
  }

  const changeSet = state.changes(changes);
  const mappedRanges = state.selection.ranges.map((range) =>
    EditorSelection.range(changeSet.mapPos(range.anchor, 1), changeSet.mapPos(range.head, 1))
  );
  view.dispatch({
    changes: changeSet,
    selection: EditorSelection.create(mappedRanges, state.selection.mainIndex)
  });
  return true;
}

export function unindentCurrentLineByTwo(view: EditorView): boolean {
  const state = view.state;
  const lineStarts = collectSelectedLineStarts(state);

  const changes: Array<{ from: number; to: number }> = [];
  for (const lineStart of [...lineStarts].sort((a, b) => a - b)) {
    const line = state.doc.lineAt(lineStart);
    const lineText = line.text;
    if (lineText.startsWith('  ')) {
      changes.push({ from: line.from, to: line.from + 2 });
    } else if (lineText.startsWith(' ')) {
      changes.push({ from: line.from, to: line.from + 1 });
    }
  }

  if (changes.length === 0) {
    return true;
  }

  const changeSet = state.changes(changes);
  const mappedRanges = state.selection.ranges.map((range) =>
    EditorSelection.range(changeSet.mapPos(range.anchor, 1), changeSet.mapPos(range.head, 1))
  );
  view.dispatch({
    changes: changeSet,
    selection: EditorSelection.create(mappedRanges, state.selection.mainIndex)
  });
  return true;
}

function collectSelectedLineStarts(state: EditorState): Set<number> {
  const starts = new Set<number>();

  for (const range of state.selection.ranges) {
    const from = Math.min(range.anchor, range.head);
    const to = Math.max(range.anchor, range.head);

    if (from === to) {
      starts.add(state.doc.lineAt(from).from);
      continue;
    }

    let effectiveTo = to;
    const endLine = state.doc.lineAt(to);
    if (to > from && endLine.from === to) {
      effectiveTo = to - 1;
    }

    const firstLine = state.doc.lineAt(from).number;
    const lastLine = state.doc.lineAt(effectiveTo).number;
    for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber += 1) {
      starts.add(state.doc.line(lineNumber).from);
    }
  }

  return starts;
}

export type EditorViewLike = {
  state: {
    doc: {
      toString: () => string;
      length: number;
    };
  };
  dispatch: (spec: { changes?: { from: number; to: number; insert: string }; effects?: unknown }) => void;
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

export const defaultCreateEditorView: CreateEditorView = ({ parent, doc, onDocChanged }) => {
  return (new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        slicr(),
        history(),
        highlightField,
        warningGutterField,
        warningMessagesField,
        foldGutter({
          markerDOM: (open) => createFoldMarker(open),
          domEventHandlers: {
            mousemove: (view, line, event) => {
              const message = view.state.field(warningMessagesField).get(line.from);
              const tooltip = view.dom.querySelector('.cm-warning-tooltip') as HTMLDivElement | null;
              if (!message || !(event instanceof MouseEvent)) {
                tooltip?.remove();
                return false;
              }

              const rootRect = view.dom.getBoundingClientRect();
              const left = Math.min(event.clientX - rootRect.left + 10, rootRect.width - 340);
              const top = Math.max(8, event.clientY - rootRect.top - 8);

              let nextTooltip = tooltip;
              if (!nextTooltip) {
                nextTooltip = document.createElement('div');
                nextTooltip.className = 'cm-warning-tooltip';
                view.dom.appendChild(nextTooltip);
              }
              nextTooltip.textContent = message;
              nextTooltip.style.left = `${left}px`;
              nextTooltip.style.top = `${top}px`;
              return false;
            },
            mouseleave: (view) => {
              view.dom.querySelector('.cm-warning-tooltip')?.remove();
              return false;
            }
          }
        }),
        codeFolding({
          placeholderText: '...',
        }),
        Prec.highest(
          keymap.of([
            { key: 'Mod-z', run: undo, preventDefault: true },
            { key: 'Mod-Shift-z', run: redo, preventDefault: true },
            { key: 'Mod-y', run: redo, preventDefault: true }
          ])
        ),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': {
            position: 'relative',
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
          '.cm-foldGutter .cm-gutterElement.cm-warning-line': {
            backgroundColor: 'rgb(239 68 68 / 30%)'
          },
          '.cm-warning-tooltip': {
            position: 'absolute',
            zIndex: '1000',
            maxWidth: '320px',
            padding: '8px 10px',
            borderRadius: '8px',
            backgroundColor: '#1f2937',
            color: '#f9fafb',
            border: '1px solid rgb(239 68 68 / 55%)',
            boxShadow: '0 8px 24px rgb(0 0 0 / 40%)',
            fontSize: '12px',
            lineHeight: '1.4',
            pointerEvents: 'none'
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
          },
          '.cm-tooltip.cm-tooltip-autocomplete': {
            backgroundColor: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: '0 14px 32px rgb(0 0 0 / 45%)',
            overflow: 'hidden',
            zIndex: '4000'
          },
          '.cm-tooltip.cm-tooltip-autocomplete > ul': {
            fontFamily: "'JetBrains Mono', monospace",
            maxHeight: '280px',
            padding: '4px'
          },
          '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
            color: 'var(--text)',
            borderRadius: '6px',
            padding: '4px 8px'
          },
          '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
            backgroundColor: 'rgb(249 115 22 / 22%)',
            color: '#fff'
          },
          '.cm-completionIcon': {
            color: '#9ca3af',
            opacity: '0.9'
          },
          '.cm-completionLabel': {
            color: 'var(--text)'
          },
          '.cm-completionIcon-evt': {
            color: 'var(--evt)'
          },
          '.cm-completionIcon-cmd': {
            color: 'var(--command-color)'
          },
          '.cm-completionIcon-rm': {
            color: 'var(--rm)'
          },
          '.cm-completionIcon-ui': {
            color: 'var(--ui-color)'
          },
          '.cm-completionIcon-exc': {
            color: 'var(--exc)'
          },
          '.cm-completionIcon-aut': {
            color: '#14b8a6'
          },
          '.cm-completionIcon-ext': {
            color: '#c084fc'
          },
          '.cm-completionIcon-evt + .cm-completionLabel': {
            color: 'var(--evt)'
          },
          '.cm-completionIcon-cmd + .cm-completionLabel': {
            color: 'var(--command-color)'
          },
          '.cm-completionIcon-rm + .cm-completionLabel': {
            color: 'var(--rm)'
          },
          '.cm-completionIcon-ui + .cm-completionLabel': {
            color: 'var(--ui-color)'
          },
          '.cm-completionIcon-exc + .cm-completionLabel': {
            color: 'var(--exc)'
          },
          '.cm-completionIcon-aut + .cm-completionLabel': {
            color: '#14b8a6'
          },
          '.cm-completionIcon-ext + .cm-completionLabel': {
            color: '#c084fc'
          },
          '.cm-completionDetail': {
            color: 'var(--muted)',
            fontStyle: 'normal'
          },
          '.cm-completionMatchedText': {
            color: '#fb923c',
            textDecoration: 'none',
            fontWeight: '700'
          }
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) {
            return;
          }

          const nextDoc = update.state.doc.toString();
          onDocChanged(nextDoc);
        })
      ]
    }),
    parent
  }) as unknown as EditorViewLike);
};

export function useDslEditor({
  dsl,
  onDslChange,
  onRangeHover,
  editorMountRef,
  highlightRange,
  warnings = [],
  createEditorView = defaultCreateEditorView
}: {
  dsl: string;
  onDslChange: Dispatch<SetStateAction<string>>;
  onRangeHover?: (range: Range | null) => void;
  editorMountRef: RefObject<HTMLDivElement>;
  highlightRange?: Range | null;
  warnings?: EditorWarning[];
  createEditorView?: CreateEditorView;
}) {
  const editorViewRef = useRef<EditorViewLike | null>(null);
  const initialDslRef = useRef(dsl);
  const onDocChangedRef = useRef(onDslChange);
  const onRangeHoverRef = useRef(onRangeHover);
  const warningsRef = useRef(warnings);

  useEffect(() => {
    onDocChangedRef.current = onDslChange;
  }, [onDslChange]);

  useEffect(() => {
    onRangeHoverRef.current = onRangeHover;
  }, [onRangeHover]);

  useEffect(() => {
    warningsRef.current = warnings;
  }, [warnings]);

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

  const expandAllRegions = () => {
    const editorView = editorViewRef.current as EditorView | null;
    if (!editorView) {
      return;
    }

    unfoldAll(editorView);
  };

  useEffect(() => {
    const editorView = editorViewRef.current;
    if (!editorView || !(editorView instanceof EditorView)) {
      return;
    }

    if (highlightRange) {
      editorView.dispatch({
        effects: setHighlight.of(highlightRange)
      });
    } else {
      editorView.dispatch({
        effects: setHighlight.of(null)
      });
    }
  }, [highlightRange]);

  useEffect(() => {
    const editorView = editorViewRef.current;
    if (!editorView || !(editorView instanceof EditorView)) {
      return;
    }

    editorView.dispatch({
      effects: setWarnings.of(warnings)
    });
  }, [warnings]);

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

    if (editorView instanceof EditorView) {
      const onTabKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Tab') {
          return;
        }
        if (completionStatus(editorView.state) !== null) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          if (!acceptActiveCompletion(editorView) && !acceptCompletionFallback(editorView)) {
            queueMicrotask(() => {
              if (completionStatus(editorView.state) !== null) {
                if (!acceptActiveCompletion(editorView)) {
                  acceptCompletionFallback(editorView);
                }
              }
            });
          }
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (event.shiftKey) {
          unindentCurrentLineByTwo(editorView);
        } else {
          indentCurrentLineByTwo(editorView);
        }
      };

      const onEnterKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter') {
          return;
        }
        if (completionStatus(editorView.state) !== null) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        insertNewLineWithIndent(editorView);
      };

      const onWindowKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Tab' && event.key !== 'Enter') {
          return;
        }
        if (!editorView.hasFocus) {
          return;
        }
        if (event.key === 'Tab') {
          onTabKeyDown(event);
        } else {
          onEnterKeyDown(event);
        }
      };

      const onDomKeyDown = (event: KeyboardEvent) => onTabKeyDown(event);
      const onContentDomKeyDown = (event: KeyboardEvent) => onTabKeyDown(event);
      const onDomEnterKeyDown = (event: KeyboardEvent) => onEnterKeyDown(event);
      const onContentDomEnterKeyDown = (event: KeyboardEvent) => onEnterKeyDown(event);

      editorView.dom.addEventListener('keydown', onDomKeyDown, { capture: true });
      editorView.contentDOM.addEventListener('keydown', onContentDomKeyDown, { capture: true });
      editorView.dom.addEventListener('keydown', onDomEnterKeyDown, { capture: true });
      editorView.contentDOM.addEventListener('keydown', onContentDomEnterKeyDown, { capture: true });
      window.addEventListener('keydown', onWindowKeyDown, { capture: true });
      editorView.dispatch({
        effects: setWarnings.of(warningsRef.current)
      });

      return () => {
        editorView.dom.removeEventListener('keydown', onDomKeyDown, { capture: true });
        editorView.contentDOM.removeEventListener('keydown', onContentDomKeyDown, { capture: true });
        editorView.dom.removeEventListener('keydown', onDomEnterKeyDown, { capture: true });
        editorView.contentDOM.removeEventListener('keydown', onContentDomEnterKeyDown, { capture: true });
        window.removeEventListener('keydown', onWindowKeyDown, { capture: true });
        editorView.dom.querySelector('.cm-warning-tooltip')?.remove();
        editorView.destroy();
        editorViewRef.current = null;
      };
    }

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

  return { collapseAllDataRegions, collapseAllRegions, expandAllRegions };
}
