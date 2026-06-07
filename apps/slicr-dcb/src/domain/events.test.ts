import { describe, expect, it } from 'vitest';
import { Events, type NodePropertyExampleValues, type NodePropertySchema } from './events';

describe('Events', () => {
  it('creates project-scoped tagged events for every persistent graph mutation', () => {
    const projectId = 'project-1';
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

    expect(Events.nodeAdded(projectId, 'node-1', 'cmd', 2, 'Create Thing')).toEqual({
      type: 'NodeAdded',
      payload: { projectId, nodeId: 'node-1', type: 'cmd', laneId: 2, label: 'Create Thing' },
      tags: ['projectId:project-1', 'nodeId:node-1', 'type:cmd'],
    });
    expect(Events.nodeRenamed(projectId, 'node-1', 'Renamed Thing')).toEqual({
      type: 'NodeRenamed',
      payload: { projectId, nodeId: 'node-1', newName: 'Renamed Thing' },
      tags: ['projectId:project-1', 'nodeId:node-1'],
    });
    expect(Events.nodeRemoved(projectId, 'node-1')).toEqual({
      type: 'NodeRemoved',
      payload: { projectId, nodeId: 'node-1' },
      tags: ['projectId:project-1', 'nodeId:node-1'],
    });
    expect(Events.nodeTypeChanged(projectId, 'node-1', 'dm')).toEqual({
      type: 'NodeTypeChanged',
      payload: { projectId, nodeId: 'node-1', newType: 'dm' },
      tags: ['projectId:project-1', 'nodeId:node-1', 'type:dm'],
    });
    expect(Events.nodeSchemaChanged(projectId, 'node-1', schema)).toEqual({
      type: 'NodeSchemaChanged',
      payload: {projectId, nodeId: 'node-1', schema},
      tags: ['projectId:project-1', 'nodeId:node-1'],
    });
    expect(Events.nodeExampleValuesChanged(projectId, 'node-1', exampleValues)).toEqual({
      type: 'NodeExampleValuesChanged',
      payload: {projectId, nodeId: 'node-1', exampleValues},
      tags: ['projectId:project-1', 'nodeId:node-1'],
    });
    expect(Events.nodesConnected(projectId, 'node-1', 'node-2', 'back-reference')).toEqual({
      type: 'NodesConnected',
      payload: { projectId, sourceNodeId: 'node-1', targetNodeId: 'node-2', role: 'back-reference' },
      tags: ['projectId:project-1', 'nodeId:node-1', 'nodeId:node-2', 'role:back-reference', 'connection:node-1->node-2'],
    });
    expect(Events.nodesDisconnected(projectId, 'node-1', 'node-2')).toEqual({
      type: 'NodesDisconnected',
      payload: { projectId, sourceNodeId: 'node-1', targetNodeId: 'node-2' },
      tags: ['projectId:project-1', 'nodeId:node-1', 'nodeId:node-2', 'connection:node-1->node-2'],
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
