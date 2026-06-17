import {describe, it} from 'vitest';
import {expectHandler} from '@slicr/event-sourcing/testing';
import {Events} from '../../events';
import {initialWorkspaceProcessor} from './initialWorkspaceProcessor';

describe('initialWorkspaceProcessor', () => {
  it('given no events, emits default project and chapter', () => {
    const uuids = ['project_id', 'chapter_id'];
    const generateUuid = () => uuids.shift()!;
    expectHandler(initialWorkspaceProcessor({generateUuid}))
      .given()
      .when()
      .thenEmits(
        Events.projectAdded('project_id', 'Default Project'),
        Events.chapterAdded('chapter_id', 'default', 'Chapter 1')
      );
  });

  it('given existing project, emits no events', () => {
    expectHandler(initialWorkspaceProcessor())
      .given(Events.projectAdded('project_id', 'Existing Project'))
      .when()
      .thenEmits();
  });
});
