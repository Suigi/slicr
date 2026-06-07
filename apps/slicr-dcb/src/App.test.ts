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
    layoutLibMock.compactLayout.mockImplementation(
      ({nodes, lanes}: {nodes: Array<{id: string; width: number; height: number}>; lanes?: Array<{id: string; order: number}>}) => ({
        ok: true,
        result: {
          lanes: (lanes ?? []).map((lane) => ({id: lane.id, top: -43, bottom: 43})),
          nodes: nodes.map((node, index) => ({id: node.id, x: index * 10, y: 0, width: node.width, height: node.height})),
          edges: [],
        },
      }),
    );
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
    nodePropertiesById: {},
    updateFocusedNodeProperties: vi.fn(),
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

  it('opens a right side panel showing the focused node title with schema and example editors', async () => {
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
    const nodeEditor = panel?.querySelector('.node-editor');
    const schemaHeading = panel?.querySelector('.node-editor-schema-heading');
    const exampleHeading = panel?.querySelector('.node-editor-example-heading');
    const propertyEditors = panel?.querySelectorAll('.property-editor');

    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('aria-label')).toBe('Focused node details');
    expect(title?.textContent).toBe('Checkout Completed');
    expect(title?.classList.contains('node-detail-title-evt')).toBe(true);
    expect(propertiesHeading?.textContent).toBe('Properties');
    expect(nodeEditor).not.toBeNull();
    expect(schemaHeading?.textContent).toBe('Schema');
    expect(exampleHeading?.textContent).toBe('Example values');
    expect(propertyEditors).toHaveLength(2);
    expect(title?.compareDocumentPosition(propertiesHeading as Node) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(propertiesHeading?.compareDocumentPosition(nodeEditor as Node) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(schemaHeading?.compareDocumentPosition(exampleHeading as Node) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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

  it('renders property-grid content inside graph nodes when properties exist', async () => {
    graphModelMock.useGraphModel.mockReturnValue(createGraphModelMockValue({
      nodePropertiesById: {
        'node-1': [{id: 'prop-title', name: 'title', type: 'string', example: 'Hello'}],
      },
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(App));
      await Promise.resolve();
    });

    expect(container.querySelector('.canvas .node-box-with-properties')).not.toBeNull();
    expect(container.querySelector('.canvas .node-box-with-properties property-grid')).not.toBeNull();
  });

  it('highlights matching schema and example rows when the focused node property grid reports hover', async () => {
    graphModelMock.useGraphModel.mockReturnValue(createGraphModelMockValue({
      focusedNodeProperties: [
        {id: 'prop-title', name: 'title', type: 'string', example: 'Hello'},
        {id: 'prop-summary', name: 'summary', type: 'string', example: 'Short'},
      ],
      nodePropertiesById: {
        'node-1': [
          {id: 'prop-title', name: 'title', type: 'string', example: 'Hello'},
          {id: 'prop-summary', name: 'summary', type: 'string', example: 'Short'},
        ],
      },
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(App));
      await Promise.resolve();
    });

    const graphGrid = container.querySelector<HTMLElement>('.canvas .node-box-with-properties property-grid.node-property-grid');
    await act(async () => {
      graphGrid?.dispatchEvent(new CustomEvent('property-grid-hovered-property-change', { bubbles: true, composed: true, detail: { propertyId: 'prop-summary' } }));
    });

    const schemaRows = [...container.querySelectorAll<HTMLElement>('.node-detail-panel .node-editor-schema > .property-editor > .property-editor-grid > .property-editor-row:not(.property-editor-template-row)')];
    const exampleRows = [...container.querySelectorAll<HTMLElement>('.node-detail-panel .node-editor-example > .property-editor > .property-editor-grid > .property-editor-row:not(.property-editor-template-row)')];

    expect(schemaRows.map((row) => row.classList.contains('property-editor-row-focused'))).toEqual([false, true]);
    expect(exampleRows.map((row) => row.classList.contains('property-editor-row-focused'))).toEqual([false, true]);
  });

  it('reverts editor highlights to the editor-focused property when focused node grid hover clears', async () => {
    graphModelMock.useGraphModel.mockReturnValue(createGraphModelMockValue({
      focusedNodeProperties: [
        {id: 'prop-title', name: 'title', type: 'string', example: 'Hello'},
        {id: 'prop-summary', name: 'summary', type: 'string', example: 'Short'},
      ],
      nodePropertiesById: {
        'node-1': [
          {id: 'prop-title', name: 'title', type: 'string', example: 'Hello'},
          {id: 'prop-summary', name: 'summary', type: 'string', example: 'Short'},
        ],
      },
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(App));
      await Promise.resolve();
    });

    await act(async () => {
      container?.querySelector<HTMLInputElement>('.node-detail-panel .node-editor-schema input[value="title"]')?.focus();
    });

    const graphGrid = container.querySelector<HTMLElement>('.canvas .node-box-with-properties property-grid.node-property-grid');
    await act(async () => {
      graphGrid?.dispatchEvent(new CustomEvent('property-grid-hovered-property-change', { bubbles: true, composed: true, detail: { propertyId: 'prop-summary' } }));
    });
    await act(async () => {
      graphGrid?.dispatchEvent(new CustomEvent('property-grid-hovered-property-change', { bubbles: true, composed: true, detail: { propertyId: null } }));
    });

    const schemaRows = [...container.querySelectorAll<HTMLElement>('.node-detail-panel .node-editor-schema > .property-editor > .property-editor-grid > .property-editor-row:not(.property-editor-template-row)')];
    const exampleRows = [...container.querySelectorAll<HTMLElement>('.node-detail-panel .node-editor-example > .property-editor > .property-editor-grid > .property-editor-row:not(.property-editor-template-row)')];

    expect(schemaRows.map((row) => row.classList.contains('property-editor-row-focused'))).toEqual([true, false]);
    expect(exampleRows.map((row) => row.classList.contains('property-editor-row-focused'))).toEqual([true, false]);
  });

  it('does not highlight focused-node editors when a non-focused node property grid reports hover', async () => {
    graphModelMock.useGraphModel.mockReturnValue(createGraphModelMockValue({
      nodes: [
        { id: 'node-1', label: 'Focused', type: 'evt', laneId: 'lane-0', width: 160, height: 80 },
        { id: 'node-2', label: 'Other', type: 'cmd', laneId: 'lane-0', width: 160, height: 80 },
      ],
      focusedNodeId: 'node-1',
      focusedNodeProperties: [{id: 'prop-title', name: 'title', type: 'string', example: 'Hello'}],
      nodePropertiesById: {
        'node-1': [{id: 'prop-title', name: 'title', type: 'string', example: 'Hello'}],
        'node-2': [{id: 'prop-other', name: 'other', type: 'string', example: 'Other'}],
      },
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(App));
      await Promise.resolve();
    });

    const [, nonFocusedGrid] = [...container.querySelectorAll<HTMLElement>('.canvas .node-box-with-properties property-grid.node-property-grid')];
    await act(async () => {
      nonFocusedGrid?.dispatchEvent(new CustomEvent('property-grid-hovered-property-change', { bubbles: true, composed: true, detail: { propertyId: 'prop-title' } }));
    });

    const schemaRows = [...container.querySelectorAll<HTMLElement>('.node-detail-panel .node-editor-schema > .property-editor > .property-editor-grid > .property-editor-row:not(.property-editor-template-row)')];
    const exampleRows = [...container.querySelectorAll<HTMLElement>('.node-detail-panel .node-editor-example > .property-editor > .property-editor-grid > .property-editor-row:not(.property-editor-template-row)')];

    expect(schemaRows.map((row) => row.classList.contains('property-editor-row-focused'))).toEqual([false]);
    expect(exampleRows.map((row) => row.classList.contains('property-editor-row-focused'))).toEqual([false]);
  });

  it('clears property highlight when the focused node is deselected and does not restore stale highlight on reselect', async () => {
    const focusedNodeProperties = [
      {id: 'prop-title', name: 'title', type: 'string', example: 'Hello'},
      {id: 'prop-summary', name: 'summary', type: 'string', example: 'Short'},
    ];
    const nodePropertiesById = {
      'node-1': focusedNodeProperties,
    };
    let focusedNodeId: string | null = 'node-1';

    graphModelMock.useGraphModel.mockImplementation(() => createGraphModelMockValue({
      focusedNodeId,
      focusedNodeProperties: focusedNodeId ? focusedNodeProperties : [],
      nodePropertiesById,
    }));

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(App));
      await Promise.resolve();
    });

    await act(async () => {
      container?.querySelector<HTMLInputElement>('.node-detail-panel .node-editor-schema input[value="title"]')?.focus();
    });

    focusedNodeId = null;
    await act(async () => {
      root?.render(createElement(App));
      await Promise.resolve();
    });

    expect(container.querySelector('.node-detail-panel')).toBeNull();

    focusedNodeId = 'node-1';
    await act(async () => {
      root?.render(createElement(App));
      await Promise.resolve();
    });

    const schemaRows = [...container.querySelectorAll<HTMLElement>('.node-detail-panel .node-editor-schema > .property-editor > .property-editor-grid > .property-editor-row:not(.property-editor-template-row)')];
    const exampleRows = [...container.querySelectorAll<HTMLElement>('.node-detail-panel .node-editor-example > .property-editor > .property-editor-grid > .property-editor-row:not(.property-editor-template-row)')];
    const graphGrid = container.querySelector<HTMLElement & { focusedPropertyId?: string | null }>('.canvas .node-box-with-properties property-grid.node-property-grid');

    expect(schemaRows.map((row) => row.classList.contains('property-editor-row-focused'))).toEqual([false, false]);
    expect(exampleRows.map((row) => row.classList.contains('property-editor-row-focused'))).toEqual([false, false]);
    expect(graphGrid?.focusedPropertyId ?? null).toBeNull();
  });

  it('highlights the matching example-value table column when the focused node property grid hovers an object-list child property', async () => {
    graphModelMock.useGraphModel.mockReturnValue(createGraphModelMockValue({
      focusedNodeProperties: [
        {
          id: 'prop-columns',
          name: 'columns',
          type: 'Object',
          list: true,
          properties: [
            {id: 'field-id', name: 'field', type: 'string', example: 'firstName'},
            {id: 'label-id', name: 'label', type: 'string', example: 'First name'},
          ],
          rows: [
            {'field-id': 'firstName', 'label-id': 'First name'},
            {'field-id': 'lastName', 'label-id': 'Last name'},
          ],
        },
      ],
      nodePropertiesById: {
        'node-1': [
          {
            id: 'prop-columns',
            name: 'columns',
            type: 'Object',
            list: true,
            properties: [
              {id: 'field-id', name: 'field', type: 'string', example: 'firstName'},
              {id: 'label-id', name: 'label', type: 'string', example: 'First name'},
            ],
            rows: [
              {'field-id': 'firstName', 'label-id': 'First name'},
              {'field-id': 'lastName', 'label-id': 'Last name'},
            ],
          },
        ],
      },
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(App));
      await Promise.resolve();
    });

    const graphGrid = container.querySelector<HTMLElement>('.canvas .node-box-with-properties property-grid.node-property-grid');
    await act(async () => {
      graphGrid?.dispatchEvent(new CustomEvent('property-grid-hovered-property-change', { bubbles: true, composed: true, detail: { propertyId: 'field-id' } }));
    });

    const schemaFieldRow = container
      .querySelector<HTMLInputElement>('.node-detail-panel .node-editor-schema input[value="field"]')
      ?.closest<HTMLElement>('.property-editor-row');
    const exampleHighlightedCells = [...container.querySelectorAll<HTMLElement>('.node-detail-panel .node-editor-example .is-property-highlighted')];
    const exampleHighlightedValues = exampleHighlightedCells.map((cell) => {
      const input = cell.querySelector<HTMLInputElement>('input');
      return input ? input.value : cell.textContent;
    });

    expect(schemaFieldRow?.classList.contains('property-editor-row-focused')).toBe(true);
    expect(exampleHighlightedValues).toEqual(['field', 'firstName', 'lastName']);
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
        expect.objectContaining({id: 'node-1', width: NODE_WIDTH, height: 118}),
      ]);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  it('keeps measured dimensions at or above the shared minimum node size', async () => {
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
          bottom: 40,
          right: 120,
          width: 120,
          height: 40,
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
        expect.objectContaining({id: 'node-1', width: NODE_WIDTH, height: NODE_HEIGHT}),
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
        expect.objectContaining({id: 'node-1', width: NODE_WIDTH, height: 118, label: 'Checkout Draft'}),
      ]);
      expect(layoutLibMock.compactLayout.mock.calls[3]?.[0].nodes).toEqual([
        expect.objectContaining({id: 'node-1', width: NODE_WIDTH, height: 160, label: 'Checkout Draft'}),
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
        expect.objectContaining({id: 'node-1', width: NODE_WIDTH, height: 118}),
      ]);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  it('blocks visual graph export until measurement settles after a graph change', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const originalQueueMicrotask = globalThis.queueMicrotask;
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const queuedMeasurementPasses: Array<() => void> = [];
    let currentMeasurement = {width: 312, height: 118};
    let graphModelState = createGraphModelMockValue({
      nodes: [{id: 'node-1', label: 'Checkout Completed', type: 'evt', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT}],
    });

    globalThis.queueMicrotask = vi.fn((callback: VoidFunction) => {
      queuedMeasurementPasses.push(callback);
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {writeText},
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
      });

      await act(async () => {
        while (queuedMeasurementPasses.length > 0) {
          queuedMeasurementPasses.shift()?.();
        }
      });

      currentMeasurement = {width: 420, height: 160};
      graphModelState = createGraphModelMockValue({
        nodes: [{id: 'node-1', label: 'Checkout Draft', type: 'evt', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT}],
      });

      await act(async () => {
        root?.render(createElement(App));
      });

      await act(async () => {
        const exportMenuButton = [...container!.querySelectorAll<HTMLButtonElement>('button')].find(
          (button) => button.textContent === 'Export ▾',
        );
        exportMenuButton?.click();
      });

      await act(async () => {
        const exportVisualGraphButton = [...container!.querySelectorAll<HTMLButtonElement>('button')].find(
          (button) => button.textContent === 'Export layout-lib vitest case',
        );
        exportVisualGraphButton?.click();
      });

      expect(container!.querySelector('.graph-workspace')?.getAttribute('data-measurement-settled')).toBe('false');
      expect(alertSpy).toHaveBeenCalledWith('Cannot export a visual graph until measurement and layout have settled.');
      expect(writeText).not.toHaveBeenCalled();
    } finally {
      globalThis.queueMicrotask = originalQueueMicrotask;
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  it('exports the measured node dimensions used for the settled layout', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {writeText},
    });
    graphModelMock.useGraphModel.mockReturnValue(createGraphModelMockValue({
      nodes: [{id: 'node-1', label: 'Checkout Completed', type: 'evt', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT}],
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

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    try {
      await act(async () => {
        root?.render(createElement(App));
        await Promise.resolve();
      });

      await act(async () => {
        const exportMenuButton = [...container!.querySelectorAll<HTMLButtonElement>('button')].find(
          (button) => button.textContent === 'Export ▾',
        );
        exportMenuButton?.click();
      });

      await act(async () => {
        const exportVisualGraphButton = [...container!.querySelectorAll<HTMLButtonElement>('button')].find(
          (button) => button.textContent === 'Export layout-lib vitest case',
        );
        exportVisualGraphButton?.click();
      });

      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText.mock.calls[0]?.[0]).toContain(
        `{
      id: "node-1",
      laneId: "lane-0",
      width: ${NODE_WIDTH},
      height: 118
    }`,
      );
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
