import { describe, expect, it } from 'vitest';
import { Events, type NodePropertyExampleValues, type NodePropertySchema } from './events';

describe('Events', () => {
  it('creates separated node property events with nodeId-only tags', () => {
    const schema: NodePropertySchema[] = [
      {
        propertyId: 'prop-title',
        name: 'title',
        type: 'string',
        optional: true,
      },
      {
        propertyId: 'prop-lines',
        name: 'lines',
        type: 'Object',
        list: true,
        properties: [
          {propertyId: 'prop-sku', name: 'sku', type: 'string'},
          {propertyId: 'prop-quantity', name: 'quantity', type: 'number'},
        ],
      },
    ];
    const exampleValues: NodePropertyExampleValues[] = [
      {propertyId: 'prop-title', scalarValue: 'Checkout completed'},
      {
        propertyId: 'prop-lines',
        complexListValues: [
          {'prop-sku': 'ABC-123', 'prop-quantity': '2'},
        ],
      },
    ];

    expect(Events.nodeSchemaChanged('node-1', schema)).toEqual({
      type: 'NodeSchemaChanged',
      payload: {nodeId: 'node-1', schema},
      tags: ['nodeId:node-1'],
    });
    expect(Events.nodeExampleValuesChanged('node-1', exampleValues)).toEqual({
      type: 'NodeExampleValuesChanged',
      payload: {nodeId: 'node-1', exampleValues},
      tags: ['nodeId:node-1'],
    });
  });

  it('creates tagged events for every persistent graph mutation', () => {
    expect(Events.nodeAdded('node-1', 'cmd', 2, 'Create Thing')).toEqual({
      type: 'NodeAdded',
      payload: { nodeId: 'node-1', type: 'cmd', laneId: 2, label: 'Create Thing' },
      tags: ['nodeId:node-1', 'type:cmd'],
    });
    expect(Events.nodeRenamed('node-1', 'Renamed Thing')).toEqual({
      type: 'NodeRenamed',
      payload: { nodeId: 'node-1', newName: 'Renamed Thing' },
      tags: ['nodeId:node-1'],
    });
    expect(Events.nodeRemoved('node-1')).toEqual({
      type: 'NodeRemoved',
      payload: { nodeId: 'node-1' },
      tags: ['nodeId:node-1'],
    });
    expect(Events.nodeTypeChanged('node-1', 'dm')).toEqual({
      type: 'NodeTypeChanged',
      payload: { nodeId: 'node-1', newType: 'dm' },
      tags: ['nodeId:node-1', 'type:dm'],
    });
    expect(Events.nodesConnected('node-1', 'node-2', 'back-reference')).toEqual({
      type: 'NodesConnected',
      payload: { sourceNodeId: 'node-1', targetNodeId: 'node-2', role: 'back-reference' },
      tags: ['nodeId:node-1', 'nodeId:node-2', 'role:back-reference'],
    });
    expect(Events.nodesDisconnected('node-1', 'node-2')).toEqual({
      type: 'NodesDisconnected',
      payload: { sourceNodeId: 'node-1', targetNodeId: 'node-2' },
      tags: ['nodeId:node-1', 'nodeId:node-2', 'connection:node-1->node-2'],
    });
  });

  it('creates tagged workspace metadata events for projects and chapters', () => {
    expect(Events.projectAdded('project-1', 'Checkout System')).toEqual({
      type: 'ProjectAdded',
      payload: {projectId: 'project-1', name: 'Checkout System'},
      tags: ['projectId:project-1'],
    });
    expect(Events.projectRenamed('project-1', 'Renamed Project')).toEqual({
      type: 'ProjectRenamed',
      payload: {projectId: 'project-1', newName: 'Renamed Project'},
      tags: ['projectId:project-1'],
    });
    expect(Events.chapterAdded('project-1', 'chapter-1', 'Overview')).toEqual({
      type: 'ChapterAdded',
      payload: {projectId: 'project-1', chapterId: 'chapter-1', title: 'Overview'},
      tags: ['projectId:project-1', 'chapterId:chapter-1'],
    });
    expect(Events.chapterRenamed('project-1', 'chapter-1', 'Renamed Chapter')).toEqual({
      type: 'ChapterRenamed',
      payload: {projectId: 'project-1', chapterId: 'chapter-1', newTitle: 'Renamed Chapter'},
      tags: ['projectId:project-1', 'chapterId:chapter-1'],
    });
  });
});
