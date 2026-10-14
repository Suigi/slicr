import {type Atom, type DcbEvent, Query} from '../eventSourcing';
import type {NodeType} from '../../graph/types';
import {ChapterId, NodeId, NodePropertyExampleValues, NodePropertySchema, ProjectId} from '../events';

export {bindAtom} from '../eventSourcing';

type DomainAtom<Scope, Model> = Atom<DcbEvent, Scope, Model>;

const noOp: DomainAtom<void, unknown> = {
  query: () => Query.none(),
  project: () => undefined,
};

const projectExists: DomainAtom<{projectId: ProjectId}, boolean> = {
  query: ({projectId}) => Query.where({types: ['ProjectAdded'], tags: [`projectId:${projectId}`]}),
  project: ({projectId}, events) => events.some((event) => event.type === 'ProjectAdded' && event.payload.projectId === projectId),
};

const chapterExists: DomainAtom<{projectId: ProjectId; chapterId: ChapterId}, boolean> = {
  query: ({projectId, chapterId}) => Query.where({types: ['ChapterAdded'], tags: [`projectId:${projectId}`, `chapterId:${chapterId}`]}),
  project: ({projectId, chapterId}, events) =>
    events.some((event) => event.type === 'ChapterAdded' && event.payload.projectId === projectId && event.payload.chapterId === chapterId),
};

const nodeExists: DomainAtom<
  {
    projectId: ProjectId;
    nodeId: NodeId;
  },
  boolean
> = {
  query: (scope) =>
    Query.where({
      types: ['NodeAdded', 'NodeRemoved'],
      tags: [`projectId:${scope.projectId}`, `nodeId:${scope.nodeId}`],
    }),
  project: (scope, events) => {
    let nodeExists = false;
    events.forEach((event) => {
      if (event.type === 'NodeAdded' && event.payload.projectId === scope.projectId && event.payload.nodeId === scope.nodeId) {
        nodeExists = true;
      }
      if (event.type === 'NodeRemoved' && event.payload.projectId === scope.projectId && event.payload.nodeId === scope.nodeId) {
        nodeExists = false;
      }
    });
    return nodeExists;
  },
};

const nodeName: DomainAtom<
  {
    projectId: ProjectId;
    nodeId: NodeId;
  },
  {
    nodeExists: boolean;
    name?: string;
  }
> = {
  query: ({projectId, nodeId}) =>
    Query.where({
      types: ['NodeAdded', 'NodeRenamed', 'NodeRemoved'],
      tags: [`projectId:${projectId}`, `nodeId:${nodeId}`],
    }),
  project: ({projectId, nodeId}, events) => {
    const model: {nodeExists: boolean; name?: string} = {
      nodeExists: false,
      name: undefined,
    };

    events.forEach((event) => {
      if (event.payload.projectId !== projectId) {
        return;
      }

      if (event.type === 'NodeAdded' && event.payload.nodeId === nodeId) {
        model.nodeExists = true;
        model.name = event.payload.label;
      }

      if (event.type === 'NodeRenamed' && event.payload.nodeId === nodeId) {
        model.name = event.payload.newName;
      }

      if (event.type === 'NodeRemoved' && event.payload.nodeId === nodeId) {
        model.nodeExists = false;
        model.name = undefined;
      }
    });

    return model;
  },
};

const nodeType: DomainAtom<
  {
    projectId: ProjectId;
    nodeId: NodeId;
  },
  {
    nodeExists: boolean;
    type?: NodeType;
  }
> = {
  query: ({projectId, nodeId}) =>
    Query.where({
      types: ['NodeAdded', 'NodeTypeChanged', 'NodeRemoved'],
      tags: [`projectId:${projectId}`, `nodeId:${nodeId}`],
    }),
  project: ({projectId, nodeId}, events) => {
    const model: {nodeExists: boolean; type?: NodeType} = {
      nodeExists: false,
      type: undefined,
    };

    events.forEach((event) => {
      if (event.payload.projectId !== projectId) {
        return;
      }

      if (event.type === 'NodeAdded' && event.payload.nodeId === nodeId) {
        model.nodeExists = true;
        model.type = event.payload.type;
      }

      if (event.type === 'NodeTypeChanged' && event.payload.nodeId === nodeId) {
        model.type = event.payload.newType;
      }

      if (event.type === 'NodeRemoved' && event.payload.nodeId === nodeId) {
        model.nodeExists = false;
        model.type = undefined;
      }
    });

    return model;
  },
};

