// @vitest-environment jsdom

import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { indentCurrentLineByTwo, unindentCurrentLineByTwo } from './useDslEditor';

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
      selection: { anchor }
    }),
    parent: host
  });
  return view;
}

function createViewWithRange(doc: string, from: number, to: number) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  view = new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.range(from, to)
    }),
    parent: host
  });
  return view;
}

describe('dsl editor keymap commands', () => {
  it('indents the current line by 2 spaces', () => {
    const editor = createView('a\nb', 2);
    const handled = indentCurrentLineByTwo(editor);

    expect(handled).toBe(true);
    expect(editor.state.doc.toString()).toBe('a\n  b');
  });

  it('unindents the current line by 2 spaces', () => {
    const editor = createView('a\n  b', 4);
    const handled = unindentCurrentLineByTwo(editor);

    expect(handled).toBe(true);
    expect(editor.state.doc.toString()).toBe('a\nb');
  });

  it('unindent removes a single leading space when only one is present', () => {
    const editor = createView('a\n b', 3);
    const handled = unindentCurrentLineByTwo(editor);

    expect(handled).toBe(true);
    expect(editor.state.doc.toString()).toBe('a\nb');
  });

  it('indents an empty current line by 2 spaces', () => {
    const editor = createView('a\n\nb', 2);
    const handled = indentCurrentLineByTwo(editor);

    expect(handled).toBe(true);
    expect(editor.state.doc.toString()).toBe('a\n  \nb');
    expect(editor.state.selection.main.head).toBe(4);
  });

  it('indents all lines in a multi-line selection', () => {
    const editor = createViewWithRange('a\nb\nc', 0, 3);
    const handled = indentCurrentLineByTwo(editor);

    expect(handled).toBe(true);
    expect(editor.state.doc.toString()).toBe('  a\n  b\nc');
  });

  it('unindents all lines in a multi-line selection', () => {
    const editor = createViewWithRange('  a\n  b\nc', 0, 7);
    const handled = unindentCurrentLineByTwo(editor);

    expect(handled).toBe(true);
    expect(editor.state.doc.toString()).toBe('a\nb\nc');
  });

});
