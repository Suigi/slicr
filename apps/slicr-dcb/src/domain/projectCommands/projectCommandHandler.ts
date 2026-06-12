import {Handler, Query, Store} from '@slicr/event-sourcing';
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


export const handlers = (args: { generateUuid?: () => string } = {}) => {
  const generateUuid = args.generateUuid ?? uuid;
  return {
    renameProject: (store: Store<DomainEvent>) =>
      Handler.create<RenameProjectCommand, DomainEvent, Record<ProjectId, string>>({
        store,
        ...Atoms.projectNames,
        decide: (command, decisionModel) => {
          const currentProjectName = decisionModel[command.projectId];
          if (currentProjectName === undefined) {
            throw new Error(`Project with ID [${command.projectId}] not found`);
          }
          if (currentProjectName !== command.name) {
            return [
              Events.projectRenamed(command.projectId, command.name),
            ];
          }
          return [];
        }
      }),

    addProject: (store: Store<DomainEvent>) =>
      Handler.create<AddProjectCommand, DomainEvent, void>({
        store,
        ...Atoms.noOp,
        decide: (command) => {
          const projectId = generateUuid();
          const chapterId = generateUuid();
          return [
            Events.projectAdded(projectId, command.name),
            Events.chapterAdded(projectId, chapterId, DEFAULT_CHAPTER_TITLE),
          ];
        }
      }),

  };
};