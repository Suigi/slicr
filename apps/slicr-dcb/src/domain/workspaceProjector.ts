import type {ChapterId, DomainEvent, ProjectId} from './events';

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
};

export function projectWorkspace(events: readonly DomainEvent[]): WorkspaceProjection {
  const projectOrder: ProjectId[] = [];
  const projectNames = new Map<ProjectId, string>();
  const chapterOrderByProjectId = new Map<ProjectId, ChapterId[]>();
  const chapterTitlesByProjectId = new Map<ProjectId, Map<ChapterId, string>>();

  for (const event of events) {
    switch (event.type) {
      case 'ProjectAdded':
        if (!projectNames.has(event.payload.projectId)) {
          projectOrder.push(event.payload.projectId);
        }
        projectNames.set(event.payload.projectId, event.payload.name);
        break;
      case 'ProjectRenamed':
        if (projectNames.has(event.payload.projectId)) {
          projectNames.set(event.payload.projectId, event.payload.newName);
        }
        break;
      case 'ChapterAdded': {
        if (!projectNames.has(event.payload.projectId)) {
          break;
        }
        const chapterOrder = chapterOrderByProjectId.get(event.payload.projectId) ?? [];
        if (!chapterOrder.includes(event.payload.chapterId)) {
          chapterOrder.push(event.payload.chapterId);
          chapterOrderByProjectId.set(event.payload.projectId, chapterOrder);
        }
        const chapterTitles = chapterTitlesByProjectId.get(event.payload.projectId) ?? new Map<ChapterId, string>();
        chapterTitles.set(event.payload.chapterId, event.payload.title);
        chapterTitlesByProjectId.set(event.payload.projectId, chapterTitles);
        break;
      }
      case 'ChapterRenamed': {
        const chapterTitles = chapterTitlesByProjectId.get(event.payload.projectId);
        if (chapterTitles?.has(event.payload.chapterId)) {
          chapterTitles.set(event.payload.chapterId, event.payload.newTitle);
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    projects: projectOrder.map((projectId) => ({id: projectId, name: projectNames.get(projectId) ?? 'Untitled'})),
    chaptersByProjectId: Object.fromEntries(
      projectOrder.map((projectId) => {
        const chapterOrder = chapterOrderByProjectId.get(projectId) ?? [];
        const chapterTitles = chapterTitlesByProjectId.get(projectId) ?? new Map<ChapterId, string>();
        return [
          projectId,
          chapterOrder.map((chapterId) => ({id: chapterId, title: chapterTitles.get(chapterId) ?? 'Untitled'})),
        ];
      }),
    ),
  };
}
