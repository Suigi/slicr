import {describe, expect, it} from 'vitest';

import {Events} from './events';
import {projectWorkspace} from './workspaceProjector';

describe('projectWorkspace', () => {
  it('derives renamed projects and per-project chapters from workspace events', () => {
    const workspace = projectWorkspace([
      Events.projectAdded('project-1', 'Checkout System'),
      Events.chapterAdded('project-1', 'chapter-1', 'Overview'),
      Events.chapterAdded('project-1', 'chapter-2', 'Cart Events'),
      Events.projectAdded('project-2', 'Inventory System'),
      Events.chapterAdded('project-2', 'chapter-3', 'Stock Levels'),
      Events.projectRenamed('project-1', 'Checkout Platform'),
      Events.chapterRenamed('project-1', 'chapter-2', 'Cart Flow'),
      Events.chapterRenamed('project-2', 'chapter-3', 'Stock Overview'),
    ]);

    expect(workspace.projects).toEqual([
      {id: 'project-1', name: 'Checkout Platform'},
      {id: 'project-2', name: 'Inventory System'},
    ]);
    expect(workspace.chaptersByProjectId).toEqual({
      'project-1': [
        {id: 'chapter-1', title: 'Overview'},
        {id: 'chapter-2', title: 'Cart Flow'},
      ],
      'project-2': [{id: 'chapter-3', title: 'Stock Overview'}],
    });
  });
});
