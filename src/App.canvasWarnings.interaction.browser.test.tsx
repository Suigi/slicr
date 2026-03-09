import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { SLICES_STORAGE_KEY } from './sliceLibrary';

let root: ReactDOM.Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root && host) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  host = null;
  document.body.innerHTML = '';
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

function renderApp() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);
  act(() => {
    root?.render(<App />);
  });
}

async function waitFor(condition: () => boolean, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    if (condition()) {
      return;
    }
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    });
  }
}

async function waitForSelector(selector: string) {
  await waitFor(() => document.querySelector(selector) !== null);
}

async function waitForSliceTitle(text: string) {
  await waitFor(() => document.querySelector('.slice-title')?.textContent?.trim() === text);
}

describe('App canvas warning interactions', () => {
  it('does not show unresolved dependency warnings in the bottom error bar', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Warnings"\n\nrm:orders <- evt:missing' }]
      })
    );

    renderApp();

    const errorBar = document.querySelector('.error-bar');
    expect(errorBar).toBeNull();
  });

  it('shows a red gutter cell for unresolved dependencies', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Warnings"\n\nrm:orders <- evt:missing' }]
      })
    );

    renderApp();

    const warningCell = document.querySelector('.cm-foldGutter .cm-gutterElement.cm-warning-line-error');
    expect(warningCell).not.toBeNull();
  });

  it('shows an orange gutter cell for data integrity warnings', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "Data Integrity"

ui:my-ui
data:
  alpha: value

cmd:my-cmd
<- ui:my-ui
data:
  alpha: value
  bravo: other-value`
        }]
      })
    );

    renderApp();

    const warningCell = document.querySelector('.cm-foldGutter .cm-gutterElement.cm-warning-line-warning');
    expect(warningCell).not.toBeNull();
  });

  it('renders missing mapped data values in red with <missing> marker', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "Mapped Missing"

ui:my-ui
data:
  alpha: value

cmd:my-cmd
<- ui:my-ui
uses:
  alpha
  bravo <- bravo`
        }]
      })
    );

    renderApp();

    const missingLine = document.querySelector('.node-field-line.missing');
    expect(missingLine).not.toBeNull();
    expect(missingLine?.querySelector('.node-field-key')?.textContent).toBe('bravo');
    expect(missingLine?.querySelector('.node-field-val')?.textContent?.trim()).toBe('<missing>');

    const mappedField = missingLine?.closest('.node-field');
    expect(mappedField?.classList.contains('mapped')).toBe(true);
  });

  it('applies mapped styling only to fields coming from uses', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "Mapped Styling"

ui:source
data:
  alpha: from-source

cmd:target
<- ui:source
data:
  local: from-data
uses:
  alpha`
        }]
      })
    );

    renderApp();
    await waitForSelector('.canvas-panel .node-field');

    const allFields = [...document.querySelectorAll('.canvas-panel .node-field')];
    const mapped = allFields.filter((field) => field.classList.contains('mapped'));
    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.textContent).toContain('alpha:');
    expect(mapped[0]?.textContent).not.toContain('local:');
  });

  it('tints ui data keys by mapping direction across predecessor and successor uses', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "UI Data Key Tints"

rm:todos "All Todos"
data:
  todos:
  - id: 101
    name: Old Todo Name

ui:rename-todo "Rename Todo Form"
<- rm:todos
data:
  newName: ALPHA
uses:
  id <- $.todos[0].id

cmd:rename-todo "Rename Todo"
<- ui:rename-todo
uses:
  newName`
        }]
      })
    );

    renderApp();

    const uiNode = [...document.querySelectorAll('.node.ui')]
      .find((node) => node.querySelector('.node-title')?.textContent?.includes('Rename Todo Form'));
    expect(uiNode).toBeDefined();

    const fields = [...(uiNode?.querySelectorAll('.node-field') ?? [])];
    const idField = fields.find((field) => field.textContent?.includes('id:'));
    const newNameField = fields.find((field) => field.textContent?.includes('newName:'));

    expect(idField?.classList.contains('ui-mapped-inbound')).toBe(true);
    expect(newNameField?.classList.contains('ui-mapped-outbound')).toBe(true);
  });

  it('marks ui keys as both when they are mapped in and mapped out', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "UI Data Gradient Tint"

rm:todos "All Todos"
data:
  todos:
  - id: 101
    name: Old Todo Name

ui:rename-todo "Rename Todo Form"
<- rm:todos
data:
  newName: ALPHA
uses:
  id <- $.todos[0].id

cmd:rename-todo "Rename Todo"
<- ui:rename-todo
uses:
  id
  newName`
        }]
      })
    );

    renderApp();

    const uiNode = [...document.querySelectorAll('.node.ui')]
      .find((node) => node.querySelector('.node-title')?.textContent?.includes('Rename Todo Form'));
    expect(uiNode).toBeDefined();

    const fields = [...(uiNode?.querySelectorAll('.node-field') ?? [])];
    const idField = fields.find((field) => field.textContent?.includes('id:'));

    expect(idField?.classList.contains('ui-mapped-both')).toBe(true);
  });

  it('renders node field values without a leading space after the colon', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "Trim Node Value"

ui:rename-todo "Rename Todo Form"
data:
  newName: ALPHA`
        }]
      })
    );

    renderApp();

    const value = document.querySelector('.node.ui .node-field-val');
    expect(value?.textContent).toBe('ALPHA');
  });

  it('renders node measure field values without a leading space after the colon', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "Trim Measure Value"

ui:rename-todo "Rename Todo Form"
data:
  newName: ALPHA`
        }]
      })
    );

    renderApp();

    const value = document.querySelector('.node-measure-layer .node-field-val');
    expect(value?.textContent).toBe('ALPHA');
  });

  it('does not render a node-field-val span for container header lines', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "Container Header Value Span"

ui:rename-todo "Rename Todo Form"
data:
  alpha: bravo
  todos:
    - id: 1
      name: todo 1`
        }]
      })
    );

    renderApp();

    const uiNode = document.querySelector('.node.ui');
    expect(uiNode).not.toBeNull();

    const lines = [...(uiNode?.querySelectorAll('.node-field-line') ?? [])];
    const todosLine = lines.find((line) => line.querySelector('.node-field-key')?.textContent === 'todos');
    expect(todosLine).toBeDefined();
    expect(todosLine?.querySelector('.node-field-val')).toBeNull();

    const alphaLine = lines.find((line) => line.querySelector('.node-field-key')?.textContent === 'alpha');
    expect(alphaLine).toBeDefined();
    expect(alphaLine?.querySelector('.node-field-val')?.textContent).toBe('bravo');
  });

  it('does not crash when warnings arrive out of order while typing malformed uses/data blocks', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "Read Model from Two Events"

evt:alpha-updated "Alpha Updated"
data:
  alpha: alpha-value

evt:bravo-updated "Bravo Updated"
data:
  bravo: bravo-value

rm:combined-view "Combined View"
<- evt:alpha-updated
<- evt:bravo-updated
d
uses:
  alpha
  bravo <- bravo
  charlie`
        }]
      })
    );

    renderApp();
    await waitForSliceTitle('Read Model from Two Events');

    expect(document.querySelector('.slice-title')?.textContent).toBe('Read Model from Two Events');
    expect(document.querySelector('#canvas')).not.toBeNull();
  });
});
