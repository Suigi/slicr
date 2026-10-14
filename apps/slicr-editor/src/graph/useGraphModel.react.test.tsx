// @vitest-environment jsdom

import {act, createElement, useEffect} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {NODE_HEIGHT, NODE_WIDTH} from './constants';
import {useGraphModel, type StoredGraphModel} from './useGraphModel';

const loadGraphApplicationMock = vi.hoisted(() => vi.fn());

vi.mock('../application/graphApplicationLoader', () => ({
  loadGraphApplication: loadGraphApplicationMock,
}));

function createEmptyGraphModel(): StoredGraphModel {
  return {nodes: [], edges: [], lanes: [], nodeSchemas: {}, nodeExampleValues: {}};
}

function createNodeGraphModel(): StoredGraphModel {
  return {
    nodes: [{id: 'node-1', label: 'Node 1', type: 'ui', laneId: 'lane-0', width: NODE_WIDTH, height: NODE_HEIGHT}],
    edges: [],
    lanes: [{id: 'lane-0', order: 0}],
    nodeSchemas: {},
    nodeExampleValues: {},
  };
}

describe('useGraphModel', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
    loadGraphApplicationMock.mockReset();
  });

  it('waits for a graph subscription update before reflecting a command result', async () => {
    const initialGraph = createEmptyGraphModel();
    const updatedGraph = createNodeGraphModel();
    let graphListener: ((graph: StoredGraphModel) => void) | null = null;

    loadGraphApplicationMock.mockResolvedValue({
      model: {
        load: vi.fn(async () => initialGraph),
        setScope: vi.fn(async () => initialGraph),
        getSnapshot: vi.fn(() => initialGraph),
        getWorkspace: vi.fn(() => ({projects: [], chaptersByProjectId: {}})),
        getScope: vi.fn(() => ({projectId: 'project-1', chapterId: 'chapter-1'})),
        subscribeToWorkspace: vi.fn(() => ({unsubscribe: vi.fn()})),
        createScopedGraphView: vi.fn(() => ({
          getSnapshot: () => initialGraph,
          getScope: () => ({projectId: 'project-1', chapterId: 'chapter-1'}),
          setScope: vi.fn(async () => initialGraph),
          subscribe: (listener: (graph: StoredGraphModel) => void) => {
            graphListener = listener;
            return {unsubscribe: vi.fn()};
          },
        })),
        addNewSlice: vi.fn(async () => updatedGraph),
      },
      graphModel: initialGraph,
      eventBackup: {},
    });

    const latestState = {current: null as ReturnType<typeof useGraphModel> | null};
    function HookHarness(props: {activeProjectId?: string | null; activeChapterId?: string | null}) {
      const state = useGraphModel(props);
      useEffect(() => {
        latestState.current = state;
      }, [state]);
      return null;
    }

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(HookHarness, {activeProjectId: 'project-1', activeChapterId: 'chapter-1'}));
      await Promise.resolve();
    });

    expect(latestState.current?.nodes).toEqual([]);

    await act(async () => {
      await latestState.current?.addNewSlice();
    });

    expect(latestState.current?.nodes).toEqual([]);

    await act(async () => {
      graphListener?.(updatedGraph);
      await Promise.resolve();
    });

    expect(latestState.current?.nodes).toEqual(updatedGraph.nodes);
  });

  it('waits for addProject subscription updates before changing graph and resolved scope', async () => {
    const initialGraph = createEmptyGraphModel();
    const nextGraph = createNodeGraphModel();
    const currentScope = {projectId: 'project-1', chapterId: 'chapter-1'};
    let graphListener: ((graph: StoredGraphModel) => void) | null = null;

    loadGraphApplicationMock.mockResolvedValue({
      model: {
        load: vi.fn(async () => initialGraph),
        setScope: vi.fn(async () => nextGraph),
        getSnapshot: vi.fn(() => initialGraph),
        getWorkspace: vi.fn(() => ({projects: [], chaptersByProjectId: {}})),
        getScope: vi.fn(() => currentScope),
        subscribeToWorkspace: vi.fn(() => ({unsubscribe: vi.fn()})),
        createScopedGraphView: vi.fn(() => ({
          getSnapshot: () => initialGraph,
          getScope: () => currentScope,
          setScope: vi.fn(async () => nextGraph),
          subscribe: (listener: (graph: StoredGraphModel) => void) => {
            graphListener = listener;
            return {unsubscribe: vi.fn()};
          },
        })),
        addProject: vi.fn(async () => {
          currentScope.projectId = 'project-2';
          return nextGraph;
        }),
      },
      graphModel: initialGraph,
      eventBackup: {},
    });

    const latestState = {current: null as ReturnType<typeof useGraphModel> | null};
    function HookHarness(props: {activeProjectId?: string | null; activeChapterId?: string | null}) {
      const state = useGraphModel(props);
      useEffect(() => {
        latestState.current = state;
      }, [state]);
      return null;
    }

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(HookHarness, {activeProjectId: 'project-1', activeChapterId: 'chapter-1'}));
      await Promise.resolve();
    });

    expect(latestState.current?.activeProjectId).toBe('project-1');
    expect(latestState.current?.nodes).toEqual([]);

    await act(async () => {
      await latestState.current?.addProject('New Project');
    });

    expect(latestState.current?.activeProjectId).toBe('project-1');
    expect(latestState.current?.nodes).toEqual([]);

    await act(async () => {
      graphListener?.(nextGraph);
      await Promise.resolve();
    });

    expect(latestState.current?.activeProjectId).toBe('project-2');
    expect(latestState.current?.nodes).toEqual(nextGraph.nodes);
  });

  it('replaces projection subscriptions when reload is called', async () => {
    const initialGraph = createEmptyGraphModel();
    const reloadedGraph = createNodeGraphModel();
    const newerGraph: StoredGraphModel = {
      ...reloadedGraph,
      nodes: [{...reloadedGraph.nodes[0], id: 'node-2', label: 'Node 2'}],
    };
    const initialScope = {projectId: 'project-1', chapterId: 'chapter-1'};
    const reloadedScope = {projectId: 'project-2', chapterId: 'chapter-2'};
    let firstGraphListener: ((graph: StoredGraphModel) => void) | null = null;
    let secondGraphListener: ((graph: StoredGraphModel) => void) | null = null;

    loadGraphApplicationMock
      .mockResolvedValueOnce({
        model: {
          load: vi.fn(async () => initialGraph),
          setScope: vi.fn(async () => initialGraph),
          getSnapshot: vi.fn(() => initialGraph),
          getWorkspace: vi.fn(() => ({projects: [], chaptersByProjectId: {}})),
          getScope: vi.fn(() => initialScope),
          subscribeToWorkspace: vi.fn(() => ({unsubscribe: vi.fn()})),
          createScopedGraphView: vi.fn(() => ({
            getSnapshot: () => initialGraph,
            getScope: () => initialScope,
            setScope: vi.fn(async () => initialGraph),
            subscribe: (listener: (graph: StoredGraphModel) => void) => {
              firstGraphListener = listener;
              return {unsubscribe: vi.fn()};
            },
          })),
        },
        graphModel: initialGraph,
        eventBackup: {},
      })
      .mockResolvedValueOnce({
        model: {
          load: vi.fn(async () => reloadedGraph),
          setScope: vi.fn(async () => reloadedGraph),
          getSnapshot: vi.fn(() => reloadedGraph),
          getWorkspace: vi.fn(() => ({projects: [], chaptersByProjectId: {}})),
          getScope: vi.fn(() => reloadedScope),
          subscribeToWorkspace: vi.fn(() => ({unsubscribe: vi.fn()})),
          createScopedGraphView: vi.fn(() => ({
            getSnapshot: () => reloadedGraph,
            getScope: () => reloadedScope,
            setScope: vi.fn(async () => reloadedGraph),
            subscribe: (listener: (graph: StoredGraphModel) => void) => {
              secondGraphListener = listener;
              return {unsubscribe: vi.fn()};
            },
          })),
        },
        graphModel: reloadedGraph,
        eventBackup: {},
      });

    const latestState = {current: null as ReturnType<typeof useGraphModel> | null};
    function HookHarness(props: {activeProjectId?: string | null; activeChapterId?: string | null}) {
      const state = useGraphModel(props);
      useEffect(() => {
        latestState.current = state;
      }, [state]);
      return null;
    }

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(HookHarness, {activeProjectId: 'project-1', activeChapterId: 'chapter-1'}));
      await Promise.resolve();
    });

    await act(async () => {
      await latestState.current?.reload();
    });

    await act(async () => {
      firstGraphListener?.(initialGraph);
      await Promise.resolve();
    });

    expect(latestState.current?.nodes).toEqual([]);

    await act(async () => {
      secondGraphListener?.(newerGraph);
      await Promise.resolve();
    });

    expect(latestState.current?.activeProjectId).toBe('project-2');
    expect(latestState.current?.nodes).toEqual(newerGraph.nodes);
  });
});
