// @vitest-environment jsdom

import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {App} from './App';
import {Events} from './domain/events';

const reactActEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
const defaultProjectId = 'default-project';

async function flushRender() {
  await Promise.resolve();
  await Promise.resolve();
}

function clickButtonByTitle(container: HTMLElement, title: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
  expect(button).toBeDefined();
  button?.click();
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', {bubbles: true}));
}

describe('App backup/restore property event flow', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  const originalIndexedDb = globalThis.indexedDB;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
    globalThis.indexedDB = originalIndexedDb;
    window.localStorage?.clear?.();
    vi.restoreAllMocks();
  });

  it('restores node property events from a clipboard backup into the focused node side panel', async () => {
    globalThis.indexedDB = undefined as unknown as typeof indexedDB;
    const backupEvents = [
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'evt', 0, 'Checkout Completed'),
      Events.nodeSchemaChanged(defaultProjectId, 'node-1', [{propertyId: 'prop-title', name: 'title', type: 'string'}]),
      Events.nodeExampleValuesChanged(defaultProjectId, 'node-1', [{propertyId: 'prop-title', scalarValue: 'Hello world'}]),
    ];

    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: vi.fn().mockResolvedValue(JSON.stringify({version: 1, events: backupEvents})),
        writeText: vi.fn(),
      },
    });

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(App));
      await flushRender();
    });

    await act(async () => {
      clickButtonByTitle(container!, 'Restore full event backup from clipboard');
      await flushRender();
    });

    const title = container.querySelector('.node-detail-title');
    const nodeEditor = container.querySelector('.node-editor');
    const schemaNameInput = container.querySelector<HTMLInputElement>('.node-editor-schema input[placeholder="propertyName"]');
    const exampleInput = container.querySelector<HTMLInputElement>('.node-editor-example input[placeholder="optional"]');

    expect(title?.textContent).toBe('Checkout Completed');
    expect(nodeEditor).not.toBeNull();
    expect(schemaNameInput?.value).toBe('title');
    expect(exampleInput?.value).toBe('Hello world');
  });

  it('backs up all persisted events after a debounced property edit', async () => {
    vi.useFakeTimers();
    globalThis.indexedDB = undefined as unknown as typeof indexedDB;
    const backupEvents = [
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'evt', 0, 'Checkout Completed'),
      Events.nodeSchemaChanged(defaultProjectId, 'node-1', [{propertyId: 'prop-title', name: 'title', type: 'string'}]),
      Events.nodeExampleValuesChanged(defaultProjectId, 'node-1', [{propertyId: 'prop-title', scalarValue: 'Hello world'}]),
    ];
    const writeText = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: vi.fn().mockResolvedValue(JSON.stringify({version: 1, events: backupEvents})),
        writeText,
      },
    });

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(App));
      await flushRender();
    });

    await act(async () => {
      clickButtonByTitle(container!, 'Restore full event backup from clipboard');
      await flushRender();
    });

    const exampleInput = container.querySelector<HTMLInputElement>('.property-editor-field input[placeholder="optional"]');
    expect(exampleInput).toBeDefined();

    await act(async () => {
      setInputValue(exampleInput!, 'Updated title');
    });
    expect(exampleInput?.value).toBe('Updated title');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await flushRender();
    });

    await act(async () => {
      clickButtonByTitle(container!, 'Copy full event backup to clipboard');
      await flushRender();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    const backedUp = JSON.parse(writeText.mock.calls[0][0] as string);
    expect(backedUp.version).toBe(1);
    const backedUpEvents = backedUp.events;
    const backedUpSchemaEvents = backedUpEvents.filter((event: {type: string}) => event.type === 'NodeSchemaChanged');
    const backedUpExampleEvents = backedUpEvents.filter((event: {type: string}) => event.type === 'NodeExampleValuesChanged');

    expect(backedUpSchemaEvents).toContainEqual(backupEvents[1]);
    expect(backedUpExampleEvents.at(-1)).toEqual(
      Events.nodeExampleValuesChanged(defaultProjectId, 'node-1', [{propertyId: 'prop-title', scalarValue: 'Updated title'}]),
    );
  });
});
