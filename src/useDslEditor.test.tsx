// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { Dispatch, SetStateAction, useRef } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useDslEditor } from './useDslEditor';

type TestEditor = {
  state: {
    doc: {
      toString: () => string;
      length: number;
    };
  };
  dispatch: (spec: { changes?: { from: number; to: number; insert: string }; effects?: unknown }) => void;
  destroy: () => void;
  emitDocChanged: (nextDoc: string) => void;
};

type HarnessProps = {
  dsl: string;
  onDslChange: Dispatch<SetStateAction<string>>;
  warningRanges?: Array<{ from: number; to: number }>;
  createEditorView: (args: {
    parent: HTMLDivElement;
    doc: string;
    onDocChanged: (nextDoc: string) => void;
  }) => TestEditor;
};

function Harness(props: HarnessProps) {
  const editorMountRef = useRef<HTMLDivElement>(null);
  useDslEditor({
    dsl: props.dsl,
    onDslChange: props.onDslChange,
    warningRanges: props.warningRanges,
    editorMountRef,
    createEditorView: props.createEditorView
  });
  return <div ref={editorMountRef} />;
}

describe('useDslEditor', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  let root: ReactDOM.Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    host = null;
    document.body.innerHTML = '';
  });

  it('creates editor with initial DSL and syncs external DSL changes into editor', () => {
    const editorRef: { current: TestEditor | null } = { current: null };
    const onDslChange = vi.fn<Dispatch<SetStateAction<string>>>();
    const createEditorView = vi.fn(({ doc, onDocChanged }) => {
      let text = doc;
      editorRef.current = {
        state: {
          doc: {
            toString: () => text,
            get length() {
              return text.length;
            }
          }
        },
        dispatch: ({ changes }) => {
          if (changes) {
            text = changes.insert;
          }
        },
        destroy: () => undefined,
        emitDocChanged: (nextDoc: string) => {
          text = nextDoc;
          onDocChanged(nextDoc);
        }
      };
      return editorRef.current;
    });

    host = document.createElement('div');
    document.body.appendChild(host);
    root = ReactDOM.createRoot(host);

    act(() => {
      root?.render(<Harness dsl={'slice "A"'} onDslChange={onDslChange} createEditorView={createEditorView} />);
    });

    expect(createEditorView).toHaveBeenCalledTimes(1);
    expect(createEditorView.mock.calls[0][0].doc).toBe('slice "A"');
    expect(editorRef.current?.state.doc.toString()).toBe('slice "A"');

    act(() => {
      root?.render(<Harness dsl={'slice "B"'} onDslChange={onDslChange} createEditorView={createEditorView} />);
    });

    expect(createEditorView).toHaveBeenCalledTimes(1);
    expect(editorRef.current?.state.doc.toString()).toBe('slice "B"');
  });

  it('propagates editor doc changes back through setState-style callback', () => {
    const editorRef: { current: TestEditor | null } = { current: null };
    let dslValue = 'slice "Initial"';
    const onDslChange: Dispatch<SetStateAction<string>> = vi.fn((updater: SetStateAction<string>) => {
      dslValue = typeof updater === 'function' ? updater(dslValue) : updater;
    });

    const createEditorView = vi.fn(({ doc, onDocChanged }) => {
      let text = doc;
      editorRef.current = {
        state: {
          doc: {
            toString: () => text,
            get length() {
              return text.length;
            }
          }
        },
        dispatch: ({ changes }) => {
          if (changes) {
            text = changes.insert;
          }
        },
        destroy: () => undefined,
        emitDocChanged: (nextDoc: string) => {
          text = nextDoc;
          onDocChanged(nextDoc);
        }
      };
      return editorRef.current;
    });

    host = document.createElement('div');
    document.body.appendChild(host);
    root = ReactDOM.createRoot(host);

    act(() => {
      root?.render(<Harness dsl={dslValue} onDslChange={onDslChange} createEditorView={createEditorView} />);
    });

    act(() => {
      editorRef.current?.emitDocChanged('slice "Updated"');
    });

    expect(vi.mocked(onDslChange)).toHaveBeenCalledTimes(1);
    expect(dslValue).toBe('slice "Updated"');
  });

  it('does not recreate editor when onDslChange callback identity changes', () => {
    const editorRef: { current: TestEditor | null } = { current: null };
    const createEditorView = vi.fn(({ doc }) => {
      let text = doc;
      editorRef.current = {
        state: {
          doc: {
            toString: () => text,
            get length() {
              return text.length;
            }
          }
        },
        dispatch: ({ changes }) => {
          if (changes) {
            text = changes.insert;
          }
        },
        destroy: () => undefined,
        emitDocChanged: () => undefined
      };
      return editorRef.current;
    });

    host = document.createElement('div');
    document.body.appendChild(host);
    root = ReactDOM.createRoot(host);

    const onDslChangeA: Dispatch<SetStateAction<string>> = () => undefined;
    const onDslChangeB: Dispatch<SetStateAction<string>> = () => undefined;

    act(() => {
      root?.render(<Harness dsl={'slice "A"'} onDslChange={onDslChangeA} createEditorView={createEditorView} />);
    });

    act(() => {
      editorRef.current?.dispatch({ changes: { from: 0, to: editorRef.current.state.doc.length, insert: 'slice "Edited"' } });
    });

    act(() => {
      root?.render(<Harness dsl={'slice "Edited"'} onDslChange={onDslChangeB} createEditorView={createEditorView} />);
    });

    expect(createEditorView).toHaveBeenCalledTimes(1);
    expect(editorRef.current?.state.doc.toString()).toBe('slice "Edited"');
  });

  it('does not recreate editor when warning ranges change', () => {
    const editorRef: { current: TestEditor | null } = { current: null };
    const onDslChange: Dispatch<SetStateAction<string>> = () => undefined;
    const createEditorView = vi.fn(({ doc }) => {
      let text = doc;
      editorRef.current = {
        state: {
          doc: {
            toString: () => text,
            get length() {
              return text.length;
            }
          }
        },
        dispatch: ({ changes }) => {
          if (changes) {
            text = changes.insert;
          }
        },
        destroy: () => undefined,
        emitDocChanged: () => undefined
      };
      return editorRef.current;
    });

    host = document.createElement('div');
    document.body.appendChild(host);
    root = ReactDOM.createRoot(host);

    act(() => {
      root?.render(
        <Harness
          dsl={'slice "A"'}
          onDslChange={onDslChange}
          warningRanges={[{ from: 0, to: 1 }]}
          createEditorView={createEditorView}
        />
      );
    });

    act(() => {
      editorRef.current?.dispatch({ changes: { from: 0, to: editorRef.current.state.doc.length, insert: 'slice "Edited"' } });
    });

    act(() => {
      root?.render(
        <Harness
          dsl={'slice "A"'}
          onDslChange={onDslChange}
          warningRanges={[{ from: 2, to: 3 }]}
          createEditorView={createEditorView}
        />
      );
    });

    expect(createEditorView).toHaveBeenCalledTimes(1);
    expect(editorRef.current?.state.doc.toString()).toBe('slice "Edited"');
  });
});
