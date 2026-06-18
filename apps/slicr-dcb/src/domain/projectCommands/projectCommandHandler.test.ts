import {describe, it} from 'vitest';
import {expectDecider} from '@slicr/event-sourcing/testing';
import {deciders} from './projectCommandHandler';
import {Events} from '../events';

describe('projectCommandHandler', () => {

  const uuidStub = (uuids: string[]) => {
    return () => uuids.shift()!;
  };

  describe('addProject', () => {
    it('given no projects, emit projectAdded and chapterAdded', () => {
      const uuids = ['my_project_id', 'my_chapter_id'];
      expectDecider(deciders({generateUuid: uuidStub(uuids)}).addProject)
        .given()
        .when({type: 'AddProject', data: {name: 'my project'}})
        .thenEmits(
          Events.projectAdded('my_project_id', 'my project'),
          Events.chapterAdded('my_project_id', 'my_chapter_id', 'Chapter 1')
        );
    });
  });

  describe('renameProject', () => {
    it('given no project, throws', () => {
      expectDecider(deciders().renameProject)
        .given()
        .when({type: 'RenameProject', data: {projectId: '123', name: 'new name'}})
        .thenThrows(new Error('Project with ID [123] not found'));
    });

    it('given different project, throws', () => {
      expectDecider(deciders().renameProject)
        .given(Events.projectAdded('other project', 'IRRELEVANT PROJECT NAME'))
        .when({type: 'RenameProject', data: {projectId: 'my project', name: 'new name'}})
        .thenThrows(new Error('Project with ID [my project] not found'));
    });

    it('given existing project, emits projectRenamed', () => {
      expectDecider(deciders().renameProject)
        .given(Events.projectAdded('my project', 'IRRELEVANT PROJECT NAME'))
        .when({type: 'RenameProject', data: {projectId: 'my project', name: 'new name'}})
        .thenEmits(Events.projectRenamed('my project', 'new name'));
    });

    it('given existing project with same name, emits no events', () => {
      expectDecider(deciders().renameProject)
        .given(Events.projectAdded('my project', 'same name'))
        .when({type: 'RenameProject', data: {projectId: 'my project', name: 'same name'}})
        .thenEmits();
    });

    it('given existing and already renamed project, emits no event', () => {
      expectDecider(deciders().renameProject)
        .given(
          Events.projectAdded('my project', 'initial project name'),
          Events.projectRenamed('my project', 'new name')
        )
        .when({type: 'RenameProject', data: {projectId: 'my project', name: 'new name'}})
        .thenEmits();
    });
  });
});
