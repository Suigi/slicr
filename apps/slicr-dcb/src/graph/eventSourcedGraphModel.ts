import {MemoryStore} from '@slicr/event-sourcing';

import {Events, type DomainEvent} from '../domain/events';
import {GraphProjector} from '../domain/graphProjector/graphProjector';
import {adaptModelGraphToRenderer, type RendererGraph} from './domainGraphAdapter';
import type {NodeType} from './types';

export type AsyncGraphEventStore = {
  append(events: DomainEvent | readonly DomainEvent[]): Promise<void>;
  readAll(): Promise<DomainEvent[]>;
  replace(events: readonly DomainEvent[]): Promise<void>;
  clear(): Promise<void>;
};

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
    snapshot = adaptModelGraphToRenderer(GraphProjector.create({store: memoryStore}).project());
    return snapshot;
  };

  const appendAndProject = async (event: DomainEvent | readonly DomainEvent[]) => {
    await config.store.append(event);
    const appendedEvents = Array.isArray(event) ? event : [event];
    return project([...events, ...appendedEvents]);
  };

  return {
    async load() {
      return project(await config.store.readAll());
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
      return appendAndProject(Events.nodeAdded(newNodeId, 'ui', 0, `Node ${newNodeNumber}`));
    },
    async addConnection(sourceNodeId: string, targetNodeId: string, role?: 'flow' | 'back-reference') {
      return appendAndProject(Events.nodesConnected(sourceNodeId, targetNodeId, role));
    },
    async deleteConnection(edgeId: string) {
      const edge = snapshot.edges.find((candidate) => candidate.id === edgeId);
      if (!edge) {
        return snapshot;
      }
      return appendAndProject(Events.nodesDisconnected(edge.sourceId, edge.targetId));
    },
    async addConnectedNode(command: {sourceNodeId: string; nodeType: NodeType; laneId: number; label: string; role?: 'flow' | 'back-reference'}) {
      const newNodeNumber = Math.max(0, ...snapshot.nodes.map((node) => Number(node.id.replace('node-', '')) || 0)) + 1;
      const newNodeId = `node-${newNodeNumber}`;
      return appendAndProject([
        Events.nodeAdded(newNodeId, command.nodeType, command.laneId, command.label),
        Events.nodesConnected(command.sourceNodeId, newNodeId, command.role),
      ]);
    },
    async renameNode(nodeId: string, newName: string) {
      return appendAndProject(Events.nodeRenamed(nodeId, newName));
    },
    async setNodeType(nodeId: string, type: NodeType) {
      return appendAndProject(Events.nodeTypeChanged(nodeId, type));
    },
    async deleteNode(nodeId: string) {
      return appendAndProject(Events.nodeRemoved(nodeId));
    },
    async replace(nextEvents: readonly DomainEvent[]) {
      await config.store.replace(nextEvents);
      return project(nextEvents);
    },
  };
}
