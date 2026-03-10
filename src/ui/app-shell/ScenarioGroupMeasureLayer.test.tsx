// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ScenarioGroupMeasureLayer } from './ScenarioGroupMeasureLayer';
import type { DiagramScenarioGroup } from '../../diagram/rendererContract';

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

function renderLayer(overviewNodeDataVisible: boolean) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = ReactDOM.createRoot(host);

  const scenarioGroups: DiagramScenarioGroup[] = [{
    key: 'overview-scenario-group-slice-a',
    sliceId: 'slice-a',
    sliceName: 'Slice A',
    left: 0,
    top: 0,
    width: 240,
    height: 180,
    scenarios: [{
      name: 'Scenario',
      srcRange: { from: 0, to: 0 },
      given: [{
        key: 'scenario-given',
        type: 'evt',
        title: 'scenario-given',
        prefix: 'evt',
        srcRange: { from: 1, to: 2 },
        node: {
          type: 'evt',
          name: 'scenario-given',
          alias: null,
          stream: null,
          key: 'scenario-given',
          data: { Note: 'Scenario data' },
          srcRange: { from: 1, to: 2 }
        }
      }],
      when: null,
      then: []
    }]
  }];

  act(() => {
    root?.render(
      <ScenarioGroupMeasureLayer
        scenarioGroups={scenarioGroups}
        overviewNodeDataVisible={overviewNodeDataVisible}
      />
    );
  });
}

describe('ScenarioGroupMeasureLayer', () => {
  it('hides scenario node data rows when overview node data is hidden', () => {
    renderLayer(false);

    expect(document.querySelectorAll('.scenario-group-measure-layer .node-fields')).toHaveLength(0);
    expect(document.querySelector('.scenario-group-measure-layer .node-title')?.textContent).toContain('scenario-given');
    expect(document.querySelector('.scenario-group-measure-layer')?.textContent).not.toContain('Scenario data');
  });
});
