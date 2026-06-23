import {describe, it} from 'vitest';
import {expectDecider} from '@slicr/event-sourcing/testing';
import {Events} from '../../events';
import {initialWorkspaceDecider} from './initialWorkspaceProcessor';

describe('initialWorkspaceDecider', () => {
  it('given no project events, emits default project and chapter for the same project id', async () => {
    await expectDecider(initialWorkspaceDecider({generateUuid: () => 'project_id'}))
      .given()
      .when({type: 'EnsureInitialWorkspace', data: {}})
      .thenEmits(
        Events.projectAdded('project_id', 'Default Project'),
        Events.chapterAdded('project_id', 'default-chapter', 'Chapter 1')
      );
  });

  it('given existing project, emits no events', async () => {
    await expectDecider(initialWorkspaceDecider())
      .given(Events.projectAdded('project_id', 'Existing Project'))
      .when({type: 'EnsureInitialWorkspace', data: {}})
      .thenEmits();
  });
});
