import {AppendConditionFailedError, MemoryStore, Query, type AppendCondition, type SpecEventStore} from '@slicr/event-sourcing';
import {v4 as uuid} from 'uuid';

import {createCommandRouter} from '../application/commandRouter';
import {Events, type DomainEvent} from '../domain/events';
import {GraphProjector} from '../domain/graphProjector/graphProjector';
import {
  changeNodeExampleValuesHandler,
  changeNodeSchemaHandler,
  type ChangeNodeExampleValuesCommand as ScopedChangeNodeExampleValuesCommand,
  type ChangeNodeSchemaCommand as ScopedChangeNodeSchemaCommand,
} from '../domain/nodeCommands/handler';
import {projectWorkspace, type WorkspaceProjection} from '../domain/workspaceProjector';
import {adaptModelGraphToRenderer, type RendererGraph} from './domainGraphAdapter';
import type {NodeType} from './types';

const DEFAULT_PROJECT_ID = 'default-project';
const DEFAULT_PROJECT_NAME = 'Default Project';
const DEFAULT_CHAPTER_ID = 'default-chapter';
const DEFAULT_CHAPTER_TITLE = 'Chapter 1';

const defaultWorkspaceEvents: DomainEvent[] = [
  Events.projectAdded(DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME),
  Events.chapterAdded(DEFAULT_PROJECT_ID, DEFAULT_CHAPTER_ID, DEFAULT_CHAPTER_TITLE),
];

const defaultProjectBootstrapCondition: AppendCondition = {
  failIfEventsMatch: Query.where({types: ['ProjectAdded'], tags: [`projectId:${DEFAULT_PROJECT_ID}`]}),
};

const defaultChapterBootstrapCondition: AppendCondition = {
  failIfEventsMatch: Query.where({types: ['ChapterAdded'], tags: [`projectId:${DEFAULT_PROJECT_ID}`, `chapterId:${DEFAULT_CHAPTER_ID}`]}),
};

export type AsyncGraphEventStore = {
  append(events: DomainEvent | readonly DomainEvent[], condition?: AppendCondition): Promise<void>;
  readAll(): Promise<DomainEvent[]>;
  replace(events: readonly DomainEvent[]): Promise<void>;
  clear(): Promise<void>;
};

type ChangeNodeSchemaInput = Omit<ScopedChangeNodeSchemaCommand, 'projectId'>;
type ChangeNodeExampleValuesInput = Omit<ScopedChangeNodeExampleValuesCommand, 'projectId'>;

export type GraphModelScope = {
  projectId?: string;
  chapterId?: string;
};

export type EventSourcedGraphModel = {
  load(scope?: GraphModelScope): Promise<RendererGraph>;
  setScope(scope: GraphModelScope): RendererGraph;
  getSnapshot(): RendererGraph;
  getWorkspace(): WorkspaceProjection;
  getScope(): {projectId: string; chapterId: string};
  readEvents(): Promise<DomainEvent[]>;
  addNewSlice(): Promise<RendererGraph>;
  addProject(name: string): Promise<RendererGraph>;
  renameProject(projectId: string, name: string): Promise<RendererGraph>;
  addChapter(title: string): Promise<RendererGraph>;
  addConnection(sourceNodeId: string, targetNodeId: string, role?: 'flow' | 'back-reference'): Promise<RendererGraph>;
  deleteConnection(edgeId: string): Promise<RendererGraph>;
  addConnectedNode(command: {sourceNodeId: string; nodeType: NodeType; laneId: number; label: string; role?: 'flow' | 'back-reference'}): Promise<RendererGraph>;
  renameNode(nodeId: string, newName: string): Promise<RendererGraph>;
  setNodeType(nodeId: string, type: NodeType): Promise<RendererGraph>;
  changeNodeSchema(command: ChangeNodeSchemaInput): Promise<RendererGraph>;
  changeNodeExampleValues(command: ChangeNodeExampleValuesInput): Promise<RendererGraph>;
  deleteNode(nodeId: string): Promise<RendererGraph>;
  replace(events: readonly DomainEvent[]): Promise<RendererGraph>;
};

