import {Decider, Query, SomeCommand} from '../eventSourcing';
import {Events, ProjectId} from '../events';
import {type DcbEvent} from '../eventSourcing';
import {v4 as uuid} from 'uuid';
import {AddProject, RenameProject} from './commands';

const DEFAULT_CHAPTER_TITLE = 'Chapter 1';

type Atom<Scope, Model> = {
  query: (scope: Scope) => Query;
  project: (scope: Scope, events: readonly DcbEvent[]) => Model;
};

const projectNames: Atom<SomeCommand<{projectId:ProjectId}>, Record<ProjectId, string>> = {
  query: command => Query.where({
    types: ['ProjectAdded', 'ProjectRenamed'],
    tags: [`projectId:${command.data.projectId}`],
  }),
  project: (_, events) => {
    const projectNames: Record<ProjectId, string> = {};
    events.forEach(event => {
      if (event.type === 'ProjectAdded') {
        projectNames[event.payload.projectId] = event.payload.name;
      }
      if (event.type === 'ProjectRenamed') {
        projectNames[event.payload.projectId] = event.payload.newName;
      }
    });
    return projectNames;
  },
};

const noOpAtom: Atom<unknown, void> = {
  query: () => Query.none(),
  project: () => undefined,
};

const Atoms = {projectNames, noOp: noOpAtom};

const addProjectDecider = (generateUuid: () => string): Decider<AddProject, DcbEvent, void> => ({
  ...Atoms.noOp,
  decide: (command) => {
    const projectId = generateUuid();
    const chapterId = generateUuid();
    return [
      Events.projectAdded(projectId, command.data.name),
      Events.chapterAdded(projectId, chapterId, DEFAULT_CHAPTER_TITLE),
    ];
  }
});

const renameProjectDecider: Decider<RenameProject, DcbEvent, Record<string,string>> = {
  ...Atoms.projectNames,
  decide: (command: RenameProject, decisionModel: Record<string, string>) => {
    const currentProjectName = decisionModel[command.data.projectId];

    if (currentProjectName === undefined) {
      throw new Error(`Project with ID [${command.data.projectId}] not found`);
    }

    if (currentProjectName === command.data.name) {
      return [];
    }

    return [
      Events.projectRenamed(command.data.projectId, command.data.name),
    ];
  }
};

export const deciders = (args: { generateUuid?: () => string } = {}) => {
  const generateUuid = args.generateUuid ?? uuid;
  return {
    addProject: addProjectDecider(generateUuid),
    renameProject: renameProjectDecider,
  };
};