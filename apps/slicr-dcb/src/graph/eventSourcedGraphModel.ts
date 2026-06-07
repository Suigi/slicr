import {MemoryStore} from '@slicr/event-sourcing';

import {Events, type DomainEvent} from '../domain/events';
import {
  changeNodeExampleValuesHandler,
  changeNodeSchemaHandler,
  type ChangeNodeExampleValuesCommand as ScopedChangeNodeExampleValuesCommand,
  type ChangeNodeSchemaCommand as ScopedChangeNodeSchemaCommand,
} from '../domain/nodeCommands/handler';
import {GraphProjector} from '../domain/graphProjector/graphProjector';
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

export type AsyncGraphEventStore = {
  append(events: DomainEvent | readonly DomainEvent[]): Promise<void>;
  readAll(): Promise<DomainEvent[]>;
  replace(events: readonly DomainEvent[]): Promise<void>;
  clear(): Promise<void>;
};

type ChangeNodeSchemaInput = Omit<ScopedChangeNodeSchemaCommand, 'projectId'>;
type ChangeNodeExampleValuesInput = Omit<ScopedChangeNodeExampleValuesCommand, 'projectId'>;

export type EventSourcedGraphModel = {
  load(): Promise<RendererGraph>;
  getSnapshot(): RendererGraph;
  readEvents(): Promise<DomainEvent[]>;
  addNewSlice(): Promise<RendererGraph>;
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

export function createEventSourcedGraphModel(config: {store: AsyncGraphEventStore}): EventSourcedGraphModel {
  let snapshot: RendererGraph = {nodes: [], edges: [], lanes: [], nodeSchemas: {}, nodeExampleValues: {}};

  let events: DomainEvent[] = [];

  const project = (nextEvents: readonly DomainEvent[]) => {
    events = [...nextEvents];
    const memoryStore = MemoryStore.create<DomainEvent>();
    memoryStore.append(events);
    snapshot = adaptModelGraphToRenderer(GraphProjector.create({store: memoryStore}).project(DEFAULT_PROJECT_ID, DEFAULT_CHAPTER_ID));
    return snapshot;
  };

  const appendAndProject = async (event: DomainEvent | readonly DomainEvent[]) => {
    const appendedEvents = Array.isArray(event) ? event : [event];
    if (appendedEvents.length === 0) {
      return snapshot;
    }
    await config.store.append(appendedEvents);
    return project([...events, ...appendedEvents]);
  };

  const decideWithCurrentEvents = <Command>(handlerFactory: (store: ReturnType<typeof MemoryStore.create<DomainEvent>>) => {handle(command: Command): DomainEvent[]}, command: Command) => {
    const memoryStore = MemoryStore.create<DomainEvent>();
    memoryStore.append(events);
    return handlerFactory(memoryStore).handle(command);
  };

  return {
    async load() {
      const storedEvents = await config.store.readAll();
      if (storedEvents.length === 0) {
        await config.store.append(defaultWorkspaceEvents);
        return project(defaultWorkspaceEvents);
      }
      return project(storedEvents);
    },
    getSnapshot() {
      return snapshot;
    },
    async readEvents() {
      return config.store.readAll();
    },
    async addNewSlice() {
      const newNodeNumber = Math.max(0, ...snapshot.nodes.map((node) => Number(node.id.replace('node-', '')) || 0)) + 1;
      const newNodeId = `node-${newNodeNumber}`;
      return appendAndProject(Events.nodeAdded(DEFAULT_PROJECT_ID, DEFAULT_CHAPTER_ID, newNodeId, 'ui', 0, `Node ${newNodeNumber}`));
    },
    async addConnection(sourceNodeId: string, targetNodeId: string, role?: 'flow' | 'back-reference') {
      return appendAndProject(Events.nodesConnected(DEFAULT_PROJECT_ID, sourceNodeId, targetNodeId, role));
    },
    async deleteConnection(edgeId: string) {
      const edge = snapshot.edges.find((candidate) => candidate.id === edgeId);
      if (!edge) {
        return snapshot;
      }
      return appendAndProject(Events.nodesDisconnected(DEFAULT_PROJECT_ID, edge.sourceId, edge.targetId));
    },
    async addConnectedNode(command: {sourceNodeId: string; nodeType: NodeType; laneId: number; label: string; role?: 'flow' | 'back-reference'}) {
      const newNodeNumber = Math.max(0, ...snapshot.nodes.map((node) => Number(node.id.replace('node-', '')) || 0)) + 1;
      const newNodeId = `node-${newNodeNumber}`;
      return appendAndProject([
        Events.nodeAdded(DEFAULT_PROJECT_ID, DEFAULT_CHAPTER_ID, newNodeId, command.nodeType, command.laneId, command.label),
        Events.nodesConnected(DEFAULT_PROJECT_ID, command.sourceNodeId, newNodeId, command.role),
      ]);
    },
    async renameNode(nodeId: string, newName: string) {
      return appendAndProject(Events.nodeRenamed(DEFAULT_PROJECT_ID, nodeId, newName));
    },
    async setNodeType(nodeId: string, type: NodeType) {
      return appendAndProject(Events.nodeTypeChanged(DEFAULT_PROJECT_ID, nodeId, type));
    },
    async changeNodeSchema(command: ChangeNodeSchemaInput) {
      return appendAndProject(decideWithCurrentEvents(changeNodeSchemaHandler, {...command, projectId: DEFAULT_PROJECT_ID}));
    },
    async changeNodeExampleValues(command: ChangeNodeExampleValuesInput) {
      return appendAndProject(decideWithCurrentEvents(changeNodeExampleValuesHandler, {...command, projectId: DEFAULT_PROJECT_ID}));
    },
    async deleteNode(nodeId: string) {
      return appendAndProject(Events.nodeRemoved(DEFAULT_PROJECT_ID, nodeId));
    },
    async replace(nextEvents: readonly DomainEvent[]) {
      await config.store.replace(nextEvents);
      return project(nextEvents);
    },
  };
}
