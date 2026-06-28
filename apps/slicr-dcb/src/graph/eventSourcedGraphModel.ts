import {
  type DcbEvent,
  type SpecEventStore
} from '../domain/eventSourcing';
import {v4 as uuid} from 'uuid';

import {createCommandRouter} from '../application/commandRouter';
import {projectGraph} from '../domain/graphProjector/graphProjector';
import {projectWorkspace, type WorkspaceProjection} from '../domain/workspaceProjector';
import {adaptModelGraphToRenderer, type RendererGraph} from './domainGraphAdapter';
import type {NodeType} from './types';
import {ChangeNodeExampleValues, ChangeNodeSchema} from '../domain/graphCommands/commands';

const DEFAULT_PROJECT_ID = 'default-project';
const DEFAULT_CHAPTER_ID = 'default-chapter';

type ChangeNodeSchemaInput = Omit<ChangeNodeSchema['data'], 'projectId'>;
type ChangeNodeExampleValuesInput = Omit<ChangeNodeExampleValues['data'], 'projectId'>;

export type GraphModelScope = {
  projectId?: string;
  chapterId?: string;
};

export type EventSourcedGraphModel = {
  load(scope?: GraphModelScope): Promise<RendererGraph>;
  setScope(scope: GraphModelScope): Promise<RendererGraph>;
  getSnapshot(): RendererGraph;
  getWorkspace(): WorkspaceProjection;
  getScope(): { projectId: string; chapterId: string };
  addNewSlice(): Promise<RendererGraph>;
  addProject(name: string): Promise<RendererGraph>;
  renameProject(projectId: string, name: string): Promise<RendererGraph>;
  addChapter(title: string): Promise<RendererGraph>;
  addConnection(sourceNodeId: string, targetNodeId: string, role?: 'flow' | 'back-reference'): Promise<RendererGraph>;
  deleteConnection(edgeId: string): Promise<RendererGraph>;
  addConnectedNode(command: {
    sourceNodeId: string;
    nodeType: NodeType;
    laneId: number;
    label: string;
    role?: 'flow' | 'back-reference'
  }): Promise<RendererGraph>;
  renameNode(nodeId: string, newName: string): Promise<RendererGraph>;
  setNodeType(nodeId: string, type: NodeType): Promise<RendererGraph>;
  changeNodeSchema(command: ChangeNodeSchemaInput): Promise<RendererGraph>;
  changeNodeExampleValues(command: ChangeNodeExampleValuesInput): Promise<RendererGraph>;
  deleteNode(nodeId: string): Promise<RendererGraph>;
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

export function createEventSourcedGraphModel(config: {
  commandStore: SpecEventStore<DcbEvent>,
  uuidGenerator?: () => string,
}): EventSourcedGraphModel {
  const generateId = config.uuidGenerator ?? uuid;
  const routeCommand = createCommandRouter({
    store: config.commandStore,
    generateUuid: generateId,
  });
  const readAllEvents = async () => (await config.commandStore.read()).map(({event}) => event);
  let snapshot: RendererGraph = {nodes: [], edges: [], lanes: [], nodeSchemas: {}, nodeExampleValues: {}};
  let workspace: WorkspaceProjection = projectWorkspace([]);
  let currentProjectId = DEFAULT_PROJECT_ID;
  let currentChapterId = DEFAULT_CHAPTER_ID;

  const project = (events: readonly DcbEvent[], scope: GraphModelScope = {}) => {
    workspace = projectWorkspace(events);
    ({projectId: currentProjectId, chapterId: currentChapterId} = resolveScope(workspace, scope));

    snapshot = adaptModelGraphToRenderer(projectGraph(events, currentProjectId, currentChapterId));
    return snapshot;
  };

  return {
    async load(scope = {}) {
      return project(await readAllEvents(), scope);
    },
    async setScope(scope) {
      return project(await readAllEvents(), scope);
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
    async addNewSlice() {
      const newNodeNumber = snapshot.nodes.length + 1;
      await routeCommand({
        type: 'AddNode',
        data: {
          projectId: currentProjectId,
          chapterId: currentChapterId,
          nodeType: 'ui',
          label: `Node ${newNodeNumber}`,
          laneId: 0,
        }
      });
      return project(await readAllEvents(), {projectId: currentProjectId, chapterId: currentChapterId});
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
      await routeCommand({
        type: 'AddChapter',
        data: {projectId: currentProjectId, title},
      });
      const events = await readAllEvents();
      const workspace = projectWorkspace(events);
      const latestChapterId = workspace.chaptersByProjectId[currentProjectId]?.at(-1)?.id;
      return project(events, {projectId: currentProjectId, chapterId: latestChapterId});
    },
    async addConnection(sourceNodeId: string, targetNodeId: string, role?: 'flow' | 'back-reference') {
      await routeCommand({
        type: 'ConnectNodes',
        data: {
          projectId: currentProjectId,
          sourceNodeId,
          targetNodeId,
          role,
        }
      });
      return project(await readAllEvents(), {projectId: currentProjectId, chapterId: currentChapterId});
    },
    async deleteConnection(edgeId: string) {
      const edge = snapshot.edges.find((candidate) => candidate.id === edgeId);
      if (!edge) {
        return snapshot;
      }

      await routeCommand({
        type: 'DisconnectNodes',
        data: {
          projectId: currentProjectId,
          sourceNodeId: edge.sourceId,
          targetNodeId: edge.targetId,
        },
      });

      return project(await readAllEvents(), {
        projectId: currentProjectId,
        chapterId: currentChapterId,
      });
    },
    async addConnectedNode(command: {
      sourceNodeId: string;
      nodeType: NodeType;
      laneId: number;
      label: string;
      role?: 'flow' | 'back-reference'
    }) {
      await routeCommand({
        type: 'AddConnectedNode',
        data: {
          projectId: currentProjectId,
          chapterId: currentChapterId,
          sourceNodeId: command.sourceNodeId,
          nodeType: command.nodeType,
          laneId: command.laneId,
          label: command.label,
          role: command.role,
        },
      });

      return project(await readAllEvents(), {
        projectId: currentProjectId,
        chapterId: currentChapterId,
      });
    },
    async renameNode(nodeId: string, newName: string) {
      await routeCommand({
        type: 'RenameNode',
        data: {
          projectId: currentProjectId,
          nodeId,
          newName,
        }
      });
      return project(await readAllEvents(), {projectId: currentProjectId, chapterId: currentChapterId});
    },
    async setNodeType(nodeId: string, type: NodeType) {
      await routeCommand({
        type: 'ChangeNodeType',
        data: {
          projectId: currentProjectId,
          nodeId: nodeId,
          newType: type,
        }
      });
      return project(await readAllEvents(), {projectId: currentProjectId, chapterId: currentChapterId});
    },
    async changeNodeSchema(command: ChangeNodeSchemaInput) {
      await routeCommand({
        type: 'ChangeNodeSchema',
        data: {
          projectId: currentProjectId,
          nodeId: command.nodeId,
          schema: command.schema,
        }
      })
      return project(await readAllEvents(), {projectId: currentProjectId, chapterId: currentChapterId});
    },
    async changeNodeExampleValues(command: ChangeNodeExampleValuesInput) {
      await routeCommand({
        type: 'ChangeNodeExampleValues',
        data: {
          projectId: currentProjectId,
          nodeId: command.nodeId,
          exampleValues: command.exampleValues,
        }
      });
      return project(await readAllEvents(), {projectId: currentProjectId, chapterId: currentChapterId});
    },
    async deleteNode(nodeId: string) {
      await routeCommand({
        type: 'DeleteNode',
        data: {
          projectId: currentProjectId,
          nodeId,
        }
      });
      return project(await readAllEvents(), {projectId: currentProjectId, chapterId: currentChapterId});
    },
  };
}
