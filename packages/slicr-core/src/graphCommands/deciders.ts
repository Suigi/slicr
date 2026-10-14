import {bindAtomToCommand, combineAtoms, type DcbEvent, type Decider, rescopeAtom} from '../eventSourcing';
import {v4 as uuid} from 'uuid';

import type {NodeType} from '../graph';
import {ChapterId, Events, NodeId, type NodePropertyExampleValues, type NodePropertySchema, ProjectId} from '../events';
import {
  type AddChapter,
  type AddConnectedNode,
  type AddNode,
  type ChangeNodeExampleValues,
  type ChangeNodeSchema,
  type ChangeNodeType,
  type ConnectNodes,
  type DeleteNode,
  type DisconnectNodes,
  type RenameNode,
} from './commands';
import {Atoms, bindAtom} from './atoms';

function samePayload(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const addChapterDecider = (generateUuid: () => string): Decider<AddChapter, DcbEvent, boolean> => ({
  ...bindAtomToCommand(Atoms.projectExists),
  decide: (command, projectExists) => {
    if (!projectExists) {
      throw new Error(`Project with ID [${command.data.projectId}] not found`);
    }

    return [Events.chapterAdded(command.data.projectId, generateUuid(), command.data.title)];
  },
});

const addNodeDecider = (generateUuid: () => string): Decider<AddNode, DcbEvent, boolean> => ({
  ...bindAtomToCommand(Atoms.chapterExists),
  decide: (command, chapterExists) => {
    if (!chapterExists) {
      throw new Error(`Chapter with ID [${command.data.chapterId}] not found`);
    }

    return [
      Events.nodeAdded(
        command.data.projectId,
        command.data.chapterId,
        generateUuid(),
        command.data.nodeType,
        command.data.laneId,
        command.data.label,
      ),
    ];
  },
});

const addConnectedNodeDecider = (
  generateUuid: () => string,
): Decider<
  AddConnectedNode,
  DcbEvent,
  {
    nodeExists: boolean;
    chapterId?: ChapterId;
  }
> => ({
  ...bindAtom(Atoms.nodeChapter, (command) => ({
    projectId: command.data.projectId,
    nodeId: command.data.sourceNodeId,
  })),
  decide: (command, sourceNode) => {
    if (!sourceNode.nodeExists) {
      throw new Error(`Unknown nodeId ${command.data.sourceNodeId}`);
    }
    if (sourceNode.chapterId !== command.data.chapterId) {
      throw new Error(`Node [${command.data.sourceNodeId}] is not in chapter [${command.data.chapterId}]`);
    }

    const newNodeId = generateUuid();
    return [
      Events.nodeAdded(
        command.data.projectId,
        command.data.chapterId,
        newNodeId,
        command.data.nodeType,
        command.data.laneId,
        command.data.label,
      ),
      Events.nodesConnected(command.data.projectId, command.data.sourceNodeId, newNodeId, command.data.role),
    ];
  },
});

const renameNodeDecider: Decider<
  RenameNode,
  DcbEvent,
  {
    nodeExists: boolean;
    name?: string;
  }
> = {
  ...bindAtomToCommand(Atoms.nodeName),
  decide: (command, nodeName) => {
    if (!nodeName.nodeExists) {
      throw new Error(`Unknown nodeId ${command.data.nodeId}`);
    }
    if (nodeName.name === command.data.newName) {
      return [];
    }

    return [Events.nodeRenamed(command.data.projectId, command.data.nodeId, command.data.newName)];
  },
};

const changeNodeTypeDecider: Decider<
  ChangeNodeType,
  DcbEvent,
  {
    nodeExists: boolean;
    type?: NodeType;
  }
> = {
  ...bindAtomToCommand(Atoms.nodeType),
  decide: (command, nodeType) => {
    if (!nodeType.nodeExists) {
      throw new Error(`Unknown nodeId ${command.data.nodeId}`);
    }
    if (nodeType.type === command.data.newType) {
      return [];
    }

    return [Events.nodeTypeChanged(command.data.projectId, command.data.nodeId, command.data.newType)];
  },
};

const deleteNodeDecider: Decider<DeleteNode, DcbEvent, boolean> = {
  ...bindAtomToCommand(Atoms.nodeExists),
  decide: (command, nodeExists) => {
    if (!nodeExists) {
      throw new Error(`Unknown nodeId ${command.data.nodeId}`);
    }

    return [Events.nodeRemoved(command.data.projectId, command.data.nodeId)];
  },
};

const nodeSchemaChangeContext = combineAtoms({
  nodeExists: Atoms.nodeExists,
  nodeSchema: Atoms.nodeSchema,
});

const changeNodeSchemaDecider: Decider<
  ChangeNodeSchema,
  DcbEvent,
  {
    nodeExists: boolean;
    nodeSchema: NodePropertySchema[];
  }
> = {
  ...bindAtomToCommand(nodeSchemaChangeContext),
  decide: (command, model) => {
    if (!model.nodeExists) {
      throw new Error(`Unknown nodeId ${command.data.nodeId}`);
    }
    if (samePayload(model.nodeSchema, command.data.schema)) {
      return [];
    } else {
      return [Events.nodeSchemaChanged(command.data.projectId, command.data.nodeId, command.data.schema)];
    }
  },
};

const nodeExampleValuesChangeContext = combineAtoms({
  nodeExists: Atoms.nodeExists,
  nodeExampleValues: Atoms.nodeExampleValues,
});

const changeNodeExampleValuesDecider: Decider<
  ChangeNodeExampleValues,
  DcbEvent,
  {
    nodeExists: boolean;
    nodeExampleValues: NodePropertyExampleValues[];
  }
> = {
  ...bindAtomToCommand(nodeExampleValuesChangeContext),
  decide: (command, model) => {
    if (!model.nodeExists) {
      throw new Error(`Unknown nodeId ${command.data.nodeId}`);
    }

    if (samePayload(command.data.exampleValues, model.nodeExampleValues)) {
      return [];
    }

    return [Events.nodeExampleValuesChanged(command.data.projectId, command.data.nodeId, command.data.exampleValues)];
  },
};

const nodeConnectionContext = combineAtoms({
  sourceNodeExists: rescopeAtom(Atoms.nodeExists, (scope: {projectId: ProjectId; sourceNodeId: NodeId}) => ({
    projectId: scope.projectId,
    nodeId: scope.sourceNodeId,
  })),
  targetNodeExists: rescopeAtom(Atoms.nodeExists, (scope: {projectId: ProjectId; targetNodeId: NodeId}) => ({
    projectId: scope.projectId,
    nodeId: scope.targetNodeId,
  })),
  connectionExists: Atoms.connectionExists,
});

type NodeConnectionContext = {
  sourceNodeExists: boolean;
  targetNodeExists: boolean;
  connectionExists: boolean;
};

const connectNodesDecider: Decider<ConnectNodes, DcbEvent, NodeConnectionContext> = {
  ...bindAtomToCommand(nodeConnectionContext),
  decide: (command, model) => {
    if (!model.sourceNodeExists) {
      throw new Error(`Unknown nodeId ${command.data.sourceNodeId}`);
    }
    if (!model.targetNodeExists) {
      throw new Error(`Unknown nodeId ${command.data.targetNodeId}`);
    }
    if (command.data.sourceNodeId === command.data.targetNodeId || model.connectionExists) {
      return [];
    }

    return [Events.nodesConnected(command.data.projectId, command.data.sourceNodeId, command.data.targetNodeId, command.data.role)];
  },
};

const disconnectNodesDecider: Decider<DisconnectNodes, DcbEvent, NodeConnectionContext> = {
  ...bindAtomToCommand(nodeConnectionContext),
  decide: (command, model) => {
    if (!model.sourceNodeExists) {
      throw new Error(`Unknown nodeId ${command.data.sourceNodeId}`);
    }
    if (!model.targetNodeExists) {
      throw new Error(`Unknown nodeId ${command.data.targetNodeId}`);
    }
    if (!model.connectionExists) {
      return [];
    }

    return [Events.nodesDisconnected(command.data.projectId, command.data.sourceNodeId, command.data.targetNodeId)];
  },
};

export const deciders = (args: {generateUuid?: () => string} = {}) => {
  const generateUuid = args.generateUuid ?? uuid;

  return {
    addChapter: addChapterDecider(generateUuid),
    addNode: addNodeDecider(generateUuid),
    addConnectedNode: addConnectedNodeDecider(generateUuid),
    renameNode: renameNodeDecider,
    changeNodeType: changeNodeTypeDecider,
    deleteNode: deleteNodeDecider,
    changeNodeSchema: changeNodeSchemaDecider,
    changeNodeExampleValues: changeNodeExampleValuesDecider,
    connectNodes: connectNodesDecider,
    disconnectNodes: disconnectNodesDecider,
  };
};
