import {type DcbEvent, type Event, Handler, Query, Store} from '../eventSourcing';
import {NodeType} from '../../graph/types';
import {
  Events,
  type NodePropertyExampleValues,
  type NodePropertySchema,
  NodesConnected,
  NodesDisconnected
} from '../events';

export type AddNodeCommand = { projectId: string, chapterId: string, nodeType: NodeType, laneId: number, label: string };
export type RenameNodeCommand = { projectId: string, nodeId: string, newName: string };
export type ChangeNodeTypeCommand = { projectId: string, nodeId: string, newType: NodeType };
export type ChangeNodeSchemaCommand = { projectId: string, nodeId: string, schema: NodePropertySchema[] };
export type ChangeNodeExampleValuesCommand = { projectId: string, nodeId: string, exampleValues: NodePropertyExampleValues[] };
export type RemoveNodeCommand = { projectId: string, nodeId: string };
export type ConnectNodesCommand = { projectId: string, sourceNodeId: string, targetNodeId: string, role?: 'flow' | 'back-reference' };
export type DisconnectNodesCommand = { projectId: string, sourceNodeId: string, targetNodeId: string };
export type AddConnectedNodeCommand = {
  projectId: string,
  chapterId: string,
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

type NodeSchemaDecisionModel = {
  exists: boolean;
  schema: NodePropertySchema[];
};

type NodeExampleValuesDecisionModel = {
  exists: boolean;
  exampleValues: NodePropertyExampleValues[];
};

function nodeExists(events: readonly DcbEvent[]) {
  let exists = false;
  for (const event of events) {
    if (event.type === 'NodeAdded') {
      exists = true;
    }
    if (event.type === 'NodeRemoved') {
      exists = false;
    }
  }
  return exists;
}

function assertNodeExists(nodeId: string, exists: boolean) {
  if (!exists) {
    throw new Error(`Unknown nodeId ${nodeId}`);
  }
}

function samePayload(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function projectTag(projectId: string) {
  return `projectId:${projectId}`;
}

function nodeTags(projectId: string, nodeId: string) {
  return [projectTag(projectId), `nodeId:${nodeId}`];
}

function connectionTags(projectId: string, sourceNodeId: string, targetNodeId: string) {
  return [projectTag(projectId), `connection:${sourceNodeId}->${targetNodeId}`];
}

function isProjectEvent(projectId: string, event: DcbEvent) {
  return event.tags.includes(projectTag(projectId));
}

export const addNodeHandler =
  (uuidGenerator: () => string) => (store: Store<DcbEvent>) =>
    Handler.create<AddNodeCommand, DcbEvent, void>({
      store,
      query: () => Query.none(),
      project: () => undefined,
      decide: command => {
        return Events.nodeAdded(command.projectId, command.chapterId, uuidGenerator(), command.nodeType, command.laneId, command.label);
      }
    });

export const addConnectedNodeHandler =
  (uuidGenerator: () => string) => (store: Store<DcbEvent>) =>
    Handler.create<AddConnectedNodeCommand, DcbEvent, boolean>({
      store,
      query: command => Query.where({tags: nodeTags(command.projectId, command.sourceNodeId)}),
      project: events => nodeExists(events),
      decide: (command, sourceExists) => {
        assertNodeExists(command.sourceNodeId, sourceExists);
        const newNodeId = uuidGenerator();
        return [
          Events.nodeAdded(command.projectId, command.chapterId, newNodeId, command.nodeType, command.laneId, command.label),
          Events.nodesConnected(command.projectId, command.sourceNodeId, newNodeId, command.role),
        ];
      }
    });

export const renameNodeHandler =
  (store: Store<DcbEvent>) =>
    Handler.create<RenameNodeCommand, DcbEvent, boolean>({
      store,
      query: command => Query.where({tags: nodeTags(command.projectId, command.nodeId)}),
      project: events => nodeExists(events),
      decide: (command, exists) => {
        assertNodeExists(command.nodeId, exists);
        return Events.nodeRenamed(command.projectId, command.nodeId, command.newName);
      }
    });

export const changeNodeTypeHandler =
  (store: Store<DcbEvent>) =>
    Handler.create<ChangeNodeTypeCommand, DcbEvent, boolean>({
      store,
      query: command => Query.where({tags: nodeTags(command.projectId, command.nodeId)}),
      project: events => nodeExists(events),
      decide: (command, exists) => {
        assertNodeExists(command.nodeId, exists);
        return Events.nodeTypeChanged(command.projectId, command.nodeId, command.newType);
      }
    });

export const changeNodeSchemaHandler =
  (store: Store<DcbEvent>) =>
    Handler.create<ChangeNodeSchemaCommand, DcbEvent, NodeSchemaDecisionModel>({
      store,
      query: command => Query.where({tags: nodeTags(command.projectId, command.nodeId)}),
      project: events => ({
        exists: nodeExists(events),
        schema: events.reduce<NodePropertySchema[]>((schema, event) => {
          if (event.type === 'NodeSchemaChanged') {
            return event.payload.schema;
          }
          return schema;
        }, []),
      }),
      decide: (command, model) => {
        assertNodeExists(command.nodeId, model.exists);
        if (samePayload(command.schema, model.schema)) {
          return [];
        }
        return Events.nodeSchemaChanged(command.projectId, command.nodeId, command.schema);
      }
    });

export const changeNodeExampleValuesHandler =
  (store: Store<DcbEvent>) =>
    Handler.create<ChangeNodeExampleValuesCommand, DcbEvent, NodeExampleValuesDecisionModel>({
      store,
      query: command => Query.where({tags: nodeTags(command.projectId, command.nodeId)}),
      project: events => ({
        exists: nodeExists(events),
        exampleValues: events.reduce<NodePropertyExampleValues[]>((exampleValues, event) => {
          if (event.type === 'NodeExampleValuesChanged') {
            return event.payload.exampleValues;
          }
          return exampleValues;
        }, []),
      }),
      decide: (command, model) => {
        assertNodeExists(command.nodeId, model.exists);
        if (samePayload(command.exampleValues, model.exampleValues)) {
          return [];
        }
        return Events.nodeExampleValuesChanged(command.projectId, command.nodeId, command.exampleValues);
      }
    });

export const removeNodeHandler =
  (store: Store<DcbEvent>) =>
    Handler.create<RemoveNodeCommand, DcbEvent, boolean>({
      store,
      query: command => Query.where({tags: nodeTags(command.projectId, command.nodeId)}),
      project: events => nodeExists(events),
      decide: (command, exists) => {
        assertNodeExists(command.nodeId, exists);
        return Events.nodeRemoved(command.projectId, command.nodeId);
      }
    });

function connectionExists(events: readonly DcbEvent[], sourceNodeId: string, targetNodeId: string) {
  const isMatch = (event: (Event<'NodesConnected', NodesConnected>|Event<'NodesDisconnected', NodesDisconnected>)) => {
    return event.payload.sourceNodeId === sourceNodeId && event.payload.targetNodeId === targetNodeId;
  };

  let connected = false;
  for (const event of events) {
    switch (event.type) {
      case 'NodesConnected':
        if (isMatch(event)) {
          connected = true;
        }
        break;
      case 'NodesDisconnected':
        if (isMatch(event)) {
          connected = false;
        }
        break;
    }
  }
  return connected;
}

export const connectNodesHandler =
  (store: Store<DcbEvent>) =>
    Handler.create<ConnectNodesCommand, DcbEvent, ConnectionDecisionModel>({
      store,
      query: command => Query.anyOf(
        {tags: nodeTags(command.projectId, command.sourceNodeId)},
        {tags: nodeTags(command.projectId, command.targetNodeId)},
        {tags: connectionTags(command.projectId, command.sourceNodeId, command.targetNodeId)},
      ),
      project: (events, command) => ({
        sourceExists: nodeExists(events.filter(event => isProjectEvent(command.projectId, event) && event.tags.includes(`nodeId:${command.sourceNodeId}`))),
        targetExists: nodeExists(events.filter(event => isProjectEvent(command.projectId, event) && event.tags.includes(`nodeId:${command.targetNodeId}`))),
        connectionExists: connectionExists(events.filter(event => isProjectEvent(command.projectId, event)), command.sourceNodeId, command.targetNodeId),
      }),
      decide: (command, model) => {
        assertNodeExists(command.sourceNodeId, model.sourceExists);
        assertNodeExists(command.targetNodeId, model.targetExists);
        if (command.sourceNodeId === command.targetNodeId || model.connectionExists) {
          return [];
        }
        return Events.nodesConnected(command.projectId, command.sourceNodeId, command.targetNodeId, command.role);
      }
    });

export const disconnectNodesHandler =
  (store: Store<DcbEvent>) =>
    Handler.create<DisconnectNodesCommand, DcbEvent, ConnectionDecisionModel>({
      store,
      query: command => Query.anyOf(
        {tags: nodeTags(command.projectId, command.sourceNodeId)},
        {tags: nodeTags(command.projectId, command.targetNodeId)},
        {tags: connectionTags(command.projectId, command.sourceNodeId, command.targetNodeId)},
      ),
      project: (events, command) => ({
        sourceExists: nodeExists(events.filter(event => isProjectEvent(command.projectId, event) && event.tags.includes(`nodeId:${command.sourceNodeId}`))),
        targetExists: nodeExists(events.filter(event => isProjectEvent(command.projectId, event) && event.tags.includes(`nodeId:${command.targetNodeId}`))),
        connectionExists: connectionExists(events.filter(event => isProjectEvent(command.projectId, event)), command.sourceNodeId, command.targetNodeId),
      }),
      decide: (command, model) => {
        assertNodeExists(command.sourceNodeId, model.sourceExists);
        assertNodeExists(command.targetNodeId, model.targetExists);
        if (!model.connectionExists) {
          return [];
        }
        return Events.nodesDisconnected(command.projectId, command.sourceNodeId, command.targetNodeId);
      }
    });
