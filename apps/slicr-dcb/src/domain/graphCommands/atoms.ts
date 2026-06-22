import {Query} from '@slicr/event-sourcing';
import {ChapterId, DomainEvent, NodeId, NodePropertyExampleValues, NodePropertySchema, ProjectId} from '../events';

export type Atom<Scope, Model> = {
  query: (scope: Scope) => Query;
  project: (scope: Scope, events: readonly DomainEvent[]) => Model;
};

export const scopeAtom = <Command, Scope, Model>(
  atom: Atom<Scope, Model>,
  scope: (command: Command) => Scope,
) => ({
  query: (command: Command) => atom.query(scope(command)),
  project: (command: Command, events: readonly DomainEvent[]) =>
    atom.project(scope(command), events),
});

const noOp: Atom<void, unknown> = {
  query: () => Query.none(),
  project: () => undefined,
};

const projectExists: Atom<{ projectId: ProjectId }, boolean> = {
  query: ({projectId}) => Query.where({types: ['ProjectAdded'], tags: [`projectId:${projectId}`]}),
  project: ({projectId}, events) => events.some(event => event.type === 'ProjectAdded' && event.payload.projectId === projectId),
};

const chapterExists: Atom<{ chapterId: ChapterId }, boolean> = {
  query: ({chapterId}) => Query.where({types: ['ChapterAdded'], tags: [`chapterId:${chapterId}`]}),
  project: ({chapterId}, events) => events.some(event => event.type === 'ChapterAdded' && event.payload.chapterId === chapterId),
};

const nodeExists: Atom<{
  projectId: ProjectId,
  nodeId: NodeId
}, boolean> = {
  query: (scope) => Query.where({
    types: ['NodeAdded', 'NodeRemoved'],
    tags: [`projectId:${scope.projectId}`, `nodeId:${scope.nodeId}`]
  }),
  project: (scope, events) => {
    let nodeExists = false;
    events.forEach(event => {
      if (event.type === 'NodeAdded' &&
        event.payload.projectId === scope.projectId &&
        event.payload.nodeId === scope.nodeId
      ) {
        nodeExists = true;
      }
      if (event.type === 'NodeRemoved' &&
        event.payload.projectId === scope.projectId &&
        event.payload.nodeId === scope.nodeId) {
        nodeExists = false;
      }
    });
    return nodeExists;
  },
};

const connectionExists: Atom<{
  projectId: ProjectId,
  sourceNodeId: NodeId,
  targetNodeId: NodeId,
}, boolean> = {
  query: (scope) => Query.where({
    types: ['NodesConnected', 'NodesDisconnected'],
    tags: [
      `projectId:${scope.projectId}`,
      `connection:${scope.sourceNodeId}->${scope.targetNodeId}`,
    ],
  }),
  project: (scope, events) => {
    let connected = false;
    events.forEach(event => {
      if (event.type === 'NodesConnected' &&
        event.payload.projectId === scope.projectId &&
        event.payload.sourceNodeId === scope.sourceNodeId &&
        event.payload.targetNodeId === scope.targetNodeId) {
        connected = true;
      }
      if (event.type === 'NodesDisconnected' &&
        event.payload.projectId === scope.projectId &&
        event.payload.sourceNodeId === scope.sourceNodeId &&
        event.payload.targetNodeId === scope.targetNodeId) {
        connected = false;
      }
    });
    return connected;
  },
};

const nodeSchema: Atom<
  { projectId: ProjectId, nodeId: NodeId },
  NodePropertySchema[]
> = {
  query: (scope) => Query.where({
    types: ['NodeSchemaChanged'],
    tags: [`projectId:${scope.projectId}`, `nodeId:${scope.nodeId}`]
  }),
  project: (scope, events) => {
    let schema: NodePropertySchema[] = [];
    events.forEach(event => {
      if (event.type === 'NodeSchemaChanged' &&
        event.payload.projectId === scope.projectId &&
        event.payload.nodeId === scope.nodeId) {
        schema = event.payload.schema;
      }
    });
    return schema;
  }
};

const nodeExampleValues: Atom<
  { projectId: ProjectId, nodeId: NodeId },
  NodePropertyExampleValues[]
> = {
  query: (scope) => Query.where({
    types: ['NodeExampleValuesChanged'],
    tags: [`projectId:${scope.projectId}`, `nodeId:${scope.nodeId}`]
  }),
  project: (scope, events) => {
    let exampleValues: NodePropertyExampleValues[] = [];
    events.forEach(event => {
      if (event.type === 'NodeExampleValuesChanged' &&
        event.payload.projectId === scope.projectId &&
        event.payload.nodeId === scope.nodeId) {
        exampleValues = event.payload.exampleValues;
      }
    });
    return exampleValues;
  }
};

export const Atoms = {
  noOp,
  projectExists,
  chapterExists,
  nodeExists,
  connectionExists,
  nodeSchema,
  nodeExampleValues,
};
