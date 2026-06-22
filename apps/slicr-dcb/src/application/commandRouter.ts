import {type DcbDecider, type DcbSpecStore, handleCommand, MemorySpecEventStore} from '../domain/eventSourcing';
import {deciders} from '../domain/projectCommands/projectCommandHandler';
import {AddProject, RenameProject} from '../domain/projectCommands/commands';

export type SlicrCommand =
  | AddProject
  | RenameProject;

export const createCommandRouter =
  (args: {
    store?: DcbSpecStore,
    generateUuid?: () => string,
  } = {}) => {
    const projectDeciders = deciders({generateUuid: args.generateUuid});
    const registry: Record<string, DcbDecider<SlicrCommand, unknown>> = {
      AddProject: projectDeciders.addProject,
      RenameProject: projectDeciders.renameProject,
    };

    const store = args.store ?? MemorySpecEventStore.create();

    return async (command: SlicrCommand) => {
      const decider = registry[command.type];

      if (decider === undefined) {
        throw new Error(`No command handler registered for command type ${command.type}`);
      }

      await handleCommand(store, decider, command);
    };
  };