function resolveScope(workspace: WorkspaceProjection, scope: GraphModelScope) {
  const resolvedProjectId = workspace.projects.some((project) => project.id === scope.projectId)
    ? (scope.projectId ?? DEFAULT_PROJECT_ID)
    : (workspace.projects[0]?.id ?? DEFAULT_PROJECT_ID);
  const chapters = workspace.chaptersByProjectId[resolvedProjectId] ?? [];
  const resolvedChapterId = chapters.some((chapter) => chapter.id === scope.chapterId)
    ? (scope.chapterId ?? DEFAULT_CHAPTER_ID)
    : (chapters[0]?.id ?? DEFAULT_CHAPTER_ID);

  return {projectId: resolvedProjectId, chapterId: resolvedChapterId};
}

async function appendBootstrapEvent(
  store: AsyncGraphEventStore,
  event: DomainEvent,
  condition: AppendCondition,
) {
  try {
    await store.append(event, condition);
  } catch (error) {
    if (!(error instanceof AppendConditionFailedError)) {
      throw error;
    }
  }
}

async function ensureDefaultWorkspace(store: AsyncGraphEventStore) {
  const existingEvents = await store.readAll();
  const workspace = projectWorkspace(existingEvents);

  const hasDefaultProject = workspace.projects.some((project) => project.id === DEFAULT_PROJECT_ID);
  if (!hasDefaultProject) {
    await appendBootstrapEvent(
      store,
      Events.projectAdded(DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME),
      defaultProjectBootstrapCondition,
    );
  }

  const hasDefaultChapter = (workspace.chaptersByProjectId[DEFAULT_PROJECT_ID] ?? []).some(
    (chapter) => chapter.id === DEFAULT_CHAPTER_ID,
  );
  if (!hasDefaultChapter) {
    await appendBootstrapEvent(
      store,
      Events.chapterAdded(DEFAULT_PROJECT_ID, DEFAULT_CHAPTER_ID, DEFAULT_CHAPTER_TITLE),
      defaultChapterBootstrapCondition,
    );
  }
}

