import {describe, it} from 'vitest';
import {expectHandler} from '@slicr/event-sourcing/testing';
import {handlers} from './projectCommandHandler';
import {Events} from '../events';

describe('projectCommandHandler', () => {

  const uuidStub = (uuids: string[]) => {
    return () => uuids.shift()!;
  }

  describe('addProject', () => {
    it('given no projects, emit projectAdded and chapterAdded', () => {
      const uuids = ['my_project_id', 'my_chapter_id'];
      expectHandler(handlers({generateUuid: uuidStub(uuids)}).addProject)
        .given()
        .when({name: 'my project'})
        .thenEmits(
          Events.projectAdded('my_project_id', 'my project'),
          Events.chapterAdded('my_project_id', 'my_chapter_id', 'Chapter 1')
        );
    });
  });

  describe('renameProject', () => {
    it('given no project, throws', () => {
      expectHandler(handlers().renameProject)
        .given()
        .when({projectId: '123', name: 'new name'})
        .thenThrows(new Error('Project with ID [123] not found'));
    });

    it('given different project, throws', () => {
      expectHandler(handlers().renameProject)
        .given(Events.projectAdded('other project', 'IRRELEVANT PROJECT NAME'))
        .when({projectId: 'my project', name: 'new name'})
        .thenThrows(new Error('Project with ID [my project] not found'));
    });

    it('given existing project, emits projectRenamed', () => {
      expectHandler(handlers().renameProject)
        .given(Events.projectAdded('my project', 'IRRELEVANT PROJECT NAME'))
        .when({projectId: 'my project', name: 'new name'})
        .thenEmits(Events.projectRenamed('my project', 'new name'));
    });

    it('given existing project with same name, emits no events', () => {
      expectHandler(handlers().renameProject)
        .given(Events.projectAdded('my project', 'same name'))
        .when({projectId: 'my project', name: 'same name'})
        .thenEmits();
    });

    it('given existing and already renamed project, emits no event', () => {
      expectHandler(handlers().renameProject)
        .given(
          Events.projectAdded('my project', 'initial project name'),
          Events.projectRenamed('my project', 'new name')
        )
        .when({projectId: 'my project', name: 'new name'})
        .thenEmits();
    });
  });
});
