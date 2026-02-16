// @vitest-environment jsdom

import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { dslHighlightDecorations } from './dslHighlightDecorations';

const SIMPLE_DSL = `slice "Test Slice"

  cmd:the-command
  -> evt:the-event
    -> rm:the-read-model`;

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.innerHTML = '';
});

describe('DSL language rendering', () => {
  it('renders highlighted token spans for a simple DSL snippet', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    view = new EditorView({
      state: EditorState.create({
        doc: SIMPLE_DSL,
        extensions: [dslHighlightDecorations, EditorView.lineWrapping]
      }),
      parent: host
    });

    const content = host.querySelector('.cm-content');
    expect(content).not.toBeNull();
    expect(content?.textContent).toContain('cmd:the-command');
    expect(content?.textContent).toContain('evt:the-event');
    expect(content?.textContent).toContain('rm:the-read-model');

    const highlightedSpans = content?.querySelectorAll('span[class*="dsl-tok-"]');
    expect(highlightedSpans && highlightedSpans.length).toBeGreaterThan(0);

    const cmdToken = content?.querySelector('.dsl-tok-cmdType');
    const evtToken = content?.querySelector('.dsl-tok-evtType');
    const rmToken = content?.querySelector('.dsl-tok-rmType');

    expect(cmdToken?.textContent?.trim()).toBe('cmd');
    expect(evtToken?.textContent?.trim()).toBe('evt');
    expect(rmToken?.textContent?.trim()).toBe('rm');
  });
});
