import {describe, expect, it} from 'vitest';

import type {ModelGraph} from '../domain/graph';
import {adaptModelGraphToRenderer} from './domainGraphAdapter';
import {NODE_HEIGHT, NODE_WIDTH} from './constants';

describe('adaptModelGraphToRenderer', () => {
  it('maps empty and populated domain graphs to renderer inputs', () => {
    expect(adaptModelGraphToRenderer({nodes: [], edges: [], lanes: [], nodeSchemas: {}, nodeExampleValues: {}})).toEqual({
      nodes: [],
      edges: [],
      lanes: [],
      nodeSchemas: {},
      nodeExampleValues: {},
    });

    const model: ModelGraph = {
      nodes: [
        {nodeId: 'cmd-1', nodeType: 'cmd', laneId: 2, label: 'Command'},
        {nodeId: 'evt-1', nodeType: 'evt', laneId: 5, label: 'Event'},
      ],
      edges: [{sourceNodeId: 'evt-1', targetNodeId: 'cmd-1', role: 'back-reference'}],
      lanes: [
        {id: 'lane-2', order: 2},
        {id: 'lane-5', order: 5},
      ],
      nodeSchemas: {
        'cmd-1': [{propertyId: 'prop-title', name: 'title', type: 'string'}],
      },
      nodeExampleValues: {
        'cmd-1': [{propertyId: 'prop-title', scalarValue: 'Checkout completed'}],
      },
    };

    expect(adaptModelGraphToRenderer(model)).toEqual({
      nodes: [
        {
          id: 'cmd-1',
          label: 'Command',
          type: 'cmd',
          laneId: 'lane-2',
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        },
        {
          id: 'evt-1',
          label: 'Event',
          type: 'evt',
          laneId: 'lane-5',
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        },
      ],
      edges: [
        {
          id: 'edge-evt-1-cmd-1',
          sourceId: 'evt-1',
          targetId: 'cmd-1',
          role: 'back-reference',
        },
      ],
      lanes: [
        {id: 'lane-2', order: 2},
        {id: 'lane-5', order: 5},
      ],
      nodeSchemas: {
        'cmd-1': [{propertyId: 'prop-title', name: 'title', type: 'string'}],
      },
      nodeExampleValues: {
        'cmd-1': [{propertyId: 'prop-title', scalarValue: 'Checkout completed'}],
      },
    });
  });
});
