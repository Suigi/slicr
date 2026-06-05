// @vitest-environment jsdom

import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, describe, expect, it, vi} from 'vitest';

const graphModelMock = vi.hoisted(() => ({
  useGraphModel: vi.fn(),
}));

vi.mock('./graph/useGraphModel', async () => {
  const actual = await vi.importActual<typeof import('./graph/useGraphModel')>('./graph/useGraphModel');
  return {
    ...actual,
    useGraphModel: graphModelMock.useGraphModel,
  };
});

import {App} from './App';
import {getKeyboardSuccessorNodeType, getSuccessorNodeType} from './graph/graphUtils';
import {isStoredGraphModel} from './graph/useGraphModel';

describe('App', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
    graphModelMock.useGraphModel.mockReset();
  });

  it('is defined', () => {
    expect(App).toBeTypeOf('function');
  });

  const createGraphModelMockValue = (overrides: Record<string, unknown> = {}) => ({
    nodes: [{ id: 'node-1', label: 'Checkout Completed', type: 'evt', laneId: 'lane-0', width: 160, height: 80 }],
    edges: [],
    lanes: [{ id: 'lane-0', order: 0 }],
    focusedNodeId: 'node-1',
    editingNodeId: null,
    draftLabel: '',
    openNodeMenuId: null,
    connectingSourceNodeId: null,
    setFocusedNodeId: vi.fn(),
    setDraftLabel: vi.fn(),
    setOpenNodeMenuId: vi.fn(),
    readGraphEvents: vi.fn(),
    replaceGraphEvents: vi.fn(),
    revertToLastOkGraphModel: vi.fn(),
    addNewSlice: vi.fn(),
    startConnectingFromNode: vi.fn(),
    cancelConnecting: vi.fn(),
    addConnection: vi.fn(),
    deleteConnection: vi.fn(),
    addConnectedNode: vi.fn(),
    deleteNode: vi.fn(),
    setNodeType: vi.fn(),
    startEditingNode: vi.fn(),
    saveEditingNode: vi.fn(),
    cancelEditingFromKeyboard: vi.fn(),
    handleLabelBlur: vi.fn(),
    ...overrides,
  });

  it('opens a right side panel showing the focused node title and properties editor', async () => {
    graphModelMock.useGraphModel.mockReturnValue(createGraphModelMockValue());
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(App));
      await Promise.resolve();
    });

    const panel = container.querySelector('.node-detail-panel');
    const title = panel?.querySelector('.node-detail-title');
    const propertiesHeading = panel?.querySelector('.node-detail-properties-heading');
    const propertyEditor = panel?.querySelector('.property-editor');

    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('aria-label')).toBe('Focused node details');
    expect(title?.textContent).toBe('Checkout Completed');
    expect(title?.classList.contains('node-detail-title-evt')).toBe(true);
    expect(propertiesHeading?.textContent).toBe('Properties');
    expect(propertyEditor).not.toBeNull();
    expect(title?.compareDocumentPosition(propertiesHeading as Node) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(propertiesHeading?.compareDocumentPosition(propertyEditor as Node) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders focused-node properties supplied by the graph model hook', async () => {
    const updateFocusedNodeProperties = vi.fn();
    graphModelMock.useGraphModel.mockReturnValue(createGraphModelMockValue({
      focusedNodeProperties: [{id: 'prop-title', name: 'title', type: 'string', example: 'Hello'}],
      updateFocusedNodeProperties,
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(App));
      await Promise.resolve();
    });

    const propertyNameInput = container.querySelector<HTMLInputElement>('.property-editor-field input[placeholder="propertyName"]');
    expect(propertyNameInput?.value).toBe('title');
    expect([...container.querySelectorAll<HTMLInputElement>('input')].map((input) => input.value)).toContain('Hello');
  });

  it('does not start node title editing when Enter is pressed inside the property editor', async () => {
    const startEditingNode = vi.fn();
    graphModelMock.useGraphModel.mockReturnValue(createGraphModelMockValue({ startEditingNode }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(App));
      await Promise.resolve();
    });

    const addPropertyInput = container.querySelector<HTMLInputElement>('.property-editor-template-row input[placeholder="Add property"]');
    expect(addPropertyInput).not.toBeNull();

    addPropertyInput?.focus();
    addPropertyInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(startEditingNode).not.toHaveBeenCalled();
  });
});

describe('Decision Model nodes', () => {
  it('accepts decision model as a stored node type', () => {
    expect(
      isStoredGraphModel({
        nodes: [{ id: 'node-1', label: 'Decision Model', type: 'dm', laneId: 'lane-0', width: 160, height: 80 }],
        edges: [],
        lanes: [{ id: 'lane-0', order: 0 }],
      }),
    ).toBe(true);
  });

  it('connects from decision models like read models', () => {
    expect(getSuccessorNodeType('dm', 'top')).toBe('ui');
    expect(getKeyboardSuccessorNodeType('dm')).toBe('ui');
  });
});
