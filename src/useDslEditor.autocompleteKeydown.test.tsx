// @vitest-environment jsdom

import { completionStatus, startCompletion } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { Dispatch, SetStateAction, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { slicr } from './slicrLanguage';
import { EditorViewLike, useDslEditor } from './useDslEditor';

type HarnessProps = {
  dsl: string;
  onDslChange: Dispatch<SetStateAction<string>>;
  onViewCreated: (view: EditorView) => void;
};

function Harness(props: HarnessProps) {
  const editorMountRef = useRef<HTMLDivElement>(null);
  useDslEditor({
    dsl: props.dsl,
    onDslChange: props.onDslChange,
    editorMountRef,
    createEditorView: ({ parent, doc, onDocChanged }) => {
      const view = new EditorView({
        state: EditorState.create({
          doc,
          selection: { anchor: doc.length },
          extensions: [
            slicr(),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                onDocChanged(update.state.doc.toString());
              }
            })
          ]
        }),
        parent
      });
      props.onViewCreated(view);
      return view as unknown as EditorViewLike;
    }
  });

  return <div ref={editorMountRef} />;
}

describe('useDslEditor autocomplete key handling', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  let root: ReactDOM.Root | null = null;
  let host: HTMLDivElement | null = null;
  let editorView: EditorView | null = null;

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    host = null;
    editorView = null;
    document.body.innerHTML = '';
  });

  it('lets Enter accept autocomplete suggestions instead of inserting newline', async () => {
    const onDslChange: Dispatch<SetStateAction<string>> = () => undefined;
    const doc = `slice "Orders"

evt:order-created
cmd:create-order <- evt:order-cr`;

    host = document.createElement('div');
    document.body.appendChild(host);
    root = ReactDOM.createRoot(host);

    act(() => {
      root?.render(
        <Harness
          dsl={doc}
          onDslChange={onDslChange}
          onViewCreated={(view) => {
            editorView = view;
          }}
        />
      );
    });

    expect(editorView).not.toBeNull();
    if (!editorView) {
      return;
    }

    await act(async () => {
      editorView?.focus();
      startCompletion(editorView!);
      await Promise.resolve();
    });
    expect(completionStatus(editorView.state)).not.toBeNull();

    await act(async () => {
      editorView?.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    const text = editorView.state.doc.toString();
    expect(text).not.toContain('cmd:create-order <- evt:order-cr\n');
    expect(text).not.toContain('cmd:create-order <- \n');
  });

  it('lets Tab accept autocomplete suggestions instead of indenting', async () => {
    const onDslChange: Dispatch<SetStateAction<string>> = () => undefined;
    const doc = `slice "Orders"

evt:order-created
cmd:create-order <- evt:order-cr`;

    host = document.createElement('div');
    document.body.appendChild(host);
    root = ReactDOM.createRoot(host);

    act(() => {
      root?.render(
        <Harness
          dsl={doc}
          onDslChange={onDslChange}
          onViewCreated={(view) => {
            editorView = view;
          }}
        />
      );
    });

    expect(editorView).not.toBeNull();
    if (!editorView) {
      return;
    }

    await act(async () => {
      editorView?.focus();
      startCompletion(editorView!);
      await Promise.resolve();
    });
    expect(completionStatus(editorView.state)).not.toBeNull();

    await act(async () => {
      editorView?.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = editorView.state.doc.toString();
    expect(text).toContain('cmd:create-order <- evt:order-created');
    expect(text).not.toContain('cmd:create-order <- evt:order-cr  ');
  });
});
