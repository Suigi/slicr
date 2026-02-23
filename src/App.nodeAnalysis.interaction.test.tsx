// @vitest-environment jsdom

import { StrictMode, act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import App from './App';
import { SLICES_STORAGE_KEY } from './sliceLibrary';
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

describe('App node analysis interactions', () => {
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

  it('orders node panel tabs with Cross-Slice Data after Cross-Slice Usage', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Alpha"\n\ncmd:buy "Buy"\n' }]
      })
    );

    renderApp();
    const node = document.querySelector('.node.cmd') as HTMLElement | null;
    expect(node).not.toBeNull();
    act(() => {
      node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const labels = [...document.querySelectorAll('.cross-slice-panel-tab')]
      .map((el) => el.textContent?.trim());
    expect(labels).toEqual(['Cross-Slice Usage', 'Cross-Slice Data', 'Issues', 'Data Trace']);
  });

  it('shows Cross-Slice Data keys as collapsed sections sorted alphabetically', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          { id: 'a', dsl: 'slice "A"\n\ncmd:buy\ndata:\n  beta: 2\n  alpha: 1\n' },
          { id: 'b', dsl: 'slice "B"\n\ncmd:buy\ndata:\n  gamma: 3\n' }
        ]
      })
    );

    renderApp();
    const node = document.querySelector('.node.cmd') as HTMLElement | null;
    expect(node).not.toBeNull();
    act(() => {
      node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const dataTab = [...document.querySelectorAll('.cross-slice-panel-tab')]
      .find((el) => el.textContent?.trim() === 'Cross-Slice Data') as HTMLButtonElement | undefined;
    expect(dataTab).toBeDefined();
    act(() => {
      dataTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const keyButtons = [...document.querySelectorAll('.cross-slice-data-key-toggle')];
    expect(keyButtons.map((el) => el.textContent?.trim())).toEqual(['alpha', 'beta', 'gamma']);
    expect(keyButtons.every((el) => el.getAttribute('aria-expanded') === 'false')).toBe(true);
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

  it('keeps React StrictMode rendering stable for node analysis panel toggles', () => {
    renderAppStrict();
    const stored = readStoredLibrary();
    expect(stored).not.toBeNull();
  });
});
