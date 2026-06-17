import {Decider, Query} from '@slicr/event-sourcing';
import {DomainEvent, Events, ProjectId} from '../events';
import {v4 as uuid} from 'uuid';

const DEFAULT_CHAPTER_TITLE = 'Chapter 1';

export type RenameProjectCommand = { projectId: ProjectId, name: string };
export type AddProjectCommand = { name: string };

type Atom<Inputs, Model> = {
  query: (inputs: Inputs) => Query;
  project: (events: readonly DomainEvent[]) => Model;
};

const projectNames: Atom<{ projectId: ProjectId }, Record<ProjectId, string>> = {
  query: inputs => Query.where({tags: [`projectId:${inputs.projectId}`]}),
  project: events => {
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
  }
};

const noOpAtom: Atom<unknown, void> = {
  query: () => Query.none(),
  project: () => undefined,
};

const Atoms = {projectNames, noOp: noOpAtom};

const addProjectDecider = (generateUuid: () => string): Decider<AddProjectCommand, DomainEvent, void> => ({
  ...Atoms.noOp,
  decide: (command) => {
    const projectId = generateUuid();
    const chapterId = generateUuid();
    return [
      Events.projectAdded(projectId, command.name),
      Events.chapterAdded(projectId, chapterId, DEFAULT_CHAPTER_TITLE),
    ];
  }
});

const renameProjectDecider: Decider<RenameProjectCommand, DomainEvent, Record<string,string>> = {
  ...Atoms.projectNames,
  decide: (command: RenameProjectCommand, decisionModel: Record<string, string>) => {
    const currentProjectName = decisionModel[command.projectId];

    if (currentProjectName === undefined) {
      throw new Error(`Project with ID [${command.projectId}] not found`);
    }

    if (currentProjectName === command.name) {
      return [];
    }

    return [
      Events.projectRenamed(command.projectId, command.name),
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