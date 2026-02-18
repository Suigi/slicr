// @vitest-environment jsdom

import { EditorSelection, EditorState } from '@codemirror/state';
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
  const host = document.createElement('div');
  document.body.appendChild(host);
  view = new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.cursor(anchor)
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
});
