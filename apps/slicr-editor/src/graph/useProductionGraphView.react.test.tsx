// @vitest-environment jsdom

import {act, useRef} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, describe, expect, it} from 'vitest';
import type {EditorSnapshot} from '../application/productionEditorPort';
import {useProductionGraphView} from './useProductionGraphView';

const snapshot: EditorSnapshot = {
  revision: 'observed-revision',
  scope: {projectId: 'project', chapterId: 'chapter'},
  nodes: [
    {id: 'source', label: 'Source', type: 'evt', laneId: 'lane-0', width: 200, height: 80},
    {id: 'target', label: 'Target', type: 'cmd', laneId: 'lane-1', width: 200, height: 80},
  ],
  edges: [{id: 'edge-source-target', sourceId: 'source', targetId: 'target', role: 'flow'}],
  lanes: [
    {id: 'lane-0', order: 0},
    {id: 'lane-1', order: 1},
  ],
  nodeSchemas: {},
  nodeExampleValues: {},
};

let root: Root | null = null;
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
});

describe('production graph view', () => {
  it.each(['standalone', 'project'])('lays out the %s port snapshot and marks focused connections', async () => {
    const container = document.createElement('div');
    root = createRoot(container);
    function Harness() {
      const measurementRef = useRef<HTMLDivElement>(null);
      const view = useProductionGraphView({
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        lanes: snapshot.lanes,
        focusedNodeId: 'target',
        nodePropertiesById: {},
        editingNodeId: null,
        draftLabel: '',
        measurementRef,
      });
      return (
        <div ref={measurementRef}>
          <output>
            {JSON.stringify({
              layoutOk: view.layoutResult.ok,
              nodeIds: view.renderedNodes.map(({id}) => id),
              edges: view.renderedEdges.map(({id, isConnectedToFocusedNode}) => ({id, isConnectedToFocusedNode})),
              settled: view.isMeasurementSettled,
            })}
          </output>
        </div>
      );
    }
    await act(async () => {
      root?.render(<Harness />);
    });
    expect(JSON.parse(container.querySelector('output')?.textContent ?? '')).toEqual({
      layoutOk: true,
      nodeIds: ['source', 'target'],
      edges: [{id: 'edge-source-target', isConnectedToFocusedNode: true}],
      settled: true,
    });
    expect(snapshot.revision).toBe('observed-revision');
  });
});
