// @vitest-environment jsdom

import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {EditableProperty} from '@slicr/react-ui';
import {NodeEditor} from './NodeEditor';

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

function renderNodeEditor(properties: EditableProperty[], onChange = vi.fn()) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<NodeEditor properties={properties} onChange={onChange} />);
  });

  return {container, onChange};
}

function setInputValue(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = undefined;
  document.body.replaceChildren();
});

describe('NodeEditor', () => {
  it('preserves example values when schema edits rename a property', () => {
    const properties: EditableProperty[] = [
      {id: 'prop-title', name: 'title', type: 'string', example: 'Hello world'},
    ];
    const onChange = vi.fn();
    const {container} = renderNodeEditor(properties, onChange);
    const schemaNameInput = container.querySelector<HTMLInputElement>('.node-editor-schema input[value="title"]');

    expect(schemaNameInput).toBeDefined();

    setInputValue(schemaNameInput!, 'headline');

    expect(onChange).toHaveBeenCalledWith([
      {id: 'prop-title', name: 'headline', type: 'string', example: 'Hello world'},
    ]);
  });
});
