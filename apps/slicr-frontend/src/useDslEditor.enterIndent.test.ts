// @vitest-environment jsdom

import { EditorSelection, EditorState, SelectionRange } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { insertNewLineWithIndent } from './useDslEditor';

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.innerHTML = '';
});

function createView(doc: string, anchor: number) {
  return createViewWithSelection(doc, EditorSelection.cursor(anchor));
}

function createViewWithSelection(doc: string, selection: EditorSelection | SelectionRange) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const normalizedSelection =
    selection instanceof EditorSelection ? selection : EditorSelection.create([selection]);
  view = new EditorView({
    state: EditorState.create({
      doc,
      selection: normalizedSelection,
      extensions: [EditorState.allowMultipleSelections.of(true)]
    }),
    parent: host
  });
  return view;
}

describe('enter indentation command', () => {
  it('keeps indentation from the current line', () => {
    const editor = createView('  rm:orders', '  rm:orders'.length);
    const handled = insertNewLineWithIndent(editor);

    expect(handled).toBe(true);
    expect(editor.state.doc.toString()).toBe('  rm:orders\n  ');
  });

  it('adds one indentation level when current line ends with a colon', () => {
    const editor = createView('  data:', '  data:'.length);
    const handled = insertNewLineWithIndent(editor);

    expect(handled).toBe(true);
    expect(editor.state.doc.toString()).toBe('  data:\n    ');
  });

  it('uses text before cursor when splitting a line to determine indentation', () => {
    const doc = '  data: value';
    const editor = createView(doc, '  data:'.length);
    const handled = insertNewLineWithIndent(editor);

    expect(handled).toBe(true);
    expect(editor.state.doc.toString()).toBe('  data:\n     value');
  });

  it('resets indentation to zero on whitespace-only lines and clears that line', () => {
    const editor = createView('a\n    \nb', 6);
    const handled = insertNewLineWithIndent(editor);

    expect(handled).toBe(true);
    expect(editor.state.doc.toString()).toBe('a\n\n\nb');
  });

  it('preserves multiple cursors and applies enter indentation at each cursor', () => {
    const doc = '  data:\n  rm:orders';
    const firstCursor = '  data:'.length;
    const secondCursor = doc.length;
    const editor = createViewWithSelection(
      doc,
      EditorSelection.create([
        EditorSelection.cursor(firstCursor),
        EditorSelection.cursor(secondCursor)
      ])
    );

    const handled = insertNewLineWithIndent(editor);

    expect(handled).toBe(true);
    expect(editor.state.doc.toString()).toBe('  data:\n    \n  rm:orders\n  ');
    expect(editor.state.selection.ranges).toHaveLength(2);
    expect(editor.state.selection.ranges.map((range) => range.head)).toEqual([12, 27]);
  });
});
