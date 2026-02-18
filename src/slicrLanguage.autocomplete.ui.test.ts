// @vitest-environment jsdom

import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { CompletionContext, completionStatus, startCompletion } from '@codemirror/autocomplete';
import { afterEach, describe, expect, it } from 'vitest';
import { slicr } from './slicrLanguage';

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.innerHTML = '';
});

type CompletionResult = null | { from: number; options: Array<{ label: string }> };

function getAutocompleteSource(state: EditorState, pos: number) {
  const data = state.languageDataAt('autocomplete', pos);
  return data.find((item) => typeof item === 'function') as ((context: CompletionContext) => CompletionResult | Promise<CompletionResult>) | undefined;
}

describe('slicr autocomplete ui', () => {
  it('opens completion suggestions while editing dependencies', async () => {
    const doc = `slice "Orders"

evt:order-created
rm:orders <- evt:order-created
cmd:create-order <- `;

    const host = document.createElement('div');
    document.body.appendChild(host);
    view = new EditorView({
      state: EditorState.create({
        doc,
        selection: { anchor: doc.length },
        extensions: [slicr()]
      }),
      parent: host
    });
    view.focus();

    const started = startCompletion(view);

    expect(started).toBe(true);
    expect(completionStatus(view.state)).not.toBeNull();

    const source = getAutocompleteSource(view.state, doc.length);
    expect(source).toBeDefined();
    const result = source ? await source(new CompletionContext(view.state, doc.length, true, view)) : null;
    const labels = result?.options.map((option) => option.label) ?? [];
    expect(labels).toContain('evt:order-created');
    expect(labels).toContain('rm:orders');
  });

  it('inserts a selected suggestion into the dependency list', async () => {
    const doc = `slice "Orders"

evt:order-created
cmd:create-order <- evt:order-cr`;

    const host = document.createElement('div');
    document.body.appendChild(host);
    view = new EditorView({
      state: EditorState.create({
        doc,
        selection: { anchor: doc.length },
        extensions: [slicr()]
      }),
      parent: host
    });
    view.focus();

    const pos = doc.length;
    const started = startCompletion(view);
    expect(started).toBe(true);
    expect(completionStatus(view.state)).not.toBeNull();

    const source = getAutocompleteSource(view.state, pos);
    expect(source).toBeDefined();
    const result = source ? await source(new CompletionContext(view.state, pos, true, view)) : null;
    expect(result).not.toBeNull();
    const selected = result?.options[0];
    expect(selected?.label).toBe('evt:order-created');

    if (result && selected) {
      view.dispatch({
        changes: { from: result.from, to: pos, insert: selected.label }
      });
    }
    expect(view.state.doc.toString()).toContain('cmd:create-order <- evt:order-created');
  });

  it('replaces typed dependency prefixes containing # when inserting a suggestion', async () => {
    const doc = `slice "Orders"

evt:order#created
cmd:create-order <- evt:order#`;

    const host = document.createElement('div');
    document.body.appendChild(host);
    view = new EditorView({
      state: EditorState.create({
        doc,
        selection: { anchor: doc.length },
        extensions: [slicr()]
      }),
      parent: host
    });

    const pos = doc.length;
    const source = getAutocompleteSource(view.state, pos);
    expect(source).toBeDefined();
    const result = source ? await source(new CompletionContext(view.state, pos, true, view)) : null;
    expect(result).not.toBeNull();
    expect(result?.from).toBe(doc.lastIndexOf('evt:order#'));
    const selected = result?.options[0];
    expect(selected?.label).toBe('evt:order#created');

    if (result && selected) {
      view.dispatch({
        changes: { from: result.from, to: pos, insert: selected.label }
      });
    }

    expect(view.state.doc.toString()).toContain('cmd:create-order <- evt:order#created');
    expect(view.state.doc.toString()).not.toContain('cmd:create-order <- evt:order#evt:order#created');
  });

  it('updates suggestions as dependency prefix changes', async () => {
    const doc = `slice "Orders"

evt:order-created
evt:order-cancelled
cmd:create-order <- evt:order-c`;

    const host = document.createElement('div');
    document.body.appendChild(host);
    view = new EditorView({
      state: EditorState.create({
        doc,
        selection: { anchor: doc.length },
        extensions: [slicr()]
      }),
      parent: host
    });

    const source = getAutocompleteSource(view.state, doc.length);
    expect(source).toBeDefined();

    const initial = source ? await source(new CompletionContext(view.state, doc.length, true, view)) : null;
    const initialLabels = initial?.options.map((option) => option.label) ?? [];
    expect(initialLabels).toContain('evt:order-created');
    expect(initialLabels).toContain('evt:order-cancelled');

    view.dispatch({
      changes: { from: doc.length, to: doc.length, insert: 'a' }
    });
    const nextPos = doc.length + 1;
    const next = source ? await source(new CompletionContext(view.state, nextPos, true, view)) : null;
    const nextLabels = next?.options.map((option) => option.label) ?? [];

    expect(nextLabels).toEqual(['evt:order-cancelled']);
  });
});
