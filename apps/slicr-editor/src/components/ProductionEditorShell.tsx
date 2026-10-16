import type {ReactNode} from 'react';
import {AppShell} from './AppShell';
import {ChapterSidebar} from './ChapterSidebar';
import {ProjectSwitcher} from './ProjectSwitcher';

type Project = {id: string; name: string};
type Chapter = {id: string; title: string};

/** Shared production navigation and frame for standalone and project-backed editors. */
export function ProductionEditorShell(props: {
  projects: Project[];
  chapters: Chapter[];
  projectId: string;
  chapterId: string;
  isSidebarOpen: boolean;
  onSelectProject: (id: string) => void;
  onAddProject: (name: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onSelectChapter: (id: string) => void;
  onAddChapter: (title: string) => void;
  onCollapseSidebar: () => void;
  onExpandSidebar: () => void;
  topbarActions?: ReactNode;
  children: ReactNode;
}) {
  const activeChapterName = props.chapters.find((chapter) => chapter.id === props.chapterId)?.title ?? 'Untitled';
  return (
    <AppShell
      projectSwitcher={
        <ProjectSwitcher
          projects={props.projects}
          activeProjectId={props.projectId}
          onSelectProject={props.onSelectProject}
          onAddProject={props.onAddProject}
          onRenameProject={props.onRenameProject}
        />
      }
      sidebar={
        <ChapterSidebar
          chapters={props.chapters}
          activeChapterId={props.chapterId}
          onSelectChapter={props.onSelectChapter}
          onCollapse={props.onCollapseSidebar}
          onAddChapter={props.onAddChapter}
        />
      }
      collapsedSidebarLabel={activeChapterName}
      isSidebarOpen={props.isSidebarOpen}
      onExpandSidebar={props.onExpandSidebar}
      topbarActions={props.topbarActions}
    >
      {props.children}
    </AppShell>
  );
}
