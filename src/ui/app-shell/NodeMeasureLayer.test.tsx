// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { DiagramSection } from '../../application/appViewModel';
import type { Parsed, VisualNode } from '../../domain/types';
import { MISSING_DATA_VALUE } from '../../domain/dataMapping';
import { formatNodeData } from '../../domain/formatNodeData';
import { NODE_MEASURE_NODE_CLASS } from '../../nodeMeasurement';
import { NodeMeasureLayer } from './NodeMeasureLayer';

let root: ReactDOM.Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root && host) {
    act(() => root?.unmount());
  }
  root = null;
  host = null;
  document.body.innerHTML = '';
});

function node(key: string, type: string, name: string): VisualNode {
  return {
    key,
    type,
    name,
    alias: null,
    stream: null,
    data: null,
    srcRange: { from: 0, to: 0 }
  };
}

function renderLayer(parsed: Parsed) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);

  const diagram = { parsed } as DiagramSection;
  const constants = {
    TYPE_LABEL: { cmd: 'cmd' },
    NODE_VERSION_SUFFIX: /$/,
    NODE_MEASURE_NODE_CLASS,
    MISSING_DATA_VALUE,
    formatNodeData
  };

  act(() => {
    root?.render(<NodeMeasureLayer diagram={diagram} constants={constants as never} />);
  });
}

describe('NodeMeasureLayer', () => {
  it('renders measure nodes only for diagram nodes', () => {
    const diagramNode = node('cmd:add-todo', 'cmd', 'add-todo');
    const scenarioNode = node('scn:1:cmd:add-todo', 'cmd', 'add-todo');

    renderLayer({
      sliceName: 'Todo',
      nodes: new Map([
        [diagramNode.key, diagramNode],
        [scenarioNode.key, scenarioNode]
      ]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [{
        name: 'Scenario',
        srcRange: { from: 0, to: 0 },
        given: [],
        when: { key: scenarioNode.key, type: scenarioNode.type, name: scenarioNode.name, alias: null, srcRange: { from: 0, to: 0 } },
        then: []
      }],
      scenarioOnlyNodeKeys: [scenarioNode.key]
    });

    expect(document.querySelector(`[data-node-key="${diagramNode.key}"]`)).not.toBeNull();
    expect(document.querySelector(`[data-node-key="${scenarioNode.key}"]`)).toBeNull();
  });

  it('uses NodeCard markup inside an individual measure cell per node', () => {
    const firstNode = node('cmd:add-todo', 'cmd', 'add-todo');
    const secondNode = node('evt:todo-added', 'evt', 'todo-added');

    renderLayer({
      sliceName: 'Todo',
      nodes: new Map([
        [firstNode.key, firstNode],
        [secondNode.key, secondNode]
      ]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    });

    const cells = [...document.querySelectorAll('.node-measure-cell')];
    expect(cells).toHaveLength(2);
    expect(cells.every((cell) => cell.querySelector('.node-measure-node') !== null)).toBe(true);
    expect(document.querySelector('.node-measure-header')).toBeNull();
  });
});
