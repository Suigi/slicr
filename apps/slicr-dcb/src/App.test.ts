// @vitest-environment jsdom

import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const graphModelMock = vi.hoisted(() => ({
  useGraphModel: vi.fn(),
}));

const layoutLibMock = vi.hoisted(() => ({
  compactLayout: vi.fn(),
}));

vi.mock('./graph/useGraphModel', async () => {
  const actual = await vi.importActual<typeof import('./graph/useGraphModel')>('./graph/useGraphModel');
  return {
    ...actual,
    useGraphModel: graphModelMock.useGraphModel,
  };
});

vi.mock('layout-lib', () => ({
  compactLayout: layoutLibMock.compactLayout,
}));

import {App} from './App';
import {NODE_HEIGHT, NODE_WIDTH} from './graph/constants';
import {getKeyboardSuccessorNodeType, getSuccessorNodeType} from './graph/graphUtils';
import {isStoredGraphModel} from './graph/useGraphModel';

describe('App', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    layoutLibMock.compactLayout.mockImplementation(({nodes}: {nodes: Array<{id: string; width: number; height: number}>}) => ({
      ok: true,
      result: {
        nodes: nodes.map((node, index) => ({id: node.id, x: index * 10, y: 0, width: node.width, height: node.height})),
        edges: [],
      },
    }));
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
    graphModelMock.useGraphModel.mockReset();
    layoutLibMock.compactLayout.mockReset();
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

  it('renders the hidden node measurement layer outside the canvas subtree', async () => {
    layoutLibMock.compactLayout.mockImplementation(({nodes}: {nodes: Array<{id: string; width: number; height: number}>}) => ({
      ok: true,
      result: {
        nodes: nodes.map((node, index) => ({id: node.id, x: index * 10, y: 0, width: node.width, height: node.height})),
        edges: [],
      },
    }));
    graphModelMock.useGraphModel.mockReturnValue(createGraphModelMockValue());
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(App));
      await Promise.resolve();
    });

    const canvas = container.querySelector('.canvas');
    const measurementLayer = container.querySelector('.node-measure-layer');
    const measurementTargets = container.querySelectorAll('.node-measure-layer [data-node-id]');

    expect(canvas).not.toBeNull();
    expect(measurementLayer).not.toBeNull();
    expect(measurementTargets).toHaveLength(1);
    expect(measurementLayer?.closest('.canvas')).toBeNull();
    expect(canvas?.contains(measurementLayer as Node)).toBe(false);
  });

  it('re-runs layout with measured node dimensions after the initial default-sized pass', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    layoutLibMock.compactLayout.mockImplementation(({nodes}: {nodes: Array<{id: string; width: number; height: number}>}) => ({
      ok: true,
      result: {
        nodes: nodes.map((node, index) => ({id: node.id, x: index * 10, y: 0, width: node.width, height: node.height})),
        edges: [],
      },
    }));
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this instanceof HTMLElement && this.dataset.nodeId === 'node-1') {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          bottom: 118,
          right: 312,
          width: 312,
          height: 118,
          toJSON: () => ({}),
        };
      }

      return originalGetBoundingClientRect.call(this);
    };

    graphModelMock.useGraphModel.mockReturnValue(createGraphModelMockValue({
      nodes: [{id: 'node-1', label: 'Checkout Completed', type: 'evt', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT}],
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    try {
      await act(async () => {
        root?.render(createElement(App));
        await Promise.resolve();
      });

      expect(layoutLibMock.compactLayout).toHaveBeenCalledTimes(2);
      expect(layoutLibMock.compactLayout.mock.calls[0]?.[0].nodes).toEqual([
        expect.objectContaining({id: 'node-1', width: NODE_WIDTH, height: NODE_HEIGHT}),
      ]);
      expect(layoutLibMock.compactLayout.mock.calls[1]?.[0].nodes).toEqual([
        expect.objectContaining({id: 'node-1', width: 312, height: 118}),
      ]);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  it('re-runs measurement and layout after a committed graph content change', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    let currentMeasurement = {width: 312, height: 118};
    let graphModelState = createGraphModelMockValue({
      nodes: [{id: 'node-1', label: 'Checkout Completed', type: 'evt', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT}],
    });

    graphModelMock.useGraphModel.mockImplementation(() => graphModelState);
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this instanceof HTMLElement && this.dataset.nodeId === 'node-1') {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          bottom: currentMeasurement.height,
          right: currentMeasurement.width,
          width: currentMeasurement.width,
          height: currentMeasurement.height,
          toJSON: () => ({}),
        };
      }

      return originalGetBoundingClientRect.call(this);
    };

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    try {
      await act(async () => {
        root?.render(createElement(App));
        await Promise.resolve();
      });

      currentMeasurement = {width: 420, height: 160};
      graphModelState = createGraphModelMockValue({
        nodes: [{id: 'node-1', label: 'Checkout Draft', type: 'evt', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT}],
      });

      await act(async () => {
        root?.render(createElement(App));
        await Promise.resolve();
      });

      expect(layoutLibMock.compactLayout).toHaveBeenCalledTimes(4);
      expect(layoutLibMock.compactLayout.mock.calls[2]?.[0].nodes).toEqual([
        expect.objectContaining({id: 'node-1', width: 312, height: 118, label: 'Checkout Draft'}),
      ]);
      expect(layoutLibMock.compactLayout.mock.calls[3]?.[0].nodes).toEqual([
        expect.objectContaining({id: 'node-1', width: 420, height: 160, label: 'Checkout Draft'}),
      ]);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  it('does not re-run measurement or layout for focus and node-menu state changes alone', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const stableNodes = [{id: 'node-1', label: 'Checkout Completed', type: 'evt', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT}];
    const stableEdges: [] = [];
    const stableLanes = [{id: 'lane-0', order: 0}];
    let measurementCallCount = 0;
    let graphModelState = createGraphModelMockValue({
      nodes: stableNodes,
      edges: stableEdges,
      lanes: stableLanes,
      focusedNodeId: 'node-1',
      openNodeMenuId: null,
    });

    graphModelMock.useGraphModel.mockImplementation(() => graphModelState);
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this instanceof HTMLElement && this.dataset.nodeId === 'node-1') {
        measurementCallCount += 1;
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          bottom: 118,
          right: 312,
          width: 312,
          height: 118,
          toJSON: () => ({}),
        };
      }

      return originalGetBoundingClientRect.call(this);
    };

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    try {
      await act(async () => {
        root?.render(createElement(App));
        await Promise.resolve();
      });

      const measurementCallCountAfterMount = measurementCallCount;
      const layoutCallCountAfterMount = layoutLibMock.compactLayout.mock.calls.length;

      graphModelState = createGraphModelMockValue({
        nodes: stableNodes,
        edges: stableEdges,
        lanes: stableLanes,
        focusedNodeId: null,
        openNodeMenuId: 'node-1',
      });

      await act(async () => {
        root?.render(createElement(App));
        await Promise.resolve();
      });

      expect(measurementCallCount).toBe(measurementCallCountAfterMount);
      expect(layoutLibMock.compactLayout).toHaveBeenCalledTimes(layoutCallCountAfterMount);
      expect(layoutLibMock.compactLayout.mock.calls[0]?.[0].nodes).toEqual([
        expect.objectContaining({id: 'node-1', width: NODE_WIDTH, height: NODE_HEIGHT}),
      ]);
      expect(layoutLibMock.compactLayout.mock.calls[1]?.[0].nodes).toEqual([
        expect.objectContaining({id: 'node-1', width: 312, height: 118}),
      ]);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
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
