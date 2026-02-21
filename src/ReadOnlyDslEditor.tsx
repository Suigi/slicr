import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { slicr } from './slicrLanguage';

export function ReadOnlyDslEditor({
  value,
  className,
  copyAriaLabel
}: {
  value: string;
  className?: string;
  copyAriaLabel?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard may be unavailable in some environments.
    }
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const view = new EditorView({
      parent: mount,
      state: EditorState.create({
        doc: value,
        extensions: [slicr(), EditorState.readOnly.of(true), EditorView.editable.of(false)]
      })
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current === value) {
      return;
    }
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value }
    });
  }, [value]);

  return (
    <div className={className}>
      {copyAriaLabel && (
        <button type="button" className="doc-dsl-copy" aria-label={copyAriaLabel} onClick={copy}>
          Copy
        </button>
      )}
      <div ref={mountRef} />
    </div>
  );
}
