import { StrictMode, act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { CROSS_SLICE_DATA_FLAG_STORAGE_KEY } from './domain/runtimeFlags';
import { SLICES_STORAGE_KEY } from './sliceLibrary';
import { hydrateSliceProjection } from './sliceEventStore';

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

async function renderAppAndWaitForNodes() {
  renderApp();
  await waitFor(() => document.querySelector('.main .node') !== null);
}

async function clickAndFlush(element: Element | null | undefined) {
  act(() => {
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function queryPanelTab(label: string) {
  return [...document.querySelectorAll('.cross-slice-panel-tab')]
    .find((button) => button.textContent?.trim() === label) as HTMLButtonElement | undefined;
}

async function waitForPanelTab(label: string) {
  await waitFor(() => queryPanelTab(label) !== undefined);
}

async function clickPanelTab(label: string) {
  await waitForPanelTab(label);
  const tab = queryPanelTab(label);
  expect(tab).toBeDefined();
  await clickAndFlush(tab);
}

function queryDataKey(label: string) {
  return [...document.querySelectorAll('.cross-slice-data-key-toggle')]
    .find((button) => button.textContent?.trim() === label) as HTMLButtonElement | undefined;
}

async function clickDataKey(label: string) {
  await waitFor(() => queryDataKey(label) !== undefined);
  const key = queryDataKey(label);
  expect(key).toBeDefined();
  await clickAndFlush(key);
}

function queryTraceKey(label: string) {
  return [...document.querySelectorAll('.cross-slice-trace-key-toggle')]
    .find((button) => button.textContent?.trim() === label) as HTMLButtonElement | undefined;
}

async function clickTraceKey(label: string) {
  await waitFor(() => queryTraceKey(label) !== undefined);
  const key = queryTraceKey(label);
  expect(key).toBeDefined();
  await clickAndFlush(key);
}

async function waitForSliceTitle(text: string) {
  await waitFor(() => document.querySelector('.slice-title')?.textContent?.trim() === text);
}

function queryMainNode(selector: string) {
  return document.querySelector(`.main ${selector}`);
}

function queryMainNodes(selector: string) {
  return [...document.querySelectorAll(`.main ${selector}`)];
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
  const appStreamRaw = localStorage.getItem('slicr.es.v1.stream.app');
  const appEvents = appStreamRaw
    ? (JSON.parse(appStreamRaw) as Array<{ version?: number; type?: string; payload?: { projectId?: string; sliceId?: string; selectedSliceId?: string } }>)
    : [];
  const added = appEvents
    .filter((event) => event.type === 'slice-added-to-project' && event.payload?.projectId === 'default' && typeof event.payload?.sliceId === 'string')
    .sort((a, b) => (a.version ?? 0) - (b.version ?? 0));
  const sliceIds = [...new Set(added.map((event) => event.payload?.sliceId as string))];
  if (sliceIds.length === 0) {
    return null;
  }
  const selectedEvents = appEvents
    .filter((event): event is { version: number; payload: { selectedSliceId: string } } => (
      event.type === 'slice-selected'
      && event.payload?.projectId === 'default'
      && typeof event.version === 'number'
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
  it('shows a Cross-Slice Usage section when a node is selected', async () => {
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

    await renderAppAndWaitForNodes();

    const node = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(node).not.toBeNull();
    await clickAndFlush(node);

    const usageTab = [...document.querySelectorAll('.cross-slice-panel-tab')]
      .find((el) => el.textContent?.trim() === 'Cross-Slice Usage');
    expect(usageTab).toBeDefined();
    expect(document.querySelectorAll('.cross-slice-usage-item').length).toBe(2);
    expect(document.querySelectorAll('.cross-slice-usage-item .node').length).toBe(2);
    expect(document.querySelector('.cross-slice-usage-item .node.cmd')).not.toBeNull();
    expect(document.querySelector('.cross-slice-usage-item .node .node-header')).not.toBeNull();
  });

  it('marks the usage card for the currently selected node as selected', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          { id: 'a', dsl: 'slice "Alpha"\n\ncmd:buy "Buy Here"\n' },
          { id: 'b', dsl: 'slice "Beta"\n\ncmd:buy "Buy There"\n' }
        ]
      })
    );

    await renderAppAndWaitForNodes();

    const node = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(node).not.toBeNull();
    await clickAndFlush(node);

    const selectedUsageNode = document.querySelector('.cross-slice-usage-item[data-slice-id="a"] .node') as HTMLElement | null;
    const otherUsageNode = document.querySelector('.cross-slice-usage-item[data-slice-id="b"] .node') as HTMLElement | null;
    expect(selectedUsageNode).not.toBeNull();
    expect(otherUsageNode).not.toBeNull();
    expect(selectedUsageNode?.classList.contains('selected')).toBe(true);
    expect(otherUsageNode?.classList.contains('selected')).toBe(false);
  });

  it('groups Cross-Slice Usage entries by slice', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          {
            id: 'a',
            dsl: 'slice "Alpha"\n\ncmd:buy@1 "Buy A1"\n\ncmd:buy@2 "Buy A2"\n'
          },
          {
            id: 'b',
            dsl: 'slice "Beta"\n\ncmd:buy@3 "Buy B1"\n'
          }
        ]
      })
    );

    await renderAppAndWaitForNodes();

    const node = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(node).not.toBeNull();
    await clickAndFlush(node);

    const groups = [...document.querySelectorAll('.cross-slice-usage-group')];
    expect(groups).toHaveLength(2);
    const groupTitles = groups.map((group) => group.querySelector('.cross-slice-usage-group-title')?.textContent?.trim());
    expect(groupTitles).toContain('Alpha (this Slice)');
    expect(groupTitles).toContain('Beta');

    expect(groups[0]?.querySelectorAll('.cross-slice-usage-group-frame')).toHaveLength(1);
    expect(groups[1]?.querySelectorAll('.cross-slice-usage-group-frame')).toHaveLength(1);
    const byTitle = new Map(groups.map((group) => [
      group.querySelector('.cross-slice-usage-group-title')?.textContent?.trim(),
      group
    ]));
    expect(byTitle.get('Alpha (this Slice)')?.querySelectorAll('.cross-slice-usage-item')).toHaveLength(2);
    expect(byTitle.get('Beta')?.querySelectorAll('.cross-slice-usage-item')).toHaveLength(1);
  });

  it('labels the currently opened slice group as This Slice', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          { id: 'a', dsl: 'slice "Alpha"\n\ncmd:buy@1 "Buy A1"\n' },
          { id: 'b', dsl: 'slice "Beta"\n\ncmd:buy@2 "Buy B1"\n' }
        ]
      })
    );

    await renderAppAndWaitForNodes();
    const node = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(node).not.toBeNull();
    await clickAndFlush(node);

    const groupTitles = [...document.querySelectorAll('.cross-slice-usage-group-title')]
      .map((el) => el.textContent?.trim());
    expect(groupTitles).toEqual(['Alpha (this Slice)', 'Beta'])
  });

  it('renders cross-slice usage header with colored type prefix and bold key', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "A"\n\ncmd:buy "Buy"\n' }]
      })
    );

    await renderAppAndWaitForNodes();
    const node = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(node).not.toBeNull();
    await clickAndFlush(node);

    const header = document.querySelector('.cross-slice-usage-node') as HTMLElement | null;
    expect(header).not.toBeNull();
    expect(document.querySelector('.cross-slice-panel-divider')).not.toBeNull();
    expect(header?.classList.contains('cmd')).toBe(true);
    expect(header?.querySelector('.cross-slice-usage-node-type')?.textContent?.trim()).toBe('cmd:');
    expect(header?.querySelector('.cross-slice-usage-node-key')?.textContent?.trim()).toBe('buy');
  });

  it('shows each node version as its own usage entry with alias', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          {
            id: 'a',
            dsl: 'slice "Aliases and Versions"\n\nrm:rooms@1 "Rooms (Version 1)"\n\nrm:rooms@2 "Rooms (Version 2)"\n'
          }
        ]
      })
    );

    await renderAppAndWaitForNodes();

    const roomsNode = queryMainNode('.node.rm') as HTMLElement | null;
    expect(roomsNode).not.toBeNull();
    await clickAndFlush(roomsNode);

    const usageItems = [...document.querySelectorAll('.cross-slice-usage-item')];
    expect(usageItems).toHaveLength(2);
    const usageTitles = usageItems
      .map((item) => item.querySelector('.node-title')?.textContent?.trim())
      .filter((title): title is string => Boolean(title));
    expect(usageTitles).toEqual(['Rooms (Version 1)', 'Rooms (Version 2)']);
  });

  it('orders node panel tabs with Cross-Slice Data after Cross-Slice Usage', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Alpha"\n\ncmd:buy "Buy"\n' }]
      })
    );

    await renderAppAndWaitForNodes();
    const node = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(node).not.toBeNull();
    await clickAndFlush(node);

    const labels = [...document.querySelectorAll('.cross-slice-panel-tab')]
      .map((el) => el.textContent?.trim());
    expect(labels).toEqual(['Cross-Slice Usage', 'Cross-Slice Data', 'Data Trace']);
  });

  it('hides Cross-Slice Data tab when feature flag is disabled', async () => {
    localStorage.setItem(CROSS_SLICE_DATA_FLAG_STORAGE_KEY, 'false');
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Alpha"\n\ncmd:buy "Buy"\n' }]
      })
    );

    await renderAppAndWaitForNodes();
    const node = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(node).not.toBeNull();
    await clickAndFlush(node);

    const labels = [...document.querySelectorAll('.cross-slice-panel-tab')]
      .map((el) => el.textContent?.trim());
    expect(labels).toEqual(['Cross-Slice Usage', 'Data Trace']);
  });

  it('renders the node analysis panel as vertically scrollable', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Alpha"\n\ncmd:buy "Buy"\n' }]
      })
    );

    await renderAppAndWaitForNodes();
    const node = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(node).not.toBeNull();
    await clickAndFlush(node);

    const panel = document.querySelector('.cross-slice-usage-panel') as HTMLElement | null;
    expect(panel).not.toBeNull();
    expect(panel?.style.overflowY).toBe('auto');
  });

  it('shows Cross-Slice Data keys as collapsed sections sorted alphabetically', async () => {
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

    await renderAppAndWaitForNodes();
    const node = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(node).not.toBeNull();
    await clickAndFlush(node);

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

  it('shows per-slice values when a Cross-Slice Data key is expanded', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          { id: 'a', dsl: 'slice "Alpha"\n\ncmd:buy\ndata:\n  alpha: 1\n' },
          { id: 'b', dsl: 'slice "Beta"\n\ncmd:buy\ndata:\n  alpha: 2\n' }
        ]
      })
    );

    await renderAppAndWaitForNodes();
    const node = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(node).not.toBeNull();
    await clickAndFlush(node);

    const dataTab = [...document.querySelectorAll('.cross-slice-panel-tab')]
      .find((el) => el.textContent?.trim() === 'Cross-Slice Data') as HTMLButtonElement | undefined;
    expect(dataTab).toBeDefined();
    act(() => {
      dataTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const alphaKey = [...document.querySelectorAll('.cross-slice-data-key-toggle')]
      .find((el) => el.textContent?.trim() === 'alpha') as HTMLButtonElement | undefined;
    expect(alphaKey).toBeDefined();
    act(() => {
      alphaKey?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const values = [...document.querySelectorAll('.cross-slice-data-value-item')]
      .map((el) => el.textContent?.trim());
    expect(values).toEqual(['Alpha: 1', 'Beta: 2']);
  });

  it('shows values only for the expanded key on the selected node ref', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          {
            id: 'a',
            dsl: 'slice "Alpha"\n\ncmd:buy\ndata:\n  alpha: 1\n\ncmd:sell\ndata:\n  alpha: 9\n'
          },
          {
            id: 'b',
            dsl: 'slice "Beta"\n\ncmd:buy\ndata:\n  alpha: 2\n\ncmd:sell\ndata:\n  alpha: 8\n'
          }
        ]
      })
    );

    await renderAppAndWaitForNodes();
    const buyNode = queryMainNodes('.node.cmd')
      .find((el) => el.querySelector('.node-title')?.textContent?.trim() === 'buy') as HTMLElement | undefined;
    expect(buyNode).toBeDefined();
    await clickAndFlush(buyNode);

    const dataTab = [...document.querySelectorAll('.cross-slice-panel-tab')]
      .find((el) => el.textContent?.trim() === 'Cross-Slice Data') as HTMLButtonElement | undefined;
    expect(dataTab).toBeDefined();
    act(() => {
      dataTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const alphaKey = [...document.querySelectorAll('.cross-slice-data-key-toggle')]
      .find((el) => el.textContent?.trim() === 'alpha') as HTMLButtonElement | undefined;
    expect(alphaKey).toBeDefined();
    act(() => {
      alphaKey?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const values = [...document.querySelectorAll('.cross-slice-data-value-item')]
      .map((el) => el.textContent?.trim());
    expect(values).toEqual(['Alpha: 1', 'Beta: 2']);
  });

  it('keeps Cross-Slice Data expansion state when selected node changes', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          {
            id: 'a',
            dsl: 'slice "Alpha"\n\ncmd:buy\ndata:\n  alpha: 1\n\ncmd:sell\ndata:\n  alpha: 2\n'
          }
        ]
      })
    );

    await renderAppAndWaitForNodes();
    const buyNode = queryMainNodes('.node.cmd')
      .find((el) => el.querySelector('.node-title')?.textContent?.trim() === 'buy') as HTMLElement | undefined;
    const sellNode = queryMainNodes('.node.cmd')
      .find((el) => el.querySelector('.node-title')?.textContent?.trim() === 'sell') as HTMLElement | undefined;
    expect(buyNode).toBeDefined();
    expect(sellNode).toBeDefined();

    await clickAndFlush(buyNode);
    await clickPanelTab('Cross-Slice Data');
    await clickDataKey('alpha');
    expect(queryDataKey('alpha')?.getAttribute('aria-expanded')).toBe('true');

    await clickAndFlush(sellNode);
    await clickPanelTab('Cross-Slice Data');

    const keyButtons = [...document.querySelectorAll('.cross-slice-data-key-toggle')];
    expect(keyButtons.map((el) => el.textContent?.trim())).toEqual(['alpha']);
    expect(keyButtons[0]?.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps the selected node panel tab when switching nodes', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          {
            id: 'a',
            dsl: 'slice "Alpha"\n\nevt:seed "Seed"\ndata:\n  alpha: "a"\n\ncmd:buy "Buy"\n<- evt:seed\nuses:\n  alpha\n\ncmd:sell "Sell"\n<- evt:seed\nuses:\n  alpha\n'
          }
        ]
      })
    );

    await renderAppAndWaitForNodes();
    const buyNode = queryMainNodes('.node.cmd')
      .find((el) => el.querySelector('.node-title')?.textContent?.trim() === 'Buy') as HTMLElement | undefined;
    const sellNode = queryMainNodes('.node.cmd')
      .find((el) => el.querySelector('.node-title')?.textContent?.trim() === 'Sell') as HTMLElement | undefined;
    expect(buyNode).toBeDefined();
    expect(sellNode).toBeDefined();

    await clickAndFlush(buyNode);
    await clickPanelTab('Data Trace');
    await clickAndFlush(sellNode);

    expect(document.querySelector('.cross-slice-panel-tab.active')?.textContent?.trim()).toBe('Data Trace');
  });

  it('renders collapsible key headers and value rows with expected classes', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          { id: 'a', dsl: 'slice "A"\n\ncmd:buy\ndata:\n  alpha: 1\n' }
        ]
      })
    );

    await renderAppAndWaitForNodes();
    const node = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(node).not.toBeNull();
    await clickAndFlush(node);
    await clickPanelTab('Cross-Slice Data');
    const keyHeader = document.querySelector('.cross-slice-data-key-toggle') as HTMLButtonElement | null;
    expect(keyHeader).not.toBeNull();
    expect(keyHeader?.querySelector('.cross-slice-data-key-toggle-icon path[d="M6 4 L6 8"]')).not.toBeNull();
    await clickAndFlush(keyHeader);
    expect(keyHeader?.querySelector('.cross-slice-data-key-toggle-icon path[d="M6 4 L6 8"]')).toBeNull();

    expect(document.querySelector('.cross-slice-data-key-section')).not.toBeNull();
    expect(document.querySelector('.cross-slice-data-value-item')).not.toBeNull();
  });

  it('jumps to the selected cross-slice usage target', async () => {
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

    await renderAppAndWaitForNodes();

    const sourceNode = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(sourceNode).not.toBeNull();
    await clickAndFlush(sourceNode);

    const jumpButton = document.querySelector('button.cross-slice-usage-item[data-slice-id="b"]') as HTMLButtonElement | null;
    expect(jumpButton).not.toBeNull();
    await clickAndFlush(jumpButton);

    await waitForSliceTitle('Beta');
    expect(document.querySelector('.slice-title')?.textContent?.trim()).toBe('Beta');
    expect(queryMainNode('.node.selected .node-title')?.textContent?.trim()).toBe('Buy Again');
  });

  it('shows missing source directly in Data Trace and marks tab/key as missing', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          { id: 'a', dsl: 'slice "Alpha"\n\ncmd:buy "Buy"\nuses:\n  concertId\n' }
        ]
      })
    );

    await renderAppAndWaitForNodes();

    const sourceNode = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(sourceNode).not.toBeNull();
    await clickAndFlush(sourceNode);
    await clickPanelTab('Data Trace');
    const traceTab = queryPanelTab('Data Trace');

    expect(traceTab?.classList.contains('has-missing-source')).toBe(true);
    const traceKey = document.querySelector('.cross-slice-trace-key-toggle') as HTMLButtonElement | null;
    expect(traceKey).not.toBeNull();
    await clickAndFlush(traceKey);
    expect(document.querySelector('.cross-slice-trace-key-section.missing-source')).not.toBeNull();
    expect(document.querySelector('.cross-slice-trace-issue-code')?.textContent?.trim()).toBe('missing-source');
    const hopRows = [...document.querySelectorAll('.cross-slice-trace-hops .cross-slice-trace-hop')]
      .map((el) => el.textContent?.trim());
    expect(hopRows[hopRows.length - 1]).toBe('missing-source');
    expect(document.querySelector('.cross-slice-trace-source.missing-source')).toBeNull();
  });

  it('shows trace keys only for the selected node version', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          {
            id: 'a',
            dsl: 'slice "Alpha"\n\ncmd:buy@1 "Buy One"\nuses:\n  alpha\n\ncmd:buy@2 "Buy Two"\nuses:\n  beta\n'
          }
        ]
      })
    );

    await renderAppAndWaitForNodes();

    const buyOneNode = queryMainNodes('.node.cmd')
      .find((el) => el.querySelector('.node-title')?.textContent?.trim() === 'Buy One') as HTMLElement | undefined;
    expect(buyOneNode).toBeDefined();
    await clickAndFlush(buyOneNode);

    expect(document.querySelector('.cross-slice-usage-node-key')?.textContent?.trim()).toBe('buy');

    await clickPanelTab('Data Trace');
    const traceTab = queryPanelTab('Data Trace');

    const traceKeys = [...document.querySelectorAll('.cross-slice-trace-key-toggle')]
      .map((button) => button.textContent?.trim());
    expect(traceKeys).toEqual(['alpha']);
    expect([...document.querySelectorAll('.cross-slice-trace-key-toggle')]
      .every((button) => button.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(traceTab?.classList.contains('has-missing-source')).toBe(true);
  });

  it('applies ambiguous-source quick fix from Data Trace', async () => {
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

    await renderAppAndWaitForNodes();

    const cmdNode = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(cmdNode).not.toBeNull();
    await clickAndFlush(cmdNode);
    await clickPanelTab('Data Trace');
    await clickTraceKey('alpha');

    expect(document.querySelector('.cross-slice-trace-issue-code')?.textContent?.trim()).toBe('ambiguous-source');
    const quickFix = [...document.querySelectorAll('.cross-slice-issue-fix')]
      .find((button) => button.textContent?.includes('Use one')) as HTMLButtonElement | undefined;
    expect(quickFix).toBeDefined();
    await clickAndFlush(quickFix);

    expect(document.querySelector('.cross-slice-trace-issue-code')).toBeNull();
  });

  it('does not list Trace Data or cross-slice usage commands in the palette', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const items = [...document.querySelectorAll('.command-palette-item')].map((button) => button.textContent?.trim() ?? '');
    expect(items.some((text) => text.toLowerCase().includes('trace data'))).toBe(false);
    expect(items.some((text) => text.toLowerCase().includes('cross-slice usage'))).toBe(false);
  });

  it('renders command palette rows with title and secondary context', () => {
    localStorage.setItem(
      'slicr.es.v1.stream.app',
      JSON.stringify([
        {
          id: 'p-1',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'project-created',
          payload: { projectId: 'project-a', name: 'Project A' }
        },
        {
          id: 'p-2',
          version: 2,
          at: '2026-01-01T00:00:02.000Z',
          type: 'project-created',
          payload: { projectId: 'project-b', name: 'Project B' }
        },
        {
          id: 'p-3',
          version: 3,
          at: '2026-01-01T00:00:03.000Z',
          type: 'project-selected',
          payload: { projectId: 'project-a' }
        }
      ])
    );

    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const firstTitle = document.querySelector('.command-palette-item-title');
    const firstMeta = document.querySelector('.command-palette-item-meta');
    expect(firstTitle).not.toBeNull();
    expect(firstMeta).not.toBeNull();
    expect(firstMeta?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it('opens Create Project dialog from command palette command', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const createProjectItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Create Project...')
    ) as HTMLButtonElement | undefined;
    expect(createProjectItem).toBeDefined();

    act(() => {
      createProjectItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.project-modal')).not.toBeNull();
  });

  it('opens Add Node dialog from command palette command', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const addNodeItem = (
      [...document.querySelectorAll('.command-palette-item')]
        .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Add Node...')
    ) as HTMLButtonElement | undefined;
    expect(addNodeItem).toBeDefined();

    act(() => {
      addNodeItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.add-node-dialog')).not.toBeNull();
  });

  it('closes command palette on Escape', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });
    expect(document.querySelector('.command-palette')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(document.querySelector('.command-palette')).toBeNull();
  });

  it('closes palette immediately when Escape is pressed right after Ctrl+K', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(document.querySelector('.command-palette')).toBeNull();
  });

  it('closes palette immediately when Escape keyup is pressed right after Cmd+K', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
    });
    const search = document.querySelector('.command-palette-search') as HTMLInputElement | null;
    expect(search).not.toBeNull();

    act(() => {
      search?.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    });

    expect(document.querySelector('.command-palette')).toBeNull();
  });

  it('closes command palette when the search input blurs', async () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });
    const search = document.querySelector('.command-palette-search') as HTMLInputElement | null;
    expect(search).not.toBeNull();

    act(() => {
      search?.blur();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.querySelector('.command-palette')).toBeNull();
  });

  it('switches project from command palette and scopes active slice', () => {
    localStorage.setItem(
      'slicr.es.v1.stream.app',
      JSON.stringify([
        {
          id: 'p-1',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'project-created',
          payload: { projectId: 'project-a', name: 'Project A' }
        },
        {
          id: 'p-2',
          version: 2,
          at: '2026-01-01T00:00:02.000Z',
          type: 'project-created',
          payload: { projectId: 'project-b', name: 'Project B' }
        },
        {
          id: 'p-3',
          version: 3,
          at: '2026-01-01T00:00:03.000Z',
          type: 'project-selected',
          payload: { projectId: 'project-a' }
        },
        {
          id: 'p-4',
          version: 4,
          at: '2026-01-01T00:00:04.000Z',
          type: 'slice-added-to-project',
          payload: { projectId: 'project-a', sliceId: 'slice-a' }
        },
        {
          id: 'p-5',
          version: 5,
          at: '2026-01-01T00:00:05.000Z',
          type: 'slice-added-to-project',
          payload: { projectId: 'project-b', sliceId: 'slice-b' }
        },
        {
          id: 'p-6',
          version: 6,
          at: '2026-01-01T00:00:06.000Z',
          type: 'slice-selected',
          payload: { projectId: 'project-a', selectedSliceId: 'slice-a' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a',
      JSON.stringify([
        {
          id: 'a-1',
          sliceId: 'slice-a',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Alpha A"\n\ncmd:buy "Buy A"' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-b',
      JSON.stringify([
        {
          id: 'b-1',
          sliceId: 'slice-b',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Beta B"\n\ncmd:buy "Buy B"' }
        }
      ])
    );

    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const switchProject = [...document.querySelectorAll('.command-palette-item')]
      .find((button) => button.querySelector('.command-palette-item-title')?.textContent?.trim() === 'Switch Project: Project B') as HTMLButtonElement | undefined;
    expect(switchProject).toBeDefined();
    act(() => {
      switchProject?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.slice-select-label')?.textContent).toContain('Beta B');
  });

  it('filters command palette actions by search text', () => {
    localStorage.setItem(
      'slicr.es.v1.stream.app',
      JSON.stringify([
        {
          id: 'p-1',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'project-created',
          payload: { projectId: 'project-a', name: 'Project A' }
        },
        {
          id: 'p-2',
          version: 2,
          at: '2026-01-01T00:00:02.000Z',
          type: 'project-created',
          payload: { projectId: 'project-b', name: 'Project B' }
        },
        {
          id: 'p-3',
          version: 3,
          at: '2026-01-01T00:00:03.000Z',
          type: 'project-created',
          payload: { projectId: 'project-c', name: 'Project C' }
        },
        {
          id: 'p-4',
          version: 4,
          at: '2026-01-01T00:00:04.000Z',
          type: 'project-selected',
          payload: { projectId: 'project-a' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a',
      JSON.stringify([
        {
          id: 'a-1',
          sliceId: 'slice-a',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Alpha A"\n\ncmd:buy "Buy A"' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-b',
      JSON.stringify([
        {
          id: 'b-1',
          sliceId: 'slice-b',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Beta B"\n\ncmd:buy "Buy B"' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-c',
      JSON.stringify([
        {
          id: 'c-1',
          sliceId: 'slice-c',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Gamma C"\n\ncmd:buy "Buy C"' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.app',
      JSON.stringify([
        ...JSON.parse(localStorage.getItem('slicr.es.v1.stream.app') ?? '[]'),
        {
          id: 'p-5',
          version: 5,
          at: '2026-01-01T00:00:05.000Z',
          type: 'slice-added-to-project',
          payload: { projectId: 'project-a', sliceId: 'slice-a' }
        },
        {
          id: 'p-6',
          version: 6,
          at: '2026-01-01T00:00:06.000Z',
          type: 'slice-added-to-project',
          payload: { projectId: 'project-b', sliceId: 'slice-b' }
        },
        {
          id: 'p-7',
          version: 7,
          at: '2026-01-01T00:00:07.000Z',
          type: 'slice-added-to-project',
          payload: { projectId: 'project-c', sliceId: 'slice-c' }
        },
        {
          id: 'p-8',
          version: 8,
          at: '2026-01-01T00:00:08.000Z',
          type: 'slice-selected',
          payload: { projectId: 'project-a', selectedSliceId: 'slice-a' }
        }
      ])
    );

    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const search = document.querySelector('.command-palette-search') as HTMLInputElement | null;
    expect(search).not.toBeNull();
    act(() => {
      if (search) {
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(search, 'project c');
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const filteredItems = [...document.querySelectorAll('.command-palette-item-title')].map((item) => item.textContent?.trim());
    expect(filteredItems).toEqual(['Switch Project: Project C']);
  });

  it('shows slices on dot-prefix search and switches to fuzzy-matched slice on Enter', () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'slice-a',
        slices: [
          { id: 'slice-a', dsl: 'slice "Alpha A"\n\ncmd:buy "Buy A"' },
          { id: 'slice-b', dsl: 'slice "Gamma Billing"\n\ncmd:pay "Pay"' },
          { id: 'slice-c', dsl: 'slice "Beta C"\n\ncmd:ship "Ship"' }
        ]
      })
    );

    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });
    const search = document.querySelector('.command-palette-search') as HTMLInputElement | null;
    expect(search).not.toBeNull();
    act(() => {
      if (search) {
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(search, '.');
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const dotItems = [...document.querySelectorAll('.command-palette-item-title')].map((item) => item.textContent?.trim());
    expect(dotItems).toEqual(['Alpha A', 'Gamma Billing', 'Beta C']);
    expect(dotItems.some((text) => text?.includes('Create Project'))).toBe(false);
    expect(dotItems.some((text) => text?.includes('Switch Project:'))).toBe(false);

    act(() => {
      if (search) {
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(search, '.gbl');
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    const fuzzyItems = [...document.querySelectorAll('.command-palette-item-title')].map((item) => item.textContent?.trim());
    expect(fuzzyItems).toEqual(['Gamma Billing']);

    act(() => {
      search?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(document.querySelector('.command-palette')).toBeNull();
    expect(document.querySelector('.slice-select-label')?.textContent).toContain('Gamma Billing');
  });

  it('selects all command palette input text when reopened', () => {
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const search = document.querySelector('.command-palette-search') as HTMLInputElement | null;
    expect(search).not.toBeNull();
    act(() => {
      if (search) {
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(search, 'switch project');
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });

    const reopened = document.querySelector('.command-palette-search') as HTMLInputElement | null;
    expect(reopened).not.toBeNull();
    expect(reopened?.value).toBe('switch project');
    expect(reopened?.selectionStart).toBe(0);
    expect(reopened?.selectionEnd).toBe('switch project'.length);
  });

  it('runs the default create project command on Enter and closes', () => {
    localStorage.setItem(
      'slicr.es.v1.stream.app',
      JSON.stringify([
        {
          id: 'p-1',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'project-created',
          payload: { projectId: 'project-a', name: 'Project A' }
        },
        {
          id: 'p-2',
          version: 2,
          at: '2026-01-01T00:00:02.000Z',
          type: 'project-created',
          payload: { projectId: 'project-b', name: 'Project B' }
        },
        {
          id: 'p-3',
          version: 3,
          at: '2026-01-01T00:00:03.000Z',
          type: 'project-created',
          payload: { projectId: 'project-c', name: 'Project C' }
        },
        {
          id: 'p-4',
          version: 4,
          at: '2026-01-01T00:00:04.000Z',
          type: 'project-selected',
          payload: { projectId: 'project-a' }
        },
        {
          id: 'p-5',
          version: 5,
          at: '2026-01-01T00:00:05.000Z',
          type: 'slice-added-to-project',
          payload: { projectId: 'project-a', sliceId: 'slice-a' }
        },
        {
          id: 'p-6',
          version: 6,
          at: '2026-01-01T00:00:06.000Z',
          type: 'slice-added-to-project',
          payload: { projectId: 'project-b', sliceId: 'slice-b' }
        },
        {
          id: 'p-7',
          version: 7,
          at: '2026-01-01T00:00:07.000Z',
          type: 'slice-added-to-project',
          payload: { projectId: 'project-c', sliceId: 'slice-c' }
        },
        {
          id: 'p-8',
          version: 8,
          at: '2026-01-01T00:00:08.000Z',
          type: 'slice-selected',
          payload: { projectId: 'project-a', selectedSliceId: 'slice-a' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a',
      JSON.stringify([
        {
          id: 'a-1',
          sliceId: 'slice-a',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Alpha A"\n\ncmd:buy "Buy A"' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-b',
      JSON.stringify([
        {
          id: 'b-1',
          sliceId: 'slice-b',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Beta B"\n\ncmd:buy "Buy B"' }
        }
      ])
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-c',
      JSON.stringify([
        {
          id: 'c-1',
          sliceId: 'slice-c',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Gamma C"\n\ncmd:buy "Buy C"' }
        }
      ])
    );

    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });
    const search = document.querySelector('.command-palette-search') as HTMLInputElement | null;
    expect(search).not.toBeNull();

    act(() => {
      if (search) {
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(search, 'create project');
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    act(() => {
      search?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(document.querySelector('.command-palette')).toBeNull();
    expect(document.querySelector('.project-modal')).not.toBeNull();
  });

  it('runs trace with keyboard shortcut for selected nodes', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Alpha"\n\nevt:seed "Seed"\ndata:\n  alpha: "a"\n\ncmd:consume "Consume"\n<- evt:seed\nuses:\n  alpha\n' }]
      })
    );

    await renderAppAndWaitForNodes();
    const cmdNode = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(cmdNode).not.toBeNull();
    await clickAndFlush(cmdNode);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', ctrlKey: true, shiftKey: true, bubbles: true }));
    });

    await waitFor(() => document.querySelector('.cross-slice-panel-tab.active')?.textContent?.trim() === 'Data Trace');
    expect(document.querySelector('.cross-slice-panel-tab.active')?.textContent?.trim()).toBe('Data Trace');
    expect(document.querySelector('.cross-slice-trace-source')?.textContent).toContain('value: a');
  });

  it('shows intermediate data trace hops from inspected node to source', async () => {
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

    await renderAppAndWaitForNodes();
    const cmdNode = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(cmdNode).not.toBeNull();
    await clickAndFlush(cmdNode);
    await clickPanelTab('Data Trace');
    await clickTraceKey('alpha');

    const hops = [...document.querySelectorAll('.cross-slice-trace-hop')].map((el) => el.textContent?.trim());
    expect(hops).toEqual(['view.alpha', 'seed.alpha']);
    expect(document.querySelectorAll('.cross-slice-trace-hop-node').length).toBe(2);
  });

  it('shows collect contributor hops and structured source values in Data Trace', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          {
            id: 'a',
            dsl: 'slice "Read Model from Two Events"\n\nevt:thing-added@1 "Thing Added"\ndata:\n  id: 100\n  name: alpha\n\nevt:thing-added@2 "Thing Added"\ndata:\n  id: 200\n  name: bravo\n\nrm:my-rm "All Things"\n<- evt:thing-added@1\n<- evt:thing-added@2\nuses:\n  things <- collect({id,name})\n'
          }
        ]
      })
    );

    await renderAppAndWaitForNodes();
    const rmNode = queryMainNode('.node.rm') as HTMLElement | null;
    expect(rmNode).not.toBeNull();
    await clickAndFlush(rmNode);
    await clickPanelTab('Data Trace');
    await clickTraceKey('things');

    const hops = [...document.querySelectorAll('.cross-slice-trace-hop')].map((el) => el.textContent?.trim());
    expect(hops).toEqual([
      'thing-added@1.collect({id,name})',
      'thing-added@2.collect({id,name})'
    ]);

    const sourceText = document.querySelector('.cross-slice-trace-source')?.textContent ?? '';
    expect(sourceText).toContain('value:');
    expect(sourceText).toContain('id: 100');
    expect(sourceText).toContain('name: alpha');
    expect(sourceText).not.toContain('[object Object]');
  });

  it('shows grouped collect contributors with upstream mapped hops', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          {
            id: 'a',
            dsl: 'slice "Data Integrity"\n\ncmd:add "Add Thing"\ndata:\n  id: 100\n  name: alpha\n\nevt:thing-added@1 "Thing Added"\n<- cmd:add\nuses:\n  id\n  name\n\nevt:thing-added@2 "Thing Added"\ndata:\n  id: 200\n  name: bravo\n\nrm:my-rm "All Things"\n<- evt:thing-added@1\n<- evt:thing-added@2\nuses:\n  things <- collect({id,name})\n'
          }
        ]
      })
    );

    await renderAppAndWaitForNodes();
    const rmNode = queryMainNode('.node.rm') as HTMLElement | null;
    expect(rmNode).not.toBeNull();
    await clickAndFlush(rmNode);
    await clickPanelTab('Data Trace');
    await clickTraceKey('things');

    const contributorLabels = [...document.querySelectorAll('.cross-slice-trace-contributor-label')]
      .map((el) => el.textContent?.trim());
    expect(contributorLabels).toEqual(['item[0]', 'item[1]']);

    const hops = [...document.querySelectorAll('.cross-slice-trace-hop')].map((el) => el.textContent?.trim());
    expect(hops).toContain('thing-added@1.collect({id,name})');
    expect(hops).toContain('add.id');
    expect(hops).toContain('add.name');
    expect(hops).toContain('thing-added@2.collect({id,name})');
  });

  it('shows data trace results only for the selected node version', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          {
            id: 'a',
            dsl: 'slice "Alpha"\n\nevt:seed@1 "Seed One"\ndata:\n  alpha: "a1"\n\nevt:seed@2 "Seed Two"\ndata:\n  alpha: "a2"\n\ncmd:buy@1 "Buy One"\n<- evt:seed@1\nuses:\n  alpha\n\ncmd:buy@2 "Buy Two"\n<- evt:seed@2\nuses:\n  alpha\n'
          }
        ]
      })
    );

    await renderAppAndWaitForNodes();
    const buyTwoNode = queryMainNodes('.node.cmd')
      .find((el) => el.querySelector('.node-title')?.textContent?.trim() === 'Buy Two') as HTMLElement | undefined;
    expect(buyTwoNode).toBeDefined();
    await clickAndFlush(buyTwoNode);
    await clickPanelTab('Data Trace');
    await clickTraceKey('alpha');

    const sources = [...document.querySelectorAll('.cross-slice-trace-source')]
      .map((el) => el.textContent?.trim());
    expect(sources).toEqual(['value: a2']);
  });

  it('hides Data Trace tab when selecting a scenario node with the same ref', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          {
            id: 'a',
            dsl: 'slice "Book Registration"\n\ncmd:register-book "Register Book"\ndata:\n  Author: "Martin Dilger"\n\nevt:book-registered "Book Registered"\n<- cmd:register-book\nuses:\n  Author\n\nscenario "Register Duplicate ISBN"\ngiven:\n  evt:book-registered "Book Registered"\n  data:\n    Author: "Author"\nwhen:\n  cmd:register-book "Scenario Register"\nthen:\n  evt:book-registered "Book Registered"\n  data:\n    Author: "Scenario Author"\n'
          }
        ]
      })
    );

    await renderAppAndWaitForNodes();
    await waitFor(() => {
      return [...document.querySelectorAll('.scenario-box .scenario-node-card.node')]
        .some((el) => el.textContent?.includes('Book Registered'));
    });
    const scenarioThenEvent = [...document.querySelectorAll('.scenario-box .scenario-node-card.node')]
      .find((el) => el.textContent?.includes('Book Registered')) as HTMLElement | undefined;
    expect(scenarioThenEvent).toBeDefined();
    await clickAndFlush(scenarioThenEvent);

    const tabLabels = [...document.querySelectorAll('.cross-slice-panel-tab')]
      .map((button) => button.textContent?.trim());
    expect(tabLabels).not.toContain('Data Trace');
  });

  it('does not show scenario-only nodes in the Cross-Slice Usage tab', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [
          {
            id: 'a',
            dsl: 'slice "Book Registration"\n\ncmd:register-book "Register Book"\n\nscenario "Register Duplicate ISBN"\nwhen:\n  cmd:register-book "Scenario Register"\n'
          }
        ]
      })
    );

    await renderAppAndWaitForNodes();
    const topLevelCmd = queryMainNodes('.node.cmd')
      .find((el) => el.querySelector('.node-title')?.textContent?.trim() === 'Register Book') as HTMLElement | undefined;
    expect(topLevelCmd).toBeDefined();
    await clickAndFlush(topLevelCmd);

    const usageItems = [...document.querySelectorAll('.cross-slice-usage-item')];
    expect(usageItems).toHaveLength(1);
    expect(usageItems[0]?.textContent ?? '').toContain('Register Book');
    expect(usageItems[0]?.textContent ?? '').not.toContain('Scenario Register');
  });

  it('highlights trace-hop node when hovering over Data Trace list entry', async () => {
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

    await renderAppAndWaitForNodes();
    const cmdNode = queryMainNode('.node.cmd') as HTMLElement | null;
    expect(cmdNode).not.toBeNull();
    await clickAndFlush(cmdNode);
    await clickPanelTab('Data Trace');
    await clickTraceKey('alpha');

    const viewHop = [...document.querySelectorAll('.cross-slice-trace-hop')]
      .find((el) => el.textContent?.trim() === 'view.alpha') as HTMLElement | undefined;
    expect(viewHop).toBeDefined();
    const viewNode = queryMainNodes('.node.rm')
      .find((el) => el.querySelector('.node-title')?.textContent?.trim() === 'View') as HTMLElement | undefined;
    expect(viewNode).toBeDefined();

    act(() => {
      viewHop?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    await waitFor(() => Boolean(viewNode?.classList.contains('trace-hovered')));
    expect(viewNode?.classList.contains('trace-hovered')).toBe(true);
  });

  it('does not highlight related nodes when selecting a node', async () => {
    localStorage.setItem(
      SLICES_STORAGE_KEY,
      JSON.stringify({
        selectedSliceId: 'a',
        slices: [{ id: 'a', dsl: 'slice "Alpha"\n\ncmd:buy\n\nevt:seed <- cmd:buy' }]
      })
    );

    await renderAppAndWaitForNodes();
    const cmdNode = queryMainNode('.node.cmd') as HTMLElement | null;
    const evtNode = queryMainNode('.node.evt') as HTMLElement | null;
    expect(cmdNode).not.toBeNull();
    expect(evtNode).not.toBeNull();

    await clickAndFlush(cmdNode);

    expect(cmdNode?.classList.contains('selected')).toBe(true);
    expect(evtNode?.classList.contains('related')).toBe(false);
  });

  it('keeps React StrictMode rendering stable for node analysis panel toggles', () => {
    renderAppStrict();
    const stored = readStoredLibrary();
    expect(stored).not.toBeNull();
  });
});
