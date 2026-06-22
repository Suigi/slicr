import {type Atom, type DcbEvent, Query} from '../eventSourcing';
import {ChapterId, NodeId, NodePropertyExampleValues, NodePropertySchema, ProjectId} from '../events';

export {bindAtom} from '../eventSourcing';

type DomainAtom<Scope, Model> = Atom<DcbEvent, Scope, Model>;

const noOp: DomainAtom<void, unknown> = {
  query: () => Query.none(),
  project: () => undefined,
};

const projectExists: DomainAtom<{ projectId: ProjectId }, boolean> = {
  query: ({projectId}) => Query.where({types: ['ProjectAdded'], tags: [`projectId:${projectId}`]}),
  project: ({projectId}, events) => events.some(event => event.type === 'ProjectAdded' && event.payload.projectId === projectId),
};

const chapterExists: DomainAtom<{ chapterId: ChapterId }, boolean> = {
  query: ({chapterId}) => Query.where({types: ['ChapterAdded'], tags: [`chapterId:${chapterId}`]}),
  project: ({chapterId}, events) => events.some(event => event.type === 'ChapterAdded' && event.payload.chapterId === chapterId),
};

const nodeExists: DomainAtom<{
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

const connectionExists: DomainAtom<{
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

const nodeSchema: DomainAtom<
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

const nodeExampleValues: DomainAtom<
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
