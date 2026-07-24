import {v4 as uuid} from 'uuid';

import {createCommandRouter} from '../application/commandRouter';
import {createGraphProjectionService, type GraphProjectionService} from '../application/graphProjectionService';
import type {DcbEvent, SpecEventStore} from '../domain/eventSourcing';
import {ChangeNodeExampleValues, ChangeNodeSchema} from '../domain/graphCommands/commands';
import type {WorkspaceProjection} from '../domain/workspaceProjector';
import type {RendererGraph} from './domainGraphAdapter';
import type {NodeType} from './types';

type ChangeNodeSchemaInput = Omit<ChangeNodeSchema['data'], 'projectId'>;
type ChangeNodeExampleValuesInput = Omit<ChangeNodeExampleValues['data'], 'projectId'>;

export type GraphModelScope = {
  projectId?: string;
  chapterId?: string;
};

type Subscription = {
  unsubscribe(): void;
};

type ScopedGraphView = {
  getScope(): {projectId: string; chapterId: string};
  setScope(scope: GraphModelScope): Promise<RendererGraph>;
  getSnapshot(): RendererGraph;
  subscribe(listener: (graph: RendererGraph) => void, options?: {emitCurrent?: boolean}): Subscription;
};

export type EventSourcedGraphModel = {
  load(scope?: GraphModelScope): Promise<RendererGraph>;
  setScope(scope: GraphModelScope): Promise<RendererGraph>;
  getSnapshot(): RendererGraph;
  getWorkspace(): WorkspaceProjection;
  getScope(): {projectId: string; chapterId: string};
  subscribeToWorkspace(listener: (workspace: WorkspaceProjection) => void, options?: {emitCurrent?: boolean}): Subscription;
  createScopedGraphView(initialScope?: GraphModelScope): ScopedGraphView;
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
    role?: 'flow' | 'back-reference';
  }): Promise<RendererGraph>;
  renameNode(nodeId: string, newName: string): Promise<RendererGraph>;
  setNodeType(nodeId: string, type: NodeType): Promise<RendererGraph>;
  changeNodeSchema(command: ChangeNodeSchemaInput): Promise<RendererGraph>;
  changeNodeExampleValues(command: ChangeNodeExampleValuesInput): Promise<RendererGraph>;
  deleteNode(nodeId: string): Promise<RendererGraph>;
};

