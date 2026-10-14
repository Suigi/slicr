import {describe, expect, it} from 'vitest';

import {serializeVisualGraphAcceptanceTest} from './visualGraphExport';

describe('visual graph export', () => {
  it('serializes the current layout as a pasteable layout-lib vitest acceptance test', () => {
    const exported = serializeVisualGraphAcceptanceTest({
      nodes: [{id: 'node-1', laneId: 'lane-0', width: 180, height: 86}],
      edges: [{id: 'edge-node-1-node-2', sourceId: 'node-1', targetId: 'node-2', role: 'back-reference'}],
      lanes: [{id: 'lane-0', order: 0}],
      defaults: {nodeWidth: 180, nodeHeight: 86},
      spacing: {laneMargin: 0, laneGap: 100, minTargetShift: 20, minNodeGap: 40},
      result: {
        lanes: [{id: 'lane-0', top: -43, bottom: 43}],
        nodes: [{id: 'node-1', x: 0, y: 0, width: 180, height: 86}],
        edges: [
          {
            id: 'edge-node-1-node-2',
            sourceId: 'node-1',
            targetId: 'node-2',
            sourceAnchor: {x: 180, y: 43, side: 'right', ordinal: 0},
            targetAnchor: {x: 200, y: 43, side: 'left', ordinal: 0},
            points: [
              {x: 180, y: 43},
              {x: 200, y: 43},
            ],
          },
        ],
      },
    });

    expect(exported).toContain('import {compactLayout, type LayoutRequest} from "layout-lib";');
    expect(exported).toContain('const request: LayoutRequest = {');
    expect(exported).toContain('{\n      id: "node-1",\n      laneId: "lane-0",\n      width: 180,\n      height: 86\n    }');
    expect(exported).toContain('role: "back-reference"');
    expect(exported).toContain('expect(result.result.nodes).toEqual(');
    expect(exported).toContain('sourceAnchor: {\n      x: 180,');
  });
});
