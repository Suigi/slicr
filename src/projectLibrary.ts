export const PROJECTS_INDEX_STORAGE_KEY = 'slicr.es.v2.projects.index';
export const DEFAULT_PROJECT_ID = 'default';
const DEFAULT_PROJECT_NAME = 'Default';

export type Project = {
  id: string;
  name: string;
};

export type ProjectIndex = {
  selectedProjectId: string;
  projects: Project[];
};

function asProject(value: unknown): Project | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const maybe = value as { id?: unknown; name?: unknown };
  if (typeof maybe.id !== 'string' || maybe.id.length === 0 || typeof maybe.name !== 'string' || maybe.name.length === 0) {
    return null;
  }
  return { id: maybe.id, name: maybe.name };
}

function asProjectIndex(value: unknown): ProjectIndex | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const maybe = value as { selectedProjectId?: unknown; projects?: unknown };
  if (!Array.isArray(maybe.projects) || typeof maybe.selectedProjectId !== 'string') {
    return null;
  }
  const projects = maybe.projects
    .map((project) => asProject(project))
    .filter((project): project is Project => project !== null);
  if (projects.length === 0 || !projects.some((project) => project.id === maybe.selectedProjectId)) {
    return null;
  }
  return {
    selectedProjectId: maybe.selectedProjectId,
    projects
  };
}

export function createInitialProjectIndex(): ProjectIndex {
  return {
    selectedProjectId: DEFAULT_PROJECT_ID,
    projects: [{ id: DEFAULT_PROJECT_ID, name: DEFAULT_PROJECT_NAME }]
  };
}

export function saveProjectIndex(index: ProjectIndex): void {
  localStorage.setItem(PROJECTS_INDEX_STORAGE_KEY, JSON.stringify(index));
}

export function loadProjectIndex(): ProjectIndex {
  try {
    const raw = localStorage.getItem(PROJECTS_INDEX_STORAGE_KEY);
    if (raw) {
      const parsed = asProjectIndex(JSON.parse(raw));
      if (parsed) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage errors and fall back.
  }

  const initial = createInitialProjectIndex();
  saveProjectIndex(initial);
  return initial;
}

export function selectProject(index: ProjectIndex, projectId: string): ProjectIndex {
  if (!index.projects.some((project) => project.id === projectId)) {
    return index;
  }
  if (index.selectedProjectId === projectId) {
    return index;
  }
  return { ...index, selectedProjectId: projectId };
}
