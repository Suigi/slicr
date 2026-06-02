import {Handler, Query, Store} from '@slicr/event-sourcing';
import {NodeType} from '../../graph/types';
import {DomainEvent, Events} from '../events';

export type AddNodeCommand = { nodeType: NodeType, laneId: number, label: string };
export type RenameNodeCommand = { nodeId: string, newName: string };
export type ChangeNodeTypeCommand = { nodeId: string, newType: NodeType };
export type RemoveNodeCommand = { nodeId: string };
export type ConnectNodesCommand = { sourceNodeId: string, targetNodeId: string, role?: 'flow' | 'back-reference' };
export type DisconnectNodesCommand = { sourceNodeId: string, targetNodeId: string };
export type AddConnectedNodeCommand = {
  sourceNodeId: string,
  nodeType: NodeType,
  laneId: number,
  label: string,
  role?: 'flow' | 'back-reference'
};

type ConnectionDecisionModel = {
  sourceExists: boolean;
  targetExists: boolean;
  connectionExists: boolean;
};

function nodeExists(events: readonly DomainEvent[]) {
  return events.some(event => event.type === 'NodeAdded') && !events.some(event => event.type === 'NodeRemoved');
}

function connectionExists(events: readonly DomainEvent[]) {
  let connected = false;
  for (const event of events) {
    if (event.type === 'NodesConnected') {
      connected = true;
    }
    if (event.type === 'NodesDisconnected') {
      connected = false;
    }
  }
  return connected;
}

function assertNodeExists(nodeId: string, exists: boolean) {
  if (!exists) {
    throw new Error(`Unknown nodeId ${nodeId}`);
  }
}

export const addNodeHandler =
  (uuidGenerator: () => string) => (store: Store<DomainEvent>) =>
    Handler.create<AddNodeCommand, DomainEvent, void>({
      store,
      query: () => Query.none(),
      project: () => undefined,
      decide: command => {
        return Events.nodeAdded(uuidGenerator(), command.nodeType, command.laneId, command.label);
      }
    });

export const addConnectedNodeHandler =
  (uuidGenerator: () => string) => (store: Store<DomainEvent>) =>
    Handler.create<AddConnectedNodeCommand, DomainEvent, boolean>({
      store,
      query: command => Query.where({tags: [`nodeId:${command.sourceNodeId}`]}),
      project: events => nodeExists(events),
      decide: (command, sourceExists) => {
        assertNodeExists(command.sourceNodeId, sourceExists);
        const newNodeId = uuidGenerator();
        return [
          Events.nodeAdded(newNodeId, command.nodeType, command.laneId, command.label),
          Events.nodesConnected(command.sourceNodeId, newNodeId, command.role),
        ];
      }
    });

export const renameNodeHandler =
  (store: Store<DomainEvent>) =>
    Handler.create<RenameNodeCommand, DomainEvent, boolean>({
      store,
      query: command => Query.where({tags: [`nodeId:${command.nodeId}`]}),
      project: events => nodeExists(events),
      decide: (command, exists) => {
        assertNodeExists(command.nodeId, exists);
        return Events.nodeRenamed(command.nodeId, command.newName);
      }
    });

export const changeNodeTypeHandler =
  (store: Store<DomainEvent>) =>
    Handler.create<ChangeNodeTypeCommand, DomainEvent, boolean>({
      store,
      query: command => Query.where({tags: [`nodeId:${command.nodeId}`]}),
      project: events => nodeExists(events),
      decide: (command, exists) => {
        assertNodeExists(command.nodeId, exists);
        return Events.nodeTypeChanged(command.nodeId, command.newType);
      }
    });

export const removeNodeHandler =
  (store: Store<DomainEvent>) =>
    Handler.create<RemoveNodeCommand, DomainEvent, boolean>({
      store,
      query: command => Query.where({tags: [`nodeId:${command.nodeId}`]}),
      project: events => nodeExists(events),
      decide: (command, exists) => {
        assertNodeExists(command.nodeId, exists);
        return Events.nodeRemoved(command.nodeId);
      }
    });

export const connectNodesHandler =
  (store: Store<DomainEvent>) =>
    Handler.create<ConnectNodesCommand, DomainEvent, ConnectionDecisionModel>({
      store,
      query: command => Query.anyOf(
        {tags: [`nodeId:${command.sourceNodeId}`]},
        {tags: [`nodeId:${command.targetNodeId}`]},
        {tags: [`sourceNodeId:${command.sourceNodeId}`, `targetNodeId:${command.targetNodeId}`]},
      ),
      project: (events, command) => ({
        sourceExists: nodeExists(events.filter(event => event.tags.includes(`nodeId:${command.sourceNodeId}`))),
        targetExists: nodeExists(events.filter(event => event.tags.includes(`nodeId:${command.targetNodeId}`))),
        connectionExists: connectionExists(events.filter(event =>
          event.tags.includes(`sourceNodeId:${command.sourceNodeId}`) &&
          event.tags.includes(`targetNodeId:${command.targetNodeId}`),
        )),
      }),
      decide: (command, model) => {
        assertNodeExists(command.sourceNodeId, model.sourceExists);
        assertNodeExists(command.targetNodeId, model.targetExists);
        if (command.sourceNodeId === command.targetNodeId || model.connectionExists) {
          return [];
        }
        return Events.nodesConnected(command.sourceNodeId, command.targetNodeId, command.role);
      }
    });

export const disconnectNodesHandler =
  (store: Store<DomainEvent>) =>
    Handler.create<DisconnectNodesCommand, DomainEvent, ConnectionDecisionModel>({
      store,
      query: command => Query.anyOf(
        {tags: [`nodeId:${command.sourceNodeId}`]},
        {tags: [`nodeId:${command.targetNodeId}`]},
        {tags: [`sourceNodeId:${command.sourceNodeId}`, `targetNodeId:${command.targetNodeId}`]},
      ),
      project: (events, command) => ({
        sourceExists: nodeExists(events.filter(event => event.tags.includes(`nodeId:${command.sourceNodeId}`))),
        targetExists: nodeExists(events.filter(event => event.tags.includes(`nodeId:${command.targetNodeId}`))),
        connectionExists: connectionExists(events.filter(event =>
          event.tags.includes(`sourceNodeId:${command.sourceNodeId}`) &&
          event.tags.includes(`targetNodeId:${command.targetNodeId}`),
        )),
      }),
      decide: (command, model) => {
        assertNodeExists(command.sourceNodeId, model.sourceExists);
        assertNodeExists(command.targetNodeId, model.targetExists);
        if (!model.connectionExists) {
          return [];
        }
        return Events.nodesDisconnected(command.sourceNodeId, command.targetNodeId);
      }
    });