const nodeChapter: DomainAtom<
  {
    projectId: ProjectId;
    nodeId: NodeId;
  },
  {
    nodeExists: boolean;
    chapterId?: ChapterId;
  }
> = {
  query: ({projectId, nodeId}) =>
    Query.where({
      types: ['NodeAdded', 'NodeChapterChanged', 'NodeRemoved'],
      tags: [`projectId:${projectId}`, `nodeId:${nodeId}`],
    }),
  project: ({projectId, nodeId}, events) => {
    const model: {nodeExists: boolean; chapterId?: ChapterId} = {
      nodeExists: false,
      chapterId: undefined,
    };

    events.forEach((event) => {
      if (event.payload.projectId !== projectId) {
        return;
      }

      if (event.type === 'NodeAdded' && event.payload.nodeId === nodeId) {
        model.nodeExists = true;
        model.chapterId = event.payload.chapterId;
      }

      if (event.type === 'NodeChapterChanged' && event.payload.nodeId === nodeId) {
        model.chapterId = event.payload.chapterId;
      }

      if (event.type === 'NodeRemoved' && event.payload.nodeId === nodeId) {
        model.nodeExists = false;
        model.chapterId = undefined;
      }
    });

    return model;
  },
};

const connectionExists: DomainAtom<
  {
    projectId: ProjectId;
    sourceNodeId: NodeId;
    targetNodeId: NodeId;
  },
  boolean
> = {
  query: (scope) =>
    Query.where({
      types: ['NodesConnected', 'NodesDisconnected'],
      tags: [`projectId:${scope.projectId}`, `connection:${scope.sourceNodeId}->${scope.targetNodeId}`],
    }),
  project: (scope, events) => {
    let connected = false;
    events.forEach((event) => {
      if (
        event.type === 'NodesConnected' &&
        event.payload.projectId === scope.projectId &&
        event.payload.sourceNodeId === scope.sourceNodeId &&
        event.payload.targetNodeId === scope.targetNodeId
      ) {
        connected = true;
      }
      if (
        event.type === 'NodesDisconnected' &&
        event.payload.projectId === scope.projectId &&
        event.payload.sourceNodeId === scope.sourceNodeId &&
        event.payload.targetNodeId === scope.targetNodeId
      ) {
        connected = false;
      }
    });
    return connected;
  },
};

const nodeSchema: DomainAtom<{projectId: ProjectId; nodeId: NodeId}, NodePropertySchema[]> = {
  query: (scope) =>
    Query.where({
      types: ['NodeSchemaChanged'],
      tags: [`projectId:${scope.projectId}`, `nodeId:${scope.nodeId}`],
    }),
  project: (scope, events) => {
    let schema: NodePropertySchema[] = [];
    events.forEach((event) => {
      if (event.type === 'NodeSchemaChanged' && event.payload.projectId === scope.projectId && event.payload.nodeId === scope.nodeId) {
        schema = event.payload.schema;
      }
    });
    return schema;
  },
};

const nodeExampleValues: DomainAtom<{projectId: ProjectId; nodeId: NodeId}, NodePropertyExampleValues[]> = {
  query: (scope) =>
    Query.where({
      types: ['NodeExampleValuesChanged'],
      tags: [`projectId:${scope.projectId}`, `nodeId:${scope.nodeId}`],
    }),
  project: (scope, events) => {
    let exampleValues: NodePropertyExampleValues[] = [];
    events.forEach((event) => {
      if (
        event.type === 'NodeExampleValuesChanged' &&
        event.payload.projectId === scope.projectId &&
        event.payload.nodeId === scope.nodeId
      ) {
        exampleValues = event.payload.exampleValues;
      }
    });
    return exampleValues;
  },
};

export const Atoms = {
  noOp,
  projectExists,
  chapterExists,
  nodeExists,
  nodeName,
  nodeType,
  nodeChapter,
  connectionExists,
  nodeSchema,
  nodeExampleValues,
};
