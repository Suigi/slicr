import {createProjectorInstance, type DcbProjectorDefinition, Query, replayProjector} from './eventSourcing';
import type {ChapterId, DcbEvent, ProjectId} from './events';

export type WorkspaceProject = {
  id: ProjectId;
  name: string;
};

export type WorkspaceChapter = {
  id: ChapterId;
  title: string;
};

export type WorkspaceProjection = {
  projects: WorkspaceProject[];
  chaptersByProjectId: Record<ProjectId, WorkspaceChapter[]>;
  latestProjectId?: ProjectId;
};

type WorkspaceProjectorState = {
  projectOrder: ProjectId[];
  projectNames: Map<ProjectId, string>;
  chapterOrderByProjectId: Map<ProjectId, ChapterId[]>;
  chapterTitlesByProjectId: Map<ProjectId, Map<ChapterId, string>>;
};

export const workspaceProjectorDefinition: DcbProjectorDefinition<void, WorkspaceProjectorState, WorkspaceProjection> = {
  query: () =>
    Query.where({
      types: ['ProjectAdded', 'ProjectRenamed', 'ChapterAdded', 'ChapterRenamed'],
    }),
  initialState: () => ({
    projectOrder: [],
    projectNames: new Map<ProjectId, string>(),
    chapterOrderByProjectId: new Map<ProjectId, ChapterId[]>(),
    chapterTitlesByProjectId: new Map<ProjectId, Map<ChapterId, string>>(),
  }),
  evolve: (state, event) => {
    switch (event.type) {
      case 'ProjectAdded':
        if (!state.projectNames.has(event.payload.projectId)) {
          state.projectOrder.push(event.payload.projectId);
        }
        state.projectNames.set(event.payload.projectId, event.payload.name);
        break;
      case 'ProjectRenamed':
        if (state.projectNames.has(event.payload.projectId)) {
          state.projectNames.set(event.payload.projectId, event.payload.newName);
        }
        break;
      case 'ChapterAdded': {
        if (!state.projectNames.has(event.payload.projectId)) {
          break;
        }
        const chapterOrder = state.chapterOrderByProjectId.get(event.payload.projectId) ?? [];
        if (!chapterOrder.includes(event.payload.chapterId)) {
          chapterOrder.push(event.payload.chapterId);
          state.chapterOrderByProjectId.set(event.payload.projectId, chapterOrder);
        }
        const chapterTitles = state.chapterTitlesByProjectId.get(event.payload.projectId) ?? new Map<ChapterId, string>();
        chapterTitles.set(event.payload.chapterId, event.payload.title);
        state.chapterTitlesByProjectId.set(event.payload.projectId, chapterTitles);
        break;
      }
      case 'ChapterRenamed': {
        const chapterTitles = state.chapterTitlesByProjectId.get(event.payload.projectId);
        if (chapterTitles?.has(event.payload.chapterId)) {
          chapterTitles.set(event.payload.chapterId, event.payload.newTitle);
        }
        break;
      }
      default:
        break;
    }

    return state;
  },
  projection: (state) => ({
    projects: state.projectOrder.map((projectId) => ({id: projectId, name: state.projectNames.get(projectId) ?? 'Untitled'})),
    chaptersByProjectId: Object.fromEntries(
      state.projectOrder.map((projectId) => {
        const chapterOrder = state.chapterOrderByProjectId.get(projectId) ?? [];
        const chapterTitles = state.chapterTitlesByProjectId.get(projectId) ?? new Map<ChapterId, string>();
        return [projectId, chapterOrder.map((chapterId) => ({id: chapterId, title: chapterTitles.get(chapterId) ?? 'Untitled'}))];
      }),
    ),
    latestProjectId: state.projectOrder[state.projectOrder.length - 1],
  }),
};

export function projectWorkspace(events: readonly DcbEvent[]): WorkspaceProjection {
  return replayProjector(createProjectorInstance(workspaceProjectorDefinition, undefined), events);
}
