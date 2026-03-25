export const PROJECTS_INDEX_STORAGE_KEY = 'slicr.es.v2.projects.index';
export const APP_EVENT_STREAM_STORAGE_KEY = 'slicr.es.v1.stream.app';
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

type AppProjectEvent =
  | {
    id: string;
    version: number;
    at: string;
    type: 'project-created';
    payload: { projectId: string; name: string };
  }
  | {
    id: string;
    version: number;
    at: string;
    type: 'project-selected';
    payload: { projectId: string };
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
  // Project index is event-sourced; keep this no-op for compatibility.
  void index;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function makeEventId(): string {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadRawAppEvents(): Array<Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(APP_EVENT_STREAM_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((event): event is Record<string, unknown> => Boolean(event && typeof event === 'object'));
  } catch {
    return [];
  }
}

function projectEventFromRaw(event: Record<string, unknown>): AppProjectEvent | null {
  const maybe = event as {
    id?: unknown;
    version?: unknown;
    at?: unknown;
    type?: unknown;
    payload?: unknown;
  };
  if (
    typeof maybe.id !== 'string'
    || !isFiniteNumber(maybe.version)
    || typeof maybe.at !== 'string'
    || typeof maybe.type !== 'string'
    || !maybe.payload
    || typeof maybe.payload !== 'object'
  ) {
    return null;
  }
  if (maybe.type === 'project-created') {
    const payload = maybe.payload as { projectId?: unknown; name?: unknown };
    if (typeof payload.projectId !== 'string' || payload.projectId.length === 0 || typeof payload.name !== 'string' || payload.name.length === 0) {
      return null;
    }
    return {
      id: maybe.id,
      version: maybe.version,
      at: maybe.at,
      type: 'project-created',
      payload: { projectId: payload.projectId, name: payload.name }
    };
  }
  if (maybe.type === 'project-selected') {
    const payload = maybe.payload as { projectId?: unknown };
    if (typeof payload.projectId !== 'string' || payload.projectId.length === 0) {
      return null;
    }
    return {
      id: maybe.id,
      version: maybe.version,
      at: maybe.at,
      type: 'project-selected',
      payload: { projectId: payload.projectId }
    };
  }
  return null;
}

function loadProjectEvents(): AppProjectEvent[] {
  return loadRawAppEvents()
    .map((event) => projectEventFromRaw(event))
    .filter((event): event is AppProjectEvent => event !== null)
    .sort((a, b) => a.version - b.version);
}

function saveRawAppEvents(events: Array<Record<string, unknown>>): void {
  localStorage.setItem(APP_EVENT_STREAM_STORAGE_KEY, JSON.stringify(events));
}

function nextVersion(events: Array<Record<string, unknown>>): number {
  const versions = events
    .map((event) => event.version)
    .filter((version): version is number => isFiniteNumber(version));
  if (versions.length === 0) {
    return 1;
  }
  return Math.max(...versions) + 1;
}

export function appendProjectCreatedEvent(projectId: string, name: string): void {
  const existing = loadRawAppEvents();
  const event = {
    id: makeEventId(),
    version: nextVersion(existing),
    at: new Date().toISOString(),
    type: 'project-created',
    payload: { projectId, name }
  } satisfies AppProjectEvent;
  saveRawAppEvents([...existing, event]);
}

export function appendProjectSelectedEvent(projectId: string): void {
  const existing = loadRawAppEvents();
  const event = {
    id: makeEventId(),
    version: nextVersion(existing),
    at: new Date().toISOString(),
    type: 'project-selected',
    payload: { projectId }
  } satisfies AppProjectEvent;
  saveRawAppEvents([...existing, event]);
}

export function loadProjectIndex(): ProjectIndex {
  const events = loadProjectEvents();
  const created = events.filter((event) => event.type === 'project-created');

  if (created.length === 0) {
    try {
      const legacyRaw = localStorage.getItem(PROJECTS_INDEX_STORAGE_KEY);
      if (legacyRaw) {
        const legacy = asProjectIndex(JSON.parse(legacyRaw));
        if (legacy) {
          for (const project of legacy.projects) {
            appendProjectCreatedEvent(project.id, project.name);
          }
          appendProjectSelectedEvent(legacy.selectedProjectId);
          localStorage.removeItem(PROJECTS_INDEX_STORAGE_KEY);
          const migrated = loadProjectIndex();
          return migrated;
        }
      }
    } catch {
      // Ignore legacy parsing errors and fall through.
    }
    appendProjectCreatedEvent(DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME);
    appendProjectSelectedEvent(DEFAULT_PROJECT_ID);
    return createInitialProjectIndex();
  }

  const byId = new Map<string, Project>();
  for (const event of created) {
    byId.set(event.payload.projectId, { id: event.payload.projectId, name: event.payload.name });
  }
  const projects = [...byId.values()];
  if (!projects.some((project) => project.id === DEFAULT_PROJECT_ID)) {
    projects.unshift({ id: DEFAULT_PROJECT_ID, name: DEFAULT_PROJECT_NAME });
  }

  const selectedEvents = events
    .filter((event): event is Extract<AppProjectEvent, { type: 'project-selected' }> => event.type === 'project-selected')
    .reverse();
  const selectedProjectId =
    selectedEvents.find((event) => byId.has(event.payload.projectId) || event.payload.projectId === DEFAULT_PROJECT_ID)?.payload.projectId
    ?? DEFAULT_PROJECT_ID;

  return { selectedProjectId, projects };
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
