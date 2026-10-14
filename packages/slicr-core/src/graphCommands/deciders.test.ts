import {describe, it} from 'vitest';
import {expectDecider, expectQuery} from '@slicr/event-sourcing/testing';

import {Events} from '../events';
import {deciders} from './deciders';

describe('graphCommands deciders', () => {
  const projectId = 'project-1';

  describe('addChapter', () => {
    it('emits ChapterAdded for an existing project', async () => {
      await expectDecider(deciders({generateUuid: () => 'chapter-1'}).addChapter)
        .given(Events.projectAdded(projectId, 'Project 1'))
        .when({type: 'AddChapter', data: {projectId, title: 'New Chapter'}})
        .thenEmits(Events.chapterAdded(projectId, 'chapter-1', 'New Chapter'));
    });

    it('throws when the project does not exist', async () => {
      await expectDecider(deciders({generateUuid: () => 'chapter-1'}).addChapter)
        .given()
        .when({type: 'AddChapter', data: {projectId, title: 'New Chapter'}})
        .thenThrows(new Error(`Project with ID [${projectId}] not found`));
    });
  });

  describe('addNode', () => {
    it('emits NodeAdded for an existing chapter', async () => {
      await expectDecider(deciders({generateUuid: () => 'node-1'}).addNode)
        .given(Events.chapterAdded(projectId, 'chapter-1', 'Chapter 1'))
        .when({
          type: 'AddNode',
          data: {projectId, chapterId: 'chapter-1', nodeType: 'evt', laneId: 2, label: 'Create Thing'},
        })
        .thenEmits(Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'evt', 2, 'Create Thing'));
    });

    it('throws when the chapter exists in a different project', async () => {
      await expectDecider(deciders({generateUuid: () => 'node-1'}).addNode)
        .given(Events.chapterAdded('other-project-id', 'chapter-1', 'Chapter 1'))
        .when({
          type: 'AddNode',
          data: {projectId, chapterId: 'chapter-1', nodeType: 'evt', laneId: 2, label: 'Create Thing'},
        })
        .thenThrows(new Error('Chapter with ID [chapter-1] not found'));
    });

    it('throws when the chapter does not exist', async () => {
      await expectDecider(deciders({generateUuid: () => 'node-1'}).addNode)
        .given()
        .when({
          type: 'AddNode',
          data: {projectId, chapterId: 'chapter-1', nodeType: 'evt', laneId: 2, label: 'Create Thing'},
        })
        .thenThrows(new Error('Chapter with ID [chapter-1] not found'));
    });
  });

  describe('addConnectedNode', () => {
    it('emits NodeAdded and NodesConnected for an existing source node', async () => {
      await expectDecider(deciders({generateUuid: () => 'node-2'}).addConnectedNode)
        .given(Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'cmd', 0))
        .when({
          type: 'AddConnectedNode',
          data: {
            projectId,
            chapterId: 'chapter-1',
            sourceNodeId: 'node-1',
            nodeType: 'evt',
            laneId: 1,
            label: 'Thing Happened',
            role: 'back-reference',
          },
        })
        .thenEmits(
          Events.nodeAdded(projectId, 'chapter-1', 'node-2', 'evt', 1, 'Thing Happened'),
          Events.nodesConnected(projectId, 'node-1', 'node-2', 'back-reference'),
        );
    });

    it('throws when the source node is in a different chapter', async () => {
      await expectDecider(deciders({generateUuid: () => 'node-2'}).addConnectedNode)
        .given(Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'cmd', 0))
        .when({
          type: 'AddConnectedNode',
          data: {
            projectId,
            chapterId: 'chapter-2',
            sourceNodeId: 'node-1',
            nodeType: 'evt',
            laneId: 1,
            label: 'Thing Happened',
          },
        })
        .thenThrows(new Error('Node [node-1] is not in chapter [chapter-2]'));
    });

    it('throws when the source node does not exist', async () => {
      await expectDecider(deciders({generateUuid: () => 'node-2'}).addConnectedNode)
        .given()
        .when({
          type: 'AddConnectedNode',
          data: {
            projectId,
            chapterId: 'chapter-1',
            sourceNodeId: 'node-1',
            nodeType: 'evt',
            laneId: 1,
            label: 'Thing Happened',
          },
        })
        .thenThrows(new Error('Unknown nodeId node-1'));
    });
  });

  describe('renameNode', () => {
    it('queries node rename events for the DCB guard', () => {
      const query = deciders().renameNode.query({
        type: 'RenameNode',
        data: {projectId, nodeId: 'node-1', newName: 'New Event Name'},
      });

      expectQuery(query)
        .toMatchEvent(Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'evt', 0))
        .toMatchEvent(Events.nodeRemoved(projectId, 'node-1'))
        .toMatchEvent(Events.nodeRenamed(projectId, 'node-1', 'Intermittent Rename'));
    });

    it('emits NodeRenamed for an existing node', async () => {
      await expectDecider(deciders().renameNode)
        .given(Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'evt', 0))
        .when({type: 'RenameNode', data: {projectId, nodeId: 'node-1', newName: 'New Event Name'}})
        .thenEmits(Events.nodeRenamed(projectId, 'node-1', 'New Event Name'));
    });

    it('emits no event when renaming to the current node name', async () => {
      await expectDecider(deciders().renameNode)
        .given(Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'evt', 0, 'Current Event Name'))
        .when({type: 'RenameNode', data: {projectId, nodeId: 'node-1', newName: 'Current Event Name'}})
        .thenEmits();
    });

    it('emits no event when renaming to the latest renamed node name', async () => {
      await expectDecider(deciders().renameNode)
        .given(
          Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'evt', 0, 'Initial Event Name'),
          Events.nodeRenamed(projectId, 'node-1', 'Current Event Name'),
        )
        .when({type: 'RenameNode', data: {projectId, nodeId: 'node-1', newName: 'Current Event Name'}})
        .thenEmits();
    });

    it('throws when the node does not exist', async () => {
      await expectDecider(deciders().renameNode)
        .given()
        .when({type: 'RenameNode', data: {projectId, nodeId: 'node-1', newName: 'New Event Name'}})
        .thenThrows(new Error('Unknown nodeId node-1'));
    });
  });

  describe('changeNodeType', () => {
    it('queries node type change events for the DCB guard', () => {
      const query = deciders().changeNodeType.query({
        type: 'ChangeNodeType',
        data: {projectId, nodeId: 'node-1', newType: 'dm'},
      });

      expectQuery(query)
        .toMatchEvent(Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'evt', 0))
        .toMatchEvent(Events.nodeRemoved(projectId, 'node-1'))
        .toMatchEvent(Events.nodeTypeChanged(projectId, 'node-1', 'processor'));
    });

    it('emits NodeTypeChanged for an existing node', async () => {
      await expectDecider(deciders().changeNodeType)
        .given(Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'evt', 0))
        .when({type: 'ChangeNodeType', data: {projectId, nodeId: 'node-1', newType: 'dm'}})
        .thenEmits(Events.nodeTypeChanged(projectId, 'node-1', 'dm'));
    });

    it('emits no event when changing to the current node type', async () => {
      await expectDecider(deciders().changeNodeType)
        .given(Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'evt', 0))
        .when({type: 'ChangeNodeType', data: {projectId, nodeId: 'node-1', newType: 'evt'}})
        .thenEmits();
    });

    it('emits no event when changing to the latest changed node type', async () => {
      await expectDecider(deciders().changeNodeType)
        .given(Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'evt', 0), Events.nodeTypeChanged(projectId, 'node-1', 'dm'))
        .when({type: 'ChangeNodeType', data: {projectId, nodeId: 'node-1', newType: 'dm'}})
        .thenEmits();
    });
  });

  describe('deleteNode', () => {
    it('emits NodeRemoved for an existing node', async () => {
      await expectDecider(deciders().deleteNode)
        .given(Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'evt', 0))
        .when({type: 'DeleteNode', data: {projectId, nodeId: 'node-1'}})
        .thenEmits(Events.nodeRemoved(projectId, 'node-1'));
    });
  });

  describe('changeNodeSchema', () => {
    it('throws when the node does not exist', async () => {
      await expectDecider(deciders().changeNodeSchema)
        .given()
        .when({type: 'ChangeNodeSchema', data: {projectId, nodeId: 'node-1', schema: []}})
        .thenThrows(new Error('Unknown nodeId node-1'));
    });

    it('emits NodeSchemaChanged only when the schema differs', async () => {
      const schema = [{propertyId: 'prop-total', name: 'total', type: 'number' as const}];

      await expectDecider(deciders().changeNodeSchema)
        .given(
          Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'evt', 0),
          Events.nodeSchemaChanged(projectId, 'node-1', [
            {
              propertyId: 'prop-title',
              name: 'title',
              type: 'string' as const,
            },
          ]),
        )
        .when({type: 'ChangeNodeSchema', data: {projectId, nodeId: 'node-1', schema}})
        .thenEmits(Events.nodeSchemaChanged(projectId, 'node-1', schema));

      await expectDecider(deciders().changeNodeSchema)
        .given(Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'evt', 0), Events.nodeSchemaChanged(projectId, 'node-1', schema))
        .when({type: 'ChangeNodeSchema', data: {projectId, nodeId: 'node-1', schema}})
        .thenEmits();
    });
  });

  describe('changeNodeExampleValues', () => {
    it('throws when the node does not exist', async () => {
      await expectDecider(deciders().changeNodeExampleValues)
        .given()
        .when({type: 'ChangeNodeExampleValues', data: {projectId, nodeId: 'node-1', exampleValues: []}})
        .thenThrows(new Error('Unknown nodeId node-1'));
    });

    it('emits NodeExampleValuesChanged only when the example values differ', async () => {
      const exampleValues = [{propertyId: 'prop-title', scalarValue: 'New title'}];

      await expectDecider(deciders().changeNodeExampleValues)
        .given(
          Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'evt', 0),
          Events.nodeExampleValuesChanged(projectId, 'node-1', [{propertyId: 'prop-title', scalarValue: 'Old title'}]),
        )
        .when({type: 'ChangeNodeExampleValues', data: {projectId, nodeId: 'node-1', exampleValues}})
        .thenEmits(Events.nodeExampleValuesChanged(projectId, 'node-1', exampleValues));

      await expectDecider(deciders().changeNodeExampleValues)
        .given(
          Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'evt', 0),
          Events.nodeExampleValuesChanged(projectId, 'node-1', exampleValues),
        )
        .when({type: 'ChangeNodeExampleValues', data: {projectId, nodeId: 'node-1', exampleValues}})
        .thenEmits();
    });
  });

  describe('connectNodes', () => {
    it('emits NodesConnected for existing nodes', async () => {
      await expectDecider(deciders().connectNodes)
        .given(Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'cmd', 0), Events.nodeAdded(projectId, 'chapter-1', 'node-2', 'evt', 1))
        .when({
          type: 'ConnectNodes',
          data: {projectId, sourceNodeId: 'node-1', targetNodeId: 'node-2', role: 'back-reference'},
        })
        .thenEmits(Events.nodesConnected(projectId, 'node-1', 'node-2', 'back-reference'));
    });

    it('emits no event for self-connections', async () => {
      await expectDecider(deciders().connectNodes)
        .given(Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'cmd', 0))
        .when({type: 'ConnectNodes', data: {projectId, sourceNodeId: 'node-1', targetNodeId: 'node-1'}})
        .thenEmits();
    });

    it('emits no event when the connection already exists', async () => {
      await expectDecider(deciders().connectNodes)
        .given(
          Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'cmd', 0),
          Events.nodeAdded(projectId, 'chapter-1', 'node-2', 'evt', 1),
          Events.nodesConnected(projectId, 'node-1', 'node-2'),
        )
        .when({type: 'ConnectNodes', data: {projectId, sourceNodeId: 'node-1', targetNodeId: 'node-2'}})
        .thenEmits();
    });

    it('throws when the source node was removed', async () => {
      await expectDecider(deciders().connectNodes)
        .given(
          Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'cmd', 0),
          Events.nodeAdded(projectId, 'chapter-1', 'node-2', 'evt', 1),
          Events.nodeRemoved(projectId, 'node-1'),
        )
        .when({type: 'ConnectNodes', data: {projectId, sourceNodeId: 'node-1', targetNodeId: 'node-2'}})
        .thenThrows(new Error('Unknown nodeId node-1'));
    });

    it('throws when the target node was removed', async () => {
      await expectDecider(deciders().connectNodes)
        .given(
          Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'cmd', 0),
          Events.nodeAdded(projectId, 'chapter-1', 'node-2', 'evt', 1),
          Events.nodeRemoved(projectId, 'node-2'),
        )
        .when({type: 'ConnectNodes', data: {projectId, sourceNodeId: 'node-1', targetNodeId: 'node-2'}})
        .thenThrows(new Error('Unknown nodeId node-2'));
    });
  });

  describe('disconnectNodes', () => {
    it('emits NodesDisconnected for an active connection', async () => {
      await expectDecider(deciders().disconnectNodes)
        .given(
          Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'cmd', 0),
          Events.nodeAdded(projectId, 'chapter-1', 'node-2', 'evt', 1),
          Events.nodesConnected(projectId, 'node-1', 'node-2'),
        )
        .when({type: 'DisconnectNodes', data: {projectId, sourceNodeId: 'node-1', targetNodeId: 'node-2'}})
        .thenEmits(Events.nodesDisconnected(projectId, 'node-1', 'node-2'));
    });

    it('emits no event when the connection is missing', async () => {
      await expectDecider(deciders().disconnectNodes)
        .given(Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'cmd', 0), Events.nodeAdded(projectId, 'chapter-1', 'node-2', 'evt', 1))
        .when({type: 'DisconnectNodes', data: {projectId, sourceNodeId: 'node-1', targetNodeId: 'node-2'}})
        .thenEmits();
    });

    it('throws when the source node was removed', async () => {
      await expectDecider(deciders().disconnectNodes)
        .given(
          Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'cmd', 0),
          Events.nodeAdded(projectId, 'chapter-1', 'node-2', 'evt', 1),
          Events.nodesConnected(projectId, 'node-1', 'node-2'),
          Events.nodeRemoved(projectId, 'node-1'),
        )
        .when({type: 'DisconnectNodes', data: {projectId, sourceNodeId: 'node-1', targetNodeId: 'node-2'}})
        .thenThrows(new Error('Unknown nodeId node-1'));
    });

    it('throws when the target node was removed', async () => {
      await expectDecider(deciders().disconnectNodes)
        .given(
          Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'cmd', 0),
          Events.nodeAdded(projectId, 'chapter-1', 'node-2', 'evt', 1),
          Events.nodesConnected(projectId, 'node-1', 'node-2'),
          Events.nodeRemoved(projectId, 'node-2'),
        )
        .when({type: 'DisconnectNodes', data: {projectId, sourceNodeId: 'node-1', targetNodeId: 'node-2'}})
        .thenThrows(new Error('Unknown nodeId node-2'));
    });
  });
});