export function createEventSourcedGraphModel(config: {
  store: AsyncGraphEventStore,
  commandStore: SpecEventStore<DomainEvent>,
  uuidGenerator?: () => string,
}): EventSourcedGraphModel {
  const generateId = config.uuidGenerator ?? uuid;
  const routeCommand = createCommandRouter({
    store: config.commandStore,
    generateUuid: generateId,
  });
  const readAllEvents = async () => (await config.commandStore.read()).map(({event}) => event);
  let snapshot: RendererGraph = {nodes: [], edges: [], lanes: [], nodeSchemas: {}, nodeExampleValues: {}};
  let workspace: WorkspaceProjection = projectWorkspace(defaultWorkspaceEvents);
  let currentProjectId = DEFAULT_PROJECT_ID;
  let currentChapterId = DEFAULT_CHAPTER_ID;
  let events: DomainEvent[] = [];

  const project = (nextEvents: readonly DomainEvent[], scope: GraphModelScope = {}) => {
    events = [...nextEvents];
    workspace = projectWorkspace(events);
    ({projectId: currentProjectId, chapterId: currentChapterId} = resolveScope(workspace, scope));

    const memoryStore = MemoryStore.create<DomainEvent>();
    memoryStore.append(events);
    snapshot = adaptModelGraphToRenderer(GraphProjector.create({store: memoryStore}).project(currentProjectId, currentChapterId));
    return snapshot;
  };

  const appendAndRefreshProjection = async (
    event: DomainEvent | readonly DomainEvent[],
    scope: GraphModelScope = {projectId: currentProjectId, chapterId: currentChapterId},
  ) => {
    const appendedEvents = Array.isArray(event) ? event : [event];
    if (appendedEvents.length === 0) {
      return snapshot;
    }

    await config.commandStore.append(appendedEvents);
    return project(await readAllEvents(), scope);
  };

  const decideWithCurrentEvents = <Command>(
    handlerFactory: (store: ReturnType<typeof MemoryStore.create<DomainEvent>>) => {handle(command: Command): DomainEvent[]},
    command: Command,
  ) => {
    const memoryStore = MemoryStore.create<DomainEvent>();
    memoryStore.append(events);
    return handlerFactory(memoryStore).handle(command);
  };

  return {
    async load(scope = {}) {
      await ensureDefaultWorkspace(config.store);
      return project(await readAllEvents(), scope);
    },
    setScope(scope) {
      return project(events, scope);
    },
    getSnapshot() {
      return snapshot;
    },
    getWorkspace() {
      return workspace;
    },
    getScope() {
      return {projectId: currentProjectId, chapterId: currentChapterId};
    },
    async readEvents() {
      return readAllEvents();
    },
    async addNewSlice() {
      const newNodeNumber = snapshot.nodes.length + 1;
      const newNodeId = generateId();
      return appendAndRefreshProjection(Events.nodeAdded(currentProjectId, currentChapterId, newNodeId, 'ui', 0, `Node ${newNodeNumber}`));
    },
    async addProject(name: string) {
      await routeCommand({
        type: 'AddProject',
        data: {name},
      });

      const nextEvents = await readAllEvents();
      const nextWorkspace = projectWorkspace(nextEvents);
      const latestProjectId = nextWorkspace.latestProjectId;
      const latestChapterId = latestProjectId
        ? nextWorkspace.chaptersByProjectId[latestProjectId]?.[0]?.id
        : undefined;

      return project(nextEvents, {
        projectId: latestProjectId,
        chapterId: latestChapterId,
      });
    },
    async renameProject(projectId: string, name: string) {
      await routeCommand({
        type: 'RenameProject',
        data: {projectId, name},
      });

      return project(await readAllEvents(), {projectId: currentProjectId, chapterId: currentChapterId});
    },
    async addChapter(title: string) {
      const newChapterId = generateId();
      return appendAndRefreshProjection(
        Events.chapterAdded(currentProjectId, newChapterId, title),
        {projectId: currentProjectId, chapterId: newChapterId},
      );
    },
    async addConnection(sourceNodeId: string, targetNodeId: string, role?: 'flow' | 'back-reference') {
      return appendAndRefreshProjection(Events.nodesConnected(currentProjectId, sourceNodeId, targetNodeId, role));
    },
    async deleteConnection(edgeId: string) {
      const edge = snapshot.edges.find((candidate) => candidate.id === edgeId);
      if (!edge) {
        return snapshot;
      }
      return appendAndRefreshProjection(Events.nodesDisconnected(currentProjectId, edge.sourceId, edge.targetId));
    },
    async addConnectedNode(command: {sourceNodeId: string; nodeType: NodeType; laneId: number; label: string; role?: 'flow' | 'back-reference'}) {
      const newNodeId = generateId();
      return appendAndRefreshProjection([
        Events.nodeAdded(currentProjectId, currentChapterId, newNodeId, command.nodeType, command.laneId, command.label),
        Events.nodesConnected(currentProjectId, command.sourceNodeId, newNodeId, command.role),
      ]);
    },
    async renameNode(nodeId: string, newName: string) {
      return appendAndRefreshProjection(Events.nodeRenamed(currentProjectId, nodeId, newName));
    },
    async setNodeType(nodeId: string, type: NodeType) {
      return appendAndRefreshProjection(Events.nodeTypeChanged(currentProjectId, nodeId, type));
    },
    async changeNodeSchema(command: ChangeNodeSchemaInput) {
      return appendAndRefreshProjection(decideWithCurrentEvents(changeNodeSchemaHandler, {...command, projectId: currentProjectId}));
    },
    async changeNodeExampleValues(command: ChangeNodeExampleValuesInput) {
      return appendAndRefreshProjection(decideWithCurrentEvents(changeNodeExampleValuesHandler, {...command, projectId: currentProjectId}));
    },
    async deleteNode(nodeId: string) {
      return appendAndRefreshProjection(Events.nodeRemoved(currentProjectId, nodeId));
    },
    async replace(nextEvents: readonly DomainEvent[]) {
      await config.store.replace(nextEvents);
      return project(nextEvents, {projectId: currentProjectId, chapterId: currentChapterId});
    },
  };
}
