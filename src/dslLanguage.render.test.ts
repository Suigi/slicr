// @vitest-environment jsdom

import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { dslHighlightDecorations } from './dslHighlightDecorations';

const SIMPLE_DSL = `slice "Test Slice"

  ui:the-screen
  data: {"screen": "main"}
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
    expect(content?.textContent).toContain('ui:the-screen');
    expect(content?.textContent).toContain('"screen": "main"');

    const highlightedSpans = content?.querySelectorAll('span[class*="dsl-tok-"]');
    expect(highlightedSpans && highlightedSpans.length).toBeGreaterThan(0);

    const uiToken = content?.querySelector('.dsl-tok-uiType');
    const uiNameToken = content?.querySelector('.dsl-tok-uiName');
    const cmdToken = content?.querySelector('.dsl-tok-cmdType');
    const cmdNameToken = content?.querySelector('.dsl-tok-cmdName');
    const evtToken = content?.querySelector('.dsl-tok-evtType');
    const evtNameToken = content?.querySelector('.dsl-tok-evtName');
    const rmToken = content?.querySelector('.dsl-tok-rmType');
    const rmNameToken = content?.querySelector('.dsl-tok-rmName');
    const jsonKeyToken = content?.querySelector('.dsl-tok-jsonKey');
    const stringToken = content?.querySelector('.dsl-tok-string');

    expect(uiToken?.textContent?.trim()).toBe('ui');
    expect(uiNameToken?.textContent?.trim()).toBe('the-screen');
    expect(cmdToken?.textContent?.trim()).toBe('cmd');
    expect(cmdNameToken?.textContent?.trim()).toBe('the-command');
    expect(evtToken?.textContent?.trim()).toBe('evt');
    expect(evtNameToken?.textContent?.trim()).toBe('the-event');
    expect(rmToken?.textContent?.trim()).toBe('rm');
    expect(rmNameToken?.textContent?.trim()).toBe('the-read-model');
    expect(jsonKeyToken?.textContent?.trim()).toBe('"screen"');
    expect(stringToken?.textContent?.trim()).toBe('"Test Slice"');
  });
});
