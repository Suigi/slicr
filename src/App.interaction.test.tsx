// @vitest-environment jsdom

import { StrictMode, act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import App from './App';
import { DEFAULT_DSL } from './defaultDsl';
import {
  DRAG_AND_DROP_FLAG_STORAGE_KEY,
  RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY
} from './domain/runtimeFlags';
import { SLICES_LAYOUT_STORAGE_KEY, SLICES_STORAGE_KEY } from './sliceLibrary';
import { hydrateSliceProjection } from './sliceEventStore';

let root: ReactDOM.Root | null = null;
let host: HTMLDivElement | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = undefined;
});

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

function renderAppStrict() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);
  act(() => {
    root?.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
}

function readStoredLibrary() {
  const indexRaw = localStorage.getItem('slicr.es.v1.index');
  if (!indexRaw) {
    return null;
  }
  const parsed = JSON.parse(indexRaw) as { sliceIds?: unknown };
  if (!parsed || !Array.isArray(parsed.sliceIds) || parsed.sliceIds.length === 0) {
    return null;
  }
  const sliceIds = parsed.sliceIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (sliceIds.length === 0) {
    return null;
  }
  const appStreamRaw = localStorage.getItem('slicr.es.v1.stream.app');
  const appEvents = appStreamRaw ? (JSON.parse(appStreamRaw) as Array<{ version?: number; payload?: { selectedSliceId?: string } }>) : [];
  const selectedEvents = appEvents
    .filter((event): event is { version: number; payload: { selectedSliceId: string } } => (
      typeof event.version === 'number'
      && typeof event.payload?.selectedSliceId === 'string'
      && event.payload.selectedSliceId.length > 0
    ))
    .sort((a, b) => a.version - b.version);
  const selectedSliceId = selectedEvents[selectedEvents.length - 1]?.payload.selectedSliceId ?? sliceIds[0];
  return {
    selectedSliceId,
    slices: sliceIds.map((id) => ({ id, dsl: hydrateSliceProjection(id).dsl }))
  };
}

function openSliceMenu() {
  if (document.querySelector('.slice-menu-panel')) {
    return;
  }
  const menuToggle = document.querySelector('button[aria-label="Select slice"]') as HTMLButtonElement | null;
  expect(menuToggle).not.toBeNull();
  act(() => {
    menuToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function clickSliceMenuItem(label: string) {
  const item = [...document.querySelectorAll('.slice-menu-item')]
    .find((button) => button.textContent?.includes(label)) as HTMLButtonElement | undefined;
  expect(item).toBeDefined();
  act(() => {
    item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('App interactions', () => {
  it('loads default DSL when storage is empty and persists it', () => {
    renderApp();

    const sliceTitle = document.querySelector('.slice-title');
    const defaultName = DEFAULT_DSL.match(/^\s*slice\s+"([^"]+)"/m)?.[1];

    expect(sliceTitle?.textContent).toBe(defaultName);
    expect(document.title).toBe(`Slicer - ${defaultName}`);
    expect(localStorage.getItem('slicr.es.v1.index')).not.toBeNull();
    expect(localStorage.getItem('slicr.dsl')).toBeNull();
    const stored = readStoredLibrary();
    expect(stored?.slices[0]?.dsl).toBe(DEFAULT_DSL);
  });

  it('loads legacy DSL from localStorage on first render', () => {
    const persistedDsl = `slice "Persisted Slice"

rm:persisted-view`;
    localStorage.setItem('slicr.dsl', persistedDsl);

    renderApp();

    const sliceTitle = document.querySelector('.slice-title');
    expect(sliceTitle?.textContent).toBe('Persisted Slice');
  });

  it('switches between saved slices via header dropdown', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          { id: 'a', name: 'Alpha', dsl: 'slice "Alpha"\n\nrm:alpha' },
          { id: 'b', name: 'Beta', dsl: 'slice "Beta"\n\nrm:beta' }
        ]
      })
    );

    renderApp();

    openSliceMenu();
    expect(document.querySelectorAll('.slice-menu-item').length).toBe(2);
    expect(document.querySelector('.slice-title')?.textContent).toBe('Alpha');

    clickSliceMenuItem('Beta');

    expect(document.querySelector('.slice-title')?.textContent).toBe('Beta');
    expect(document.title).toBe('Slicer - Beta');
    const streamRaw = localStorage.getItem('slicr.es.v1.stream.app');
    expect(streamRaw).not.toBeNull();
    const events = JSON.parse(streamRaw ?? '[]') as Array<{ type: string; payload?: { selectedSliceId?: string } }>;
    expect(events.some((event) => event.type === 'slice-selected' && event.payload?.selectedSliceId === 'b')).toBe(true);
  });

  it('derives dropdown labels from DSL, ignoring stale stored names', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', name: 'Stale Name', dsl: 'slice "Fresh Name"\n\nrm:fresh' }]
      })
    );

    renderApp();

    const menuToggle = document.querySelector('button[aria-label="Select slice"]') as HTMLButtonElement | null;
    expect(menuToggle?.textContent).toContain('Fresh Name');
  });

  it('creates and selects a new slice from header button', () => {
    renderApp();

    const newButton = document.querySelector('button[aria-label="Create new slice"]') as HTMLButtonElement | null;
    expect(newButton).not.toBeNull();
    openSliceMenu();
    expect(document.querySelectorAll('.slice-menu-item').length).toBe(1);

    act(() => {
      newButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const menuToggle = document.querySelector('button[aria-label="Select slice"]') as HTMLButtonElement | null;
    expect(menuToggle?.textContent).toContain('Untitled');
    openSliceMenu();
    expect(document.querySelectorAll('.slice-menu-item').length).toBe(2);
    const stored = readStoredLibrary();
    expect(stored).not.toBeNull();
    const selected = stored?.slices.find((slice) => slice.id === stored.selectedSliceId);
    expect(selected?.dsl).toContain('slice "Untitled"');
    const streamRaw = localStorage.getItem(`slicr.es.v1.stream.${stored?.selectedSliceId ?? ''}`);
    expect(streamRaw).not.toBeNull();
    const events = JSON.parse(streamRaw ?? '[]') as Array<{ type: string }>;
    expect(events.some((event) => event.type === 'slice-created')).toBe(true);
    expect(events.some((event) => event.type === 'text-edited')).toBe(false);
  });

  it('opens and closes the editor panel via toggle and outside click', () => {
    renderApp();

    const toggle = document.querySelector('button[aria-label="Toggle DSL editor"]');
    const panel = document.querySelector('.editor-panel');

    expect(toggle).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(panel?.classList.contains('open')).toBe(false);

    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(panel?.classList.contains('open')).toBe(true);

    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(panel?.classList.contains('open')).toBe(false);
  });

  it('keeps the panel open when pointerdown happens inside the editor', () => {
    renderApp();

    const toggle = document.querySelector('button[aria-label="Toggle DSL editor"]');
    const panel = document.querySelector('.editor-panel');
    const editor = document.querySelector('.dsl-editor');

    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(panel?.classList.contains('open')).toBe(true);

    act(() => {
      editor?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(panel?.classList.contains('open')).toBe(true);
  });

  it('toggles the documentation panel from the header', () => {
    renderApp();

    const docsToggle = document.querySelector('button[aria-label="Toggle documentation panel"]');
    expect(docsToggle).not.toBeNull();
    expect(document.querySelector('.docs-panel-shell')).toBeNull();

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const docsShell = document.querySelector('.docs-panel-shell');
    expect(document.querySelector('.docs-panel')).not.toBeNull();
    expect(docsShell?.classList.contains('hidden')).toBe(false);
    expect(document.querySelectorAll('.doc-feature-card').length).toBeGreaterThan(0);
    expect(document.querySelector('.docs-panel')).not.toBeNull();
    expect(document.querySelector('.canvas-panel')).not.toBeNull();
    expect(document.querySelector('.canvas-panel')?.classList.contains('hidden')).toBe(true);
  });

  it('preserves canvas scroll position when opening and closing documentation panel', () => {
    renderApp();

    const docsToggle = document.querySelector('button[aria-label="Toggle documentation panel"]');
    const canvasPanel = document.querySelector('.canvas-panel') as HTMLDivElement | null;
    expect(docsToggle).not.toBeNull();
    expect(canvasPanel).not.toBeNull();

    act(() => {
      if (canvasPanel) {
        canvasPanel.scrollLeft = 260;
        canvasPanel.scrollTop = 140;
      }
    });

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(canvasPanel?.classList.contains('hidden')).toBe(true);

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(canvasPanel?.classList.contains('hidden')).toBe(false);
    expect(canvasPanel?.scrollLeft).toBe(260);
    expect(canvasPanel?.scrollTop).toBe(140);
  });

  it('preserves documentation scroll position when closing and reopening documentation panel', () => {
    renderApp();

    const docsToggle = document.querySelector('button[aria-label="Toggle documentation panel"]');
    expect(docsToggle).not.toBeNull();
    expect(document.querySelector('.docs-panel')).toBeNull();

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const docsPanel = document.querySelector('.docs-panel') as HTMLDivElement | null;
    const docsShell = document.querySelector('.docs-panel-shell');
    expect(docsPanel).not.toBeNull();
    expect(docsShell?.classList.contains('hidden')).toBe(false);

    act(() => {
      if (docsPanel) {
        docsPanel.scrollTop = 220;
      }
    });

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(docsShell?.classList.contains('hidden')).toBe(true);

    act(() => {
      docsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(docsShell?.classList.contains('hidden')).toBe(false);
    expect(docsPanel?.scrollTop).toBe(220);
  });

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

  it('applies mapped styling only to fields coming from uses', () => {
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

    const allFields = [...document.querySelectorAll('.node-field')];
    const mapped = allFields.filter((field) => field.classList.contains('mapped'));
    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.textContent).toContain('alpha:');
    expect(mapped[0]?.textContent).not.toContain('local:');
  });

  it('does not crash when warnings arrive out of order while typing malformed uses/data blocks', () => {
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

    expect(document.querySelector('.slice-title')?.textContent).toBe('Read Model from Two Events');
    expect(document.querySelector('#canvas')).not.toBeNull();
  });

  it('renders node aliases as display names in the canvas', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Aliases"\n\nrm:my-rm "My Read Model"\nui:my-ui "My UI"\n  <- rm:my-rm' }]
      })
    );

    renderApp();

    const labels = [...document.querySelectorAll('.node .node-header span:last-child')]
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    expect(labels).toContain('My Read Model');
    expect(labels).toContain('My UI');
  });

  it('renders generic nodes without a type prefix and with generic styling class', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Generic"\n\ncheckout-screen\ncmd:place-order <- checkout-screen' }]
      })
    );

    renderApp();

    const genericNode = document.querySelector('.node.generic');
    expect(genericNode).not.toBeNull();
    expect(genericNode?.querySelector('.node-prefix')).toBeNull();
    expect(genericNode?.querySelector('.node-header span:last-child')?.textContent?.trim()).toBe('checkout-screen');
  });

  it('shows a Cross-Slice Usage section when a node is selected', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          { id: 'a', dsl: 'slice "Alpha"\n\ncmd:buy "Buy"\n' },
          { id: 'b', dsl: 'slice "Beta"\n\ncmd:buy "Buy Again"\n' }
        ]
      })
    );

    renderApp();

    const node = document.querySelector('.node.cmd') as HTMLElement | null;
    expect(node).not.toBeNull();
    act(() => {
      node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const usageTab = [...document.querySelectorAll('.cross-slice-panel-tab')]
      .find((el) => el.textContent?.trim() === 'Cross-Slice Usage');
    expect(usageTab).toBeDefined();
    expect(document.querySelectorAll('.cross-slice-usage-item').length).toBe(2);
  });

  it('jumps to the selected cross-slice usage target', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          { id: 'a', dsl: 'slice "Alpha"\n\ncmd:buy "Buy"\n' },
          { id: 'b', dsl: 'slice "Beta"\n\ncmd:buy "Buy Again"\n' }
        ]
      })
    );

    renderApp();

    const sourceNode = document.querySelector('.node.cmd') as HTMLElement | null;
    expect(sourceNode).not.toBeNull();
    act(() => {
      sourceNode?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const jumpButton = document.querySelector('button.cross-slice-usage-item[data-slice-id="b"]') as HTMLButtonElement | null;
    expect(jumpButton).not.toBeNull();
    act(() => {
      jumpButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.slice-title')?.textContent?.trim()).toBe('Beta');
    expect(document.querySelector('.node.selected .node-title')?.textContent?.trim()).toBe('Buy Again');
  });

  it('shows selected node issues in the Issues tab', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          { id: 'a', dsl: 'slice "Alpha"\n\ncmd:buy "Buy"\nuses:\n  concertId\n' }
        ]
      })
    );

    renderApp();

    const sourceNode = document.querySelector('.node.cmd') as HTMLElement | null;
    expect(sourceNode).not.toBeNull();
    act(() => {
      sourceNode?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const issuesTab = [...document.querySelectorAll('.cross-slice-panel-tab')]
      .find((button) => button.textContent?.trim() === 'Issues') as HTMLButtonElement | undefined;
    expect(issuesTab).toBeDefined();
    act(() => {
      issuesTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const issueCode = document.querySelector('.cross-slice-issue-code');
    expect(issueCode?.textContent?.trim()).toBe('missing-source');
  });

  it('applies ambiguous-source quick fix by selecting an explicit predecessor', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          {
            id: 'a',
            dsl: 'slice "Alpha"\n\nevt:one "One"\ndata:\n  alpha: "one"\n\nevt:two "Two"\ndata:\n  alpha: "two"\n\ncmd:consume "Consume"\n<- evt:one\n<- evt:two\nuses:\n  alpha\n'
          }
        ]
      })
    );

    renderApp();

    const cmdNode = document.querySelector('.node.cmd') as HTMLElement | null;
    expect(cmdNode).not.toBeNull();
    act(() => {
      cmdNode?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const issuesTab = [...document.querySelectorAll('.cross-slice-panel-tab')]
      .find((button) => button.textContent?.trim() === 'Issues') as HTMLButtonElement | undefined;
    expect(issuesTab).toBeDefined();
    act(() => {
      issuesTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.cross-slice-issue-code')?.textContent?.trim()).toBe('ambiguous-source');
    const quickFix = [...document.querySelectorAll('.cross-slice-issue-fix')]
      .find((button) => button.textContent?.includes('Use one')) as HTMLButtonElement | undefined;
    expect(quickFix).toBeDefined();
    act(() => {
      quickFix?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.cross-slice-issue-code')).toBeNull();
  });

  it('opens command palette and runs Trace data action', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Alpha"\n\nevt:seed "Seed"\ndata:\n  alpha: "a"\n\ncmd:consume "Consume"\n<- evt:seed\nuses:\n  alpha\n' }]
      })
    );

    renderApp();
    const cmdNode = document.querySelector('.node.cmd') as HTMLElement | null;
    expect(cmdNode).not.toBeNull();
    act(() => {
      cmdNode?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const traceAction = [...document.querySelectorAll('.command-palette-item')]
      .find((button) => button.textContent?.trim() === 'Trace data') as HTMLButtonElement | undefined;
    expect(traceAction).toBeDefined();
    act(() => {
      traceAction?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.cross-slice-panel-tab.active')?.textContent?.trim()).toBe('Data Trace');
  });

  it('runs Show cross-slice usage command from the palette', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const usageAction = [...document.querySelectorAll('.command-palette-item')]
      .find((button) => button.textContent?.trim() === 'Show cross-slice usage') as HTMLButtonElement | undefined;
    expect(usageAction).toBeDefined();
    act(() => {
      usageAction?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.command-palette')).toBeNull();
  });

  it('runs trace with keyboard shortcut for selected nodes', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Alpha"\n\nevt:seed "Seed"\ndata:\n  alpha: "a"\n\ncmd:consume "Consume"\n<- evt:seed\nuses:\n  alpha\n' }]
      })
    );

    renderApp();
    const cmdNode = document.querySelector('.node.cmd') as HTMLElement | null;
    expect(cmdNode).not.toBeNull();
    act(() => {
      cmdNode?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', ctrlKey: true, shiftKey: true, bubbles: true }));
    });

    expect(document.querySelector('.cross-slice-panel-tab.active')?.textContent?.trim()).toBe('Data Trace');
    expect(document.querySelector('.cross-slice-trace-source')?.textContent).toContain('source: a');
  });

  it('shows intermediate data trace hops from inspected node to source', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          {
            id: 'a',
            dsl: 'slice "Alpha"\n\nevt:seed "Seed"\ndata:\n  alpha: "a"\n\nrm:view "View"\n<- evt:seed\nuses:\n  alpha\n\ncmd:consume "Consume"\n<- rm:view\nuses:\n  alpha\n'
          }
        ]
      })
    );

    renderApp();
    const cmdNode = document.querySelector('.node.cmd') as HTMLElement | null;
    expect(cmdNode).not.toBeNull();
    act(() => {
      cmdNode?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const traceTab = [...document.querySelectorAll('.cross-slice-panel-tab')]
      .find((button) => button.textContent?.trim() === 'Data Trace') as HTMLButtonElement | undefined;
    expect(traceTab).toBeDefined();
    act(() => {
      traceTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const hops = [...document.querySelectorAll('.cross-slice-trace-hop')].map((el) => el.textContent?.trim());
    expect(hops).toEqual(['view.alpha', 'seed.alpha']);
    expect(document.querySelectorAll('.cross-slice-trace-hop-node').length).toBe(2);
  });

  it('highlights trace-hop node when hovering over Data Trace list entry', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          {
            id: 'a',
            dsl: 'slice "Alpha"\n\nevt:seed "Seed"\ndata:\n  alpha: "a"\n\nrm:view "View"\n<- evt:seed\nuses:\n  alpha\n\ncmd:consume "Consume"\n<- rm:view\nuses:\n  alpha\n'
          }
        ]
      })
    );

    renderApp();
    const cmdNode = document.querySelector('.node.cmd') as HTMLElement | null;
    expect(cmdNode).not.toBeNull();
    act(() => {
      cmdNode?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const traceTab = [...document.querySelectorAll('.cross-slice-panel-tab')]
      .find((button) => button.textContent?.trim() === 'Data Trace') as HTMLButtonElement | undefined;
    expect(traceTab).toBeDefined();
    act(() => {
      traceTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const viewHop = [...document.querySelectorAll('.cross-slice-trace-hop')]
      .find((el) => el.textContent?.trim() === 'view.alpha') as HTMLElement | undefined;
    expect(viewHop).toBeDefined();
    const viewNode = [...document.querySelectorAll('.node.rm')]
      .find((el) => el.querySelector('.node-title')?.textContent?.trim() === 'View') as HTMLElement | undefined;
    expect(viewNode).toBeDefined();

    act(() => {
      viewHop?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    expect(viewNode?.classList.contains('trace-hovered')).toBe(true);
  });

  it('highlights both connected nodes when hovering an edge', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Edge Hover"\n\ncmd:start\n\nevt:finish <- cmd:start' }]
      })
    );

    renderApp();

    const fromNode = document.querySelector('.node.cmd');
    const toNode = document.querySelector('.node.evt');
    const edgePath = document.querySelector('.edge-hover-target');
    expect(fromNode).not.toBeNull();
    expect(toNode).not.toBeNull();
    expect(edgePath).not.toBeNull();
    expect(fromNode?.classList.contains('related')).toBe(false);
    expect(toNode?.classList.contains('related')).toBe(false);

    act(() => {
      edgePath?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    expect(fromNode?.classList.contains('related')).toBe(true);
    expect(toNode?.classList.contains('related')).toBe(true);

    act(() => {
      edgePath?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    });

    expect(fromNode?.classList.contains('related')).toBe(false);
    expect(toNode?.classList.contains('related')).toBe(false);
  });

  it('does not highlight related nodes when selecting a node', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Alpha"\n\ncmd:buy\n\nevt:seed <- cmd:buy' }]
      })
    );

    renderApp();
    const cmdNode = document.querySelector('.node.cmd') as HTMLElement | null;
    const evtNode = document.querySelector('.node.evt') as HTMLElement | null;
    expect(cmdNode).not.toBeNull();
    expect(evtNode).not.toBeNull();

    act(() => {
      cmdNode?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(cmdNode?.classList.contains('selected')).toBe(true);
    expect(evtNode?.classList.contains('related')).toBe(false);
  });

  it('renders a slice divider for --- boundaries in the DSL', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Split"\n\ncmd:first\n---\nevt:second <- cmd:first' }]
      })
    );

    renderApp();

    const divider = document.querySelector('.slice-divider');
    expect(divider).not.toBeNull();
  });

  it('keeps divider aligned with post-shift boundary floor in ELK mode (expected to fail before fix)', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: `slice "Harness"

cmd:buy "Buy Ticket"

evt:sold "Tickets Sold"
<- cmd:buy
stream: concert

evt:tp "Tickets Purchased" <- cmd:buy
stream: customer

---

rm:avail@2 "Available Concerts"
<- evt:sold

rm:wallet "Customer Wallet"
<- evt:tp`
        }]
      })
    );

    renderApp();

    const anchorNode = [...document.querySelectorAll('.node')]
      .find((node) => node.textContent?.includes('Tickets Purchased')) as HTMLElement | undefined;
    const divider = document.querySelector('.slice-divider') as HTMLElement | null;
    expect(anchorNode).toBeDefined();
    expect(divider).not.toBeNull();

    const anchorLeft = Number.parseFloat(anchorNode?.style.left ?? '0');
    const dividerLeft = Number.parseFloat(divider?.style.left ?? '0');

    // Divider should be centered in the boundary gap: anchor right edge + 40.
    expect(dividerLeft).toBe(anchorLeft + 180 + 40);
  });

  it('renders stream lane headers for event streams', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: 'slice "Streams"\n\nevt:first-event\nstream: first\n\nevt:second-event\nstream: second\n\nrm:read-model\n  <- evt:first-event\n  <- evt:second-event'
        }]
      })
    );

    renderApp();

    const laneLabels = [...document.querySelectorAll('.lane-stream-label')]
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    expect(laneLabels).toContain('first');
    expect(laneLabels).toContain('second');
  });

  it('does not render a header for the default event stream', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{
          id: 'a',
          dsl: 'slice "Streams"\n\nevt:first-event\nstream: first\n\nevt:default-event\n\nrm:read-model\n  <- evt:first-event\n  <- evt:default-event'
        }]
      })
    );

    renderApp();

    const laneLabels = [...document.querySelectorAll('.lane-stream-label')]
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    expect(laneLabels).toContain('first');
    expect(laneLabels).not.toContain('default');
  });

  it('toggles and persists light/dark theme from header button', () => {
    renderApp();

    const toggle = document.querySelector('button[aria-label="Switch to light theme"]');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(toggle).not.toBeNull();

    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('slicr.theme')).toBe('light');
    expect(document.querySelector('button[aria-label="Switch to dark theme"]')).not.toBeNull();
  });

  it('shows an Expand all action in the DSL toolbar', () => {
    renderApp();

    const expandAll = document.querySelector('button[aria-label="Expand all regions"]');
    expect(expandAll).not.toBeNull();
  });

  it('defaults render engine dropdown flag on and persists it on localhost', () => {
    renderApp();

    const menuToggle = document.querySelector('button[aria-label="Select render mode"]');
    expect(menuToggle).not.toBeNull();
    expect(localStorage.getItem(RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY)).toBe('true');
  });

  it('hides render engine dropdown when persisted flag is disabled', () => {
    localStorage.setItem(RENDER_ENGINE_DROPDOWN_FLAG_STORAGE_KEY, 'false');

    renderApp();

    const menuToggle = document.querySelector('button[aria-label="Select render mode"]');
    expect(menuToggle).toBeNull();
  });

  it('restores saved manual node positions for the selected slice on render', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\nevt:simple-event' }]
      })
    );
    localStorage.setItem(
      SLICES_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        a: {
          nodes: { 'simple-event': { x: 315, y: 265 } },
          edges: {}
        }
      })
    );

    renderApp();

    const eventNode = document.querySelector('.node.evt') as HTMLElement | null;
    expect(eventNode).not.toBeNull();
    expect(eventNode?.style.left).toBe('315px');
    expect(eventNode?.style.top).toBe('265px');
  });

  it('loads saved manual node positions when switching slices', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          { id: 'a', dsl: 'slice "A"\n\nevt:simple-event' },
          { id: 'b', dsl: 'slice "B"\n\nevt:simple-event' }
        ]
      })
    );
    localStorage.setItem(
      SLICES_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        a: {
          nodes: { 'simple-event': { x: 115, y: 95 } },
          edges: {}
        },
        b: {
          nodes: { 'simple-event': { x: 445, y: 355 } },
          edges: {}
        }
      })
    );

    renderApp();

    const eventNodeBefore = document.querySelector('.node.evt') as HTMLElement | null;
    expect(eventNodeBefore?.style.left).toBe('115px');
    expect(eventNodeBefore?.style.top).toBe('95px');

    openSliceMenu();
    clickSliceMenuItem('B');

    const eventNodeAfter = document.querySelector('.node.evt') as HTMLElement | null;
    expect(eventNodeAfter?.style.left).toBe('445px');
    expect(eventNodeAfter?.style.top).toBe('355px');
  });

  it('does not wipe saved geometry on StrictMode refresh', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\nevt:simple-event' }]
      })
    );
    localStorage.setItem(
      SLICES_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        a: {
          nodes: { 'simple-event': { x: 315, y: 265 } },
          edges: {}
        }
      })
    );

    renderAppStrict();

    const eventNode = document.querySelector('.node.evt') as HTMLElement | null;
    expect(eventNode?.style.left).toBe('315px');
    expect(eventNode?.style.top).toBe('265px');
    expect(localStorage.getItem(SLICES_LAYOUT_STORAGE_KEY)).toContain('"simple-event"');
  });

  it('appends node-moved events on drag end', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\nevt:simple-event' }]
      })
    );

    renderApp();

    const node = document.querySelector('.node.evt') as HTMLElement | null;
    expect(node).not.toBeNull();

    const beforeRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const beforeEvents = beforeRaw ? (JSON.parse(beforeRaw) as Array<{ type: string }>) : [];
    const beforeNodeMoveCount = beforeEvents.filter((event) => event.type === 'node-moved').length;

    const PointerCtor = window.PointerEvent ?? window.MouseEvent;
    act(() => {
      node?.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100, pointerId: 1 }));
      window.dispatchEvent(new PointerCtor('pointermove', { bubbles: true, buttons: 1, clientX: 180, clientY: 180, pointerId: 1 }));
    });

    const midRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const midEvents = midRaw ? (JSON.parse(midRaw) as Array<{ type: string }>) : [];
    const midNodeMoveCount = midEvents.filter((event) => event.type === 'node-moved').length;
    expect(midNodeMoveCount).toBe(beforeNodeMoveCount);

    act(() => {
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, button: 0, clientX: 180, clientY: 180, pointerId: 1 }));
    });

    const afterRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const afterEvents = afterRaw ? (JSON.parse(afterRaw) as Array<{ type: string }>) : [];
    const afterNodeMoveCount = afterEvents.filter((event) => event.type === 'node-moved').length;
    expect(afterNodeMoveCount).toBe(beforeNodeMoveCount + 1);
  });

  it('does not drag nodes when drag-and-drop flag is disabled', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\nevt:simple-event' }]
      })
    );
    localStorage.setItem(DRAG_AND_DROP_FLAG_STORAGE_KEY, 'false');

    renderApp();

    const node = document.querySelector('.node.evt') as HTMLElement | null;
    expect(node).not.toBeNull();

    const beforeRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const beforeEvents = beforeRaw ? (JSON.parse(beforeRaw) as Array<{ type: string }>) : [];
    const beforeNodeMoveCount = beforeEvents.filter((event) => event.type === 'node-moved').length;

    const PointerCtor = window.PointerEvent ?? window.MouseEvent;
    act(() => {
      node?.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100, pointerId: 1 }));
      window.dispatchEvent(new PointerCtor('pointermove', { bubbles: true, buttons: 1, clientX: 180, clientY: 180, pointerId: 1 }));
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, button: 0, clientX: 180, clientY: 180, pointerId: 1 }));
    });

    const afterRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const afterEvents = afterRaw ? (JSON.parse(afterRaw) as Array<{ type: string }>) : [];
    const afterNodeMoveCount = afterEvents.filter((event) => event.type === 'node-moved').length;
    expect(afterNodeMoveCount).toBe(beforeNodeMoveCount);
  });

  it('still highlights editor lines when hovering nodes with drag-and-drop disabled', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\nevt:simple-event' }]
      })
    );
    localStorage.setItem(DRAG_AND_DROP_FLAG_STORAGE_KEY, 'false');

    renderApp();

    const node = document.querySelector('.node.evt') as HTMLElement | null;
    expect(node).not.toBeNull();
    expect(document.querySelector('.cm-node-highlight')).toBeNull();

    act(() => {
      node?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    expect(document.querySelector('.cm-node-highlight')).not.toBeNull();
  });

  it('appends layout-reset events when resetting positions from route menu', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\nevt:simple-event' }]
      })
    );

    renderApp();

    const menuToggle = document.querySelector('button[aria-label="Select render mode"]') as HTMLButtonElement | null;
    expect(menuToggle).not.toBeNull();

    const beforeRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const beforeEvents = beforeRaw ? (JSON.parse(beforeRaw) as Array<{ type: string }>) : [];
    const beforeResetCount = beforeEvents.filter((event) => event.type === 'layout-reset').length;

    act(() => {
      menuToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const resetButton = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Reset positions'));
    expect(resetButton).toBeDefined();

    act(() => {
      resetButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const afterRaw = localStorage.getItem('slicr.es.v1.stream.a');
    const afterEvents = afterRaw ? (JSON.parse(afterRaw) as Array<{ type: string }>) : [];
    const afterResetCount = afterEvents.filter((event) => event.type === 'layout-reset').length;
    expect(afterResetCount).toBe(beforeResetCount + 1);
  });
});
