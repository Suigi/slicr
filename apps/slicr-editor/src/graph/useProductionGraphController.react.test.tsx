// @vitest-environment jsdom
import {act, createElement, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {EditorAction} from '../application/productionEditorPort';
import {useProductionGraphController} from './useProductionGraphController';

const node = (id: string, type: 'ui' | 'evt' = 'ui') => ({id, label: id, type, laneId: 'lane-0', width: 180, height: 80});
const nodes = [node('a'), node('b', 'evt')];
const edges = [{id: 'edge-a-b', sourceId: 'a', targetId: 'b'}];
const lanes = [{id: 'lane-0', order: 0}];
const environment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};
environment.IS_REACT_ACT_ENVIRONMENT = true;

describe('shared production graph controller', () => {
  const container = document.createElement('div');
  let root: ReturnType<typeof createRoot> | null = null;
  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    container.remove();
  });

  it('maps create, cycle-safe connect, disconnect and edit gestures to typed semantic actions', async () => {
    const actions: EditorAction[] = [];
    let current: ReturnType<typeof useProductionGraphController>;
    function Harness() {
      const controller = useProductionGraphController({
        nodes,
        edges,
        lanes,
        chapterId: 'chapter-1',
        execute: async (action) => {
          actions.push(action);
          return {revision: 'next', createdIds: ['created']};
        },
      });
      useEffect(() => {
        current = controller;
      }, [controller]);
      return null;
    }
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root?.render(createElement(Harness)));
    await act(async () => {
      await current!.addNewSlice();
    });
    expect(current!.focusedNodeId).toBe('created');
    expect(current!.editingNodeId).toBe('created');
    await act(async () => {
      current!.addConnectedNode(nodes[0], 'top');
      await Promise.resolve();
    });
    await act(async () => {
      current!.startConnectingFromNode('b');
    });
    await act(async () => {
      current!.onNodeClick(nodes[0]);
      await Promise.resolve();
      current!.deleteConnection('edge-a-b');
      current!.setNodeType('a', 'evt');
      await Promise.resolve();
    });
    expect(actions).toContainEqual({type: 'AddNode', data: {chapterId: 'chapter-1', nodeType: 'ui', laneId: 0, label: 'Node 3'}});
    expect(actions).toContainEqual({
      type: 'AddConnectedNode',
      data: {chapterId: 'chapter-1', sourceNodeId: 'a', nodeType: 'ui', laneId: -1, direction: 'top', label: 'Node 3'},
    });
    expect(actions).toContainEqual({
      type: 'ConnectNodes',
      data: {sourceNodeId: 'b', targetNodeId: 'a', role: 'back-reference'},
    });
    expect(actions).toContainEqual({
      type: 'DisconnectNodes',
      data: {edgeId: 'edge-a-b', sourceNodeId: 'a', targetNodeId: 'b'},
    });
    expect(actions).toContainEqual({type: 'ChangeNodeType', data: {nodeId: 'a', newType: 'evt'}});
    await act(async () => {
      current!.startEditingNode(nodes[0]);
      current!.setDraftLabel('  Edited  ');
    });
    await act(async () => {
      current!.saveEditingNode();
      await Promise.resolve();
    });
    expect(actions).toContainEqual({type: 'RenameNode', data: {nodeId: 'a', name: 'Edited'}});
  });

  it('resets transient state while leaving persistence and focused-node flush to caller policies', async () => {
    const onFocusChange = vi.fn();
    const onCancelEdit = vi.fn();
    let current: ReturnType<typeof useProductionGraphController>;
    function Harness() {
      const controller = useProductionGraphController({nodes, edges, lanes, chapterId: 'c', execute: vi.fn(), onFocusChange, onCancelEdit});
      useEffect(() => {
        current = controller;
      }, [controller]);
      return null;
    }
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root?.render(createElement(Harness)));
    await act(async () => {
      current!.startEditingNode(nodes[0]);
      current!.setEditorFocusedPropertyId('property');
      current!.setHoveredPropertyId('hovered');
    });
    await act(async () => current!.cancelEditingFromKeyboard());
    expect(onCancelEdit).toHaveBeenCalledWith('a', 'a');
    expect(current!.editingNodeId).toBeNull();
    await act(async () => {
      current!.resetTransientState();
      current!.setFocusedNodeId(null);
    });
    expect(onFocusChange).toHaveBeenLastCalledWith(null);
    expect(current!.highlightedPropertyId).toBeNull();
  });
});