export function createEventSourcedGraphModel(config: {
  commandStore: SpecEventStore<DcbEvent>;
  projectionService?: GraphProjectionService;
  uuidGenerator?: () => string;
}): EventSourcedGraphModel {
  const generateId = config.uuidGenerator ?? uuid;
  const routeCommand = createCommandRouter({
    store: config.commandStore,
    generateUuid: generateId,
  });
  const projectionService = config.projectionService ?? createGraphProjectionService({commandStore: config.commandStore});
  const graphView = projectionService.createScopedGraphView();

  let workspaceSnapshot = projectionService.getWorkspaceSnapshot();
  let graphSnapshot = graphView.getSnapshot();
  let resolvedScope = graphView.getScope();

  const subscribeToWorkspace = projectionService.subscribeToWorkspace.bind(projectionService);
  const createScopedGraphView = projectionService.createScopedGraphView.bind(projectionService);

  subscribeToWorkspace((workspace) => {
    workspaceSnapshot = workspace;
  });
  graphView.subscribe((graph) => {
    graphSnapshot = graph;
    resolvedScope = graphView.getScope();
  });

  const currentScope = () => resolvedScope;
  const currentGraph = () => graphSnapshot;

  return {
    async load(scope = {}) {
      await graphView.setScope(scope);
      await projectionService.refresh();
      return currentGraph();
    },
    async setScope(scope) {
      await graphView.setScope(scope);
      return currentGraph();
    },
    getSnapshot() {
      return currentGraph();
    },
    getWorkspace() {
      return workspaceSnapshot;
    },
    getScope() {
      return currentScope();
    },
    subscribeToWorkspace,
    createScopedGraphView,
    async addNewSlice() {
      const scope = currentScope();
      const newNodeNumber = currentGraph().nodes.length + 1;
      await routeCommand({
        type: 'AddNode',
        data: {
          projectId: scope.projectId,
          chapterId: scope.chapterId,
          nodeType: 'ui',
          label: `Node ${newNodeNumber}`,
          laneId: 0,
        },
      });
      return currentGraph();
    },
    async addProject(name: string) {
      await routeCommand({
        type: 'AddProject',
        data: {name},
      });

      const latestProjectId = workspaceSnapshot.latestProjectId;
      const latestChapterId = latestProjectId ? workspaceSnapshot.chaptersByProjectId[latestProjectId]?.[0]?.id : undefined;

      if (latestProjectId && latestChapterId) {
        await graphView.setScope({projectId: latestProjectId, chapterId: latestChapterId});
      }

      return currentGraph();
    },
    async renameProject(projectId: string, name: string) {
      await routeCommand({
        type: 'RenameProject',
        data: {projectId, name},
      });

      return currentGraph();
    },
    async addChapter(title: string) {
      const scope = currentScope();
      await routeCommand({
        type: 'AddChapter',
        data: {projectId: scope.projectId, title},
      });
      const latestChapterId = workspaceSnapshot.chaptersByProjectId[scope.projectId]?.at(-1)?.id;
      if (latestChapterId) {
        await graphView.setScope({projectId: scope.projectId, chapterId: latestChapterId});
      }

      return currentGraph();
    },
    async addConnection(sourceNodeId: string, targetNodeId: string, role?: 'flow' | 'back-reference') {
      const scope = currentScope();
      await routeCommand({
        type: 'ConnectNodes',
        data: {
          projectId: scope.projectId,
          sourceNodeId,
          targetNodeId,
          role,
        },
      });
      return currentGraph();
    },
    async deleteConnection(edgeId: string) {
      const edge = currentGraph().edges.find((candidate) => candidate.id === edgeId);
      if (!edge) {
        return currentGraph();
      }

      const scope = currentScope();
      await routeCommand({
        type: 'DisconnectNodes',
        data: {
          projectId: scope.projectId,
          sourceNodeId: edge.sourceId,
          targetNodeId: edge.targetId,
        },
      });

      return currentGraph();
    },
    async addConnectedNode(command: {
      sourceNodeId: string;
      nodeType: NodeType;
      laneId: number;
      label: string;
      role?: 'flow' | 'back-reference';
    }) {
      const scope = currentScope();
      await routeCommand({
        type: 'AddConnectedNode',
        data: {
          projectId: scope.projectId,
          chapterId: scope.chapterId,
          sourceNodeId: command.sourceNodeId,
          nodeType: command.nodeType,
          laneId: command.laneId,
          label: command.label,
          role: command.role,
        },
      });

      return currentGraph();
    },
    async renameNode(nodeId: string, newName: string) {
      const scope = currentScope();
      await routeCommand({
        type: 'RenameNode',
        data: {
          projectId: scope.projectId,
          nodeId,
          newName,
        },
      });
      return currentGraph();
    },
    async setNodeType(nodeId: string, type: NodeType) {
      const scope = currentScope();
      await routeCommand({
        type: 'ChangeNodeType',
        data: {
          projectId: scope.projectId,
          nodeId: nodeId,
          newType: type,
        },
      });
      return currentGraph();
    },
    async changeNodeSchema(command: ChangeNodeSchemaInput) {
      const scope = currentScope();
      await routeCommand({
        type: 'ChangeNodeSchema',
        data: {
          projectId: scope.projectId,
          nodeId: command.nodeId,
          schema: command.schema,
        },
      });
      return currentGraph();
    },
    async changeNodeExampleValues(command: ChangeNodeExampleValuesInput) {
      const scope = currentScope();
      await routeCommand({
        type: 'ChangeNodeExampleValues',
        data: {
          projectId: scope.projectId,
          nodeId: command.nodeId,
          exampleValues: command.exampleValues,
        },
      });
      return currentGraph();
    },
    async deleteNode(nodeId: string) {
      const scope = currentScope();
      await routeCommand({
        type: 'DeleteNode',
        data: {
          projectId: scope.projectId,
          nodeId,
        },
      });
      return currentGraph();
    },
  };
}
