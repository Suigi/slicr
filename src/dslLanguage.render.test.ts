// @vitest-environment jsdom

import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { slicr } from './slicrLanguage';

const SIMPLE_DSL = `slice "Test Slice"

ui:the-screen@2 <- rm:the-read-model@1, evt:the-event
  data: {"screen": "main"}
cmd:the-command <- ui:the-screen@2
evt:the-event <- cmd:the-command
rm:the-read-model@1
  uses:
    alpha`;

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
        extensions: [slicr(), EditorView.lineWrapping]
      }),
      parent: host
    });

    const content = host.querySelector('.cm-content');
    expect(content).not.toBeNull();
    expect(content?.textContent).toContain('cmd:the-command');
    expect(content?.textContent).toContain('evt:the-event <- cmd:the-command');
    expect(content?.textContent).toContain('rm:the-read-model@1');
    expect(content?.textContent).toContain('uses:');
    expect(content?.textContent).toContain('ui:the-screen@2 <- rm:the-read-model@1, evt:the-event');
    expect(content?.textContent).toContain('"screen": "main"');

    const highlightedSpans = content?.querySelectorAll('span[class*="dsl-tok-"]');
    expect(highlightedSpans && highlightedSpans.length).toBeGreaterThan(0);

    const uiTypeToken = content?.querySelectorAll('.dsl-tok-uiType')[0];
    const cmdTypeToken = content?.querySelectorAll('.dsl-tok-cmdType')[0];
    const evtTypeToken = content?.querySelectorAll('.dsl-tok-evtType')[0];
    const rmTypeToken = content?.querySelectorAll('.dsl-tok-rmType')[0];

    const uiNameToken = content?.querySelectorAll('.dsl-tok-uiName')[0];
    const cmdNameToken = content?.querySelectorAll('.dsl-tok-cmdName')[0];
    const evtNameToken = content?.querySelectorAll('.dsl-tok-evtName')[0];
    const rmNameToken = content?.querySelectorAll('.dsl-tok-rmName')[0];

    const stringToken = content?.querySelector('.dsl-tok-string');
    const operatorToken = content?.querySelector('.dsl-tok-operator');
    const punctuationTokens = [...(content?.querySelectorAll('.dsl-tok-punctuation') ?? [])];
    const keywordTokens = [...(content?.querySelectorAll('.dsl-tok-keyword') ?? [])];

    expect(uiTypeToken?.textContent?.trim()).toBe('ui');
    expect(cmdTypeToken?.textContent?.trim()).toBe('cmd');
    expect(evtTypeToken?.textContent?.trim()).toBe('evt');
    expect(rmTypeToken?.textContent?.trim()).toBe('rm');

    expect(uiNameToken?.textContent?.trim()).toBe('the-screen');
    expect(cmdNameToken?.textContent?.trim()).toBe('the-command');
    expect(evtNameToken?.textContent?.trim()).toBe('the-event');
    expect(rmNameToken?.textContent?.trim()).toBe('the-read-model');

    expect(stringToken?.textContent?.trim()).toBe('"Test Slice"');
    expect(operatorToken?.textContent?.trim()).toBe('<-');
    expect(punctuationTokens.some((token) => token.textContent?.trim() === '@')).toBe(true);
    expect(keywordTokens.some((token) => token.textContent?.trim() === 'uses')).toBe(true);
  });
});
