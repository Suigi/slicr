import {beforeEach, describe, expect, it} from 'vitest';

import {createGraphApplication} from './createGraphApplication';
import {createDefaultGraphEventStore} from './graphEventStores';

const defaultChapterId = 'default-chapter';

describe('createGraphApplication', () => {
  beforeEach(async () => {
    const stores = await createDefaultGraphEventStore();
    await stores.graphStore.restoreBackup([]);
  });

  it('returns initially caught-up default workspace and graph snapshots', async () => {
    const application = await createGraphApplication({chapterId: defaultChapterId});
    const workspace = application.model.getWorkspace();
    const defaultProjectId = workspace.projects[0]?.id;

    expect(workspace).toEqual({
      projects: [{id: defaultProjectId, name: 'Default Project'}],
      chaptersByProjectId: {
        [defaultProjectId]: [{id: defaultChapterId, title: 'Chapter 1'}],
      },
      latestProjectId: defaultProjectId,
    });
    expect(defaultProjectId).toEqual(expect.any(String));
    expect(application.model.getScope()).toEqual({projectId: defaultProjectId, chapterId: defaultChapterId});
    expect(application.graphModel).toEqual({nodes: [], edges: [], lanes: [], nodeSchemas: {}, nodeExampleValues: {}});
    expect(application.model.getSnapshot()).toEqual(application.graphModel);
  });
});
