// @vitest-environment jsdom

import {act, createElement, useEffect} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {EditorSnapshot, ProductionEditorPort} from '../application/productionEditorPort';
import {NODE_HEIGHT, NODE_WIDTH} from './constants';
import {useGraphModel} from './useGraphModel';

const loadGraphApplicationMock = vi.hoisted(() => vi.fn());
vi.mock('../application/graphApplicationLoader', () => ({loadGraphApplication: loadGraphApplicationMock}));

const scope = {projectId: 'project-1', chapterId: 'chapter-1'};
const node = (id: string, label = 'Same label') => ({
  id,
  label,
  type: 'ui' as const,
  laneId: 'lane-0',
  width: NODE_WIDTH,
  height: NODE_HEIGHT,
});
const snapshot = (revision: string, nodes: EditorSnapshot['nodes'] = [], nextScope = scope): EditorSnapshot => ({
  revision,
  scope: nextScope,
  nodes,
  edges: [],
  lanes: [{id: 'lane-0', order: 0}],
  nodeSchemas: {},
  nodeExampleValues: {},
});

describe('useGraphModel port routing', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  const state = {current: null as ReturnType<typeof useGraphModel> | null};
  let listener: ((value: EditorSnapshot) => void) | undefined;
  let unsubscribe: ReturnType<typeof vi.fn<() => void>>;
  let port: ProductionEditorPort;

  function Harness() {
    const model = useGraphModel({activeProjectId: scope.projectId, activeChapterId: scope.chapterId});
    useEffect(() => {
      state.current = model;
    }, [model]);
    return null;
  }

  async function mount(initial = snapshot('r1', [node('existing')])) {
    unsubscribe = vi.fn<() => void>();
    port = {
      getSnapshot: vi.fn(async () => initial),
      subscribe: vi.fn((_scope: typeof scope, callback: (value: EditorSnapshot) => void) => {
        let active = true;
        listener = (value) => {
          if (active) callback(value);
        };
        return {
          unsubscribe: () => {
            active = false;
            unsubscribe();
          },
        };
      }),
      execute: vi.fn(async () => ({revision: 'r2', createdIds: []})),
    };
    const workspace = {projects: [], chaptersByProjectId: {}};
    loadGraphApplicationMock.mockResolvedValue({
      editorPort: port,
      workspace: {
        getWorkspaceSnapshot: () => workspace,
        subscribeToWorkspace: vi.fn((callback) => {
          callback(workspace);
          return {unsubscribe: vi.fn()};
        }),
      },
      graph: {
        setScope: vi.fn(async () => ({})),
        getScope: () => scope,
        subscribe: vi.fn(() => {
          throw new Error('Direct graph subscription forbidden');
        }),
      },
      commands: new Proxy(
        {},
        {
          get: () => {
            throw new Error('Direct command forbidden');
          },
        },
      ),
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(Harness));
      await Promise.resolve();
    });
  }

  afterEach(() => {
    if (root) act(() => root?.unmount());
    expect(unsubscribe).toHaveBeenCalled();
    root = null;
    container?.remove();
    container = null;
    listener = undefined;
    state.current = null;
    loadGraphApplicationMock.mockReset();
    vi.useRealTimers();
  });

  it('routes each standalone action with the observed scope and revision, not a fresh basis', async () => {
    await mount();
    await act(async () => {
      state.current?.addNewSlice();
      state.current?.addConnection('existing', 'target');
      state.current?.deleteConnection('edge-1');
      state.current?.setNodeType('existing', 'evt');
      state.current?.deleteNode('existing');
      await state.current?.renameProject('project-1', 'Renamed');
      await state.current?.addChapter('Chapter');
      await state.current?.addProject('Project');
    });
    expect(vi.mocked(port.execute).mock.calls.map(([command]) => command.type)).toEqual([
      'AddNode',
      'ConnectNodes',
      'DisconnectNodes',
      'ChangeNodeType',
      'DeleteNode',
      'RenameProject',
      'AddChapter',
      'AddProject',
    ]);
    expect(vi.mocked(port.execute).mock.calls.every(([command]) => command.baseRevision === 'r1' && command.scope === scope)).toBe(true);
    await act(async () => {
      listener?.(snapshot('r3', [node('existing')]));
    });
    await act(async () => {
      state.current?.setNodeType('existing', 'cmd');
    });
    expect(port.execute).toHaveBeenLastCalledWith({
      scope,
      baseRevision: 'r3',
      type: 'ChangeNodeType',
      data: {nodeId: 'existing', newType: 'cmd'},
    });
    await act(async () => {
      state.current?.startEditingNode(node('existing'));
    });
    await act(async () => {
      state.current?.setDraftLabel('Edited');
    });
    await act(async () => {
      state.current?.saveEditingNode();
      await Promise.resolve();
    });
    expect(port.execute).toHaveBeenLastCalledWith({
      scope,
      baseRevision: 'r3',
      type: 'RenameNode',
      data: {nodeId: 'existing', name: 'Edited'},
    });
  });

  it('dispatches one ChangeNodeProperties port command with the basis captured at edit time', async () => {
    await mount();
    vi.useFakeTimers();
    await act(async () => {
      state.current?.updateFocusedNodeProperties([{id: 'property-1', name: 'Name', type: 'string', example: 'Ada'}]);
    });
    await act(async () => {
      listener?.(snapshot('r3', [node('existing')]));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(port.execute).toHaveBeenCalledTimes(1);
    expect(port.execute).toHaveBeenCalledWith({
      scope,
      baseRevision: 'r1',
      type: 'ChangeNodeProperties',
      data: {nodeId: 'existing', schema: expect.any(Array), exampleValues: expect.any(Array)},
    });
    const command = vi.mocked(port.execute).mock.calls[0][0];
    expect(command.data.schema).toEqual(expect.arrayContaining([expect.objectContaining({name: 'Name'})]));
    expect(command.data.exampleValues).toEqual(expect.arrayContaining([expect.objectContaining({propertyId: 'property-1'})]));
  });

  it('uses receipt identities, never duplicate labels or list order, and returns the created chapter ID', async () => {
    await mount(snapshot('r1', [node('existing', 'Node 2')]));
    vi.mocked(port.execute).mockImplementation(async (command) => {
      if (command.type === 'AddConnectedNode') return {revision: 'r2', createdIds: ['exact-connected', 'edge-id']};
      if (command.type === 'AddChapter') return {revision: 'r2', createdIds: ['exact-chapter']};
      return {revision: 'r2', createdIds: ['exact-new']};
    });
    await act(async () => {
      state.current?.addNewSlice();
      await Promise.resolve();
    });
    expect(state.current?.editingNodeId).toBe('exact-new');
    await act(async () => {
      state.current?.addConnectedNode(node('existing'), 'right');
      await Promise.resolve();
    });
    expect(state.current?.editingNodeId).toBe('exact-connected');
    await act(async () => {
      expect(await state.current?.addChapter('New')).toBe('exact-chapter');
    });
    expect(port.execute).toHaveBeenCalledWith(expect.objectContaining({type: 'AddConnectedNode', baseRevision: 'r1'}));
  });

  it('replaces the port subscription on reload and ignores the unsubscribed listener', async () => {
    await mount();
    const oldListener = listener;
    vi.mocked(port.getSnapshot).mockResolvedValueOnce(snapshot('r4', [node('reloaded')]));
    await act(async () => {
      await state.current?.reload();
    });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    await act(async () => {
      oldListener?.(snapshot('r2', []));
    });
    expect(state.current?.nodes.map(({id}) => id)).toEqual(['reloaded']);
    await act(async () => {
      listener?.(snapshot('r5', [node('latest')]));
    });
    expect(state.current?.nodes.map(({id}) => id)).toEqual(['latest']);
  });
});
