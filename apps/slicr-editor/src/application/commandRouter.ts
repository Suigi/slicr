import {DcbAnyCommand, type DcbDecider, type DcbSpecStore, handleCommand, MemorySpecEventStore} from '@slicr/core/eventSourcing';
import {deciders as makeProjectDeciders} from '@slicr/core/projectCommands/projectCommandHandler';
import {deciders as makeGraphDeciders} from '@slicr/core/graphCommands/deciders';
import {initialWorkspaceDecider} from '@slicr/core/projectCommands/initialWorkspaceProcessor/initialWorkspaceProcessor';

export const createCommandRouter = (
  args: {
    store?: DcbSpecStore;
    generateUuid?: () => string;
  } = {},
) => {
  const projectDeciders = makeProjectDeciders({generateUuid: args.generateUuid});
  const graphDeciders = makeGraphDeciders({generateUuid: args.generateUuid});
  const initialWorkspace = initialWorkspaceDecider({generateUuid: args.generateUuid});

  const registry: Record<string, DcbDecider<DcbAnyCommand, unknown>> = {
    EnsureInitialWorkspace: initialWorkspace,

    AddProject: projectDeciders.addProject,
    RenameProject: projectDeciders.renameProject,

    AddChapter: graphDeciders.addChapter,
    AddNode: graphDeciders.addNode,
    AddConnectedNode: graphDeciders.addConnectedNode,
    RenameNode: graphDeciders.renameNode,
    ChangeNodeType: graphDeciders.changeNodeType,
    DeleteNode: graphDeciders.deleteNode,
    ChangeNodeSchema: graphDeciders.changeNodeSchema,
    ChangeNodeExampleValues: graphDeciders.changeNodeExampleValues,
    ConnectNodes: graphDeciders.connectNodes,
    DisconnectNodes: graphDeciders.disconnectNodes,
  };

  const store = args.store ?? MemorySpecEventStore.create();

  return async (command: DcbAnyCommand) => {
    const decider = registry[command.type];

    if (decider === undefined) {
      throw new Error(`No command handler registered for command type ${command.type}`);
    }

    await handleCommand(store, decider, command);
  };
};
