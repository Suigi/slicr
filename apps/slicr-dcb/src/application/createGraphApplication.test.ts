import {beforeEach, describe, expect, it} from 'vitest';

import {createGraphApplication} from './createGraphApplication';
import {createDefaultGraphEventStore} from './graphEventStores';
import {Events} from '../domain/events';

const defaultChapterId = 'default-chapter';

describe('createGraphApplication', () => {
  beforeEach(async () => {
    const stores = await createDefaultGraphEventStore();
    await stores.graphStore.restoreBackup([]);
  });

  it('returns initially caught-up default workspace and empty graph snapshots from an empty store', async () => {
    const application = await createGraphApplication();
    const workspace = application.model.getWorkspace();
    const defaultProjectId = workspace.latestProjectId!;

    expect(workspace).toEqual({
      projects: [{id: defaultProjectId, name: 'Default Project'}],
      chaptersByProjectId: {
        [defaultProjectId]: [{id: defaultChapterId, title: 'Chapter 1'}],
      },
      latestProjectId: defaultProjectId,
    });
    expect(application.model.getScope())
      .toEqual({projectId: defaultProjectId, chapterId: defaultChapterId});
    expect(application.graphModel)
      .toEqual({nodes: [], edges: [], lanes: [], nodeSchemas: {}, nodeExampleValues: {}});
    expect(application.model.getSnapshot())
      .toEqual(application.graphModel);
  });

  it('returns initially caught-up workspace and graph snapshots from existing store events', async () => {
    const stores = await createDefaultGraphEventStore();
    const existingProjectId = 'existing-project-id';
    const existingChapterId = 'existing-chapter-id';
    await stores.graphStore.restoreBackup([
      Events.projectAdded(existingProjectId, 'Checkout System'),
      Events.chapterAdded(existingProjectId, existingChapterId, 'Overview'),
      Events.nodeAdded(existingProjectId, existingChapterId, 'node-1', 'evt', 1, 'Checkout Completed'),
    ]);

    const application = await createGraphApplication({projectId: existingProjectId, chapterId: existingChapterId});

    expect(application.model.getWorkspace())
      .toEqual({
        projects: [{id: existingProjectId, name: 'Checkout System'}],
        chaptersByProjectId: {
          [existingProjectId]: [{id: existingChapterId, title: 'Overview'}],
        },
        latestProjectId: existingProjectId,
      });
    expect(application.model.getScope())
      .toEqual({
        projectId: existingProjectId,
        chapterId: existingChapterId
      });
    expect(application.graphModel.nodes.map((node) => ({id: node.id, label: node.label, type: node.type})))
      .toEqual([{
        id: 'node-1',
        label: 'Checkout Completed',
        type: 'evt'
      }]);
    expect(application.model.getSnapshot())
      .toEqual(application.graphModel);
  });
});
