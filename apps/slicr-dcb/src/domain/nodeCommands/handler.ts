import {Handler, Query, Store} from '@slicr/event-sourcing';
import {NodeType} from '../../graph/types';
import {DomainEvent, Events} from '../events';

export type AddNodeCommand = { nodeType: NodeType };
export type RenameNodeCommand = { nodeId: string, newName: string };

export const addNodeHandler =
  (uuidGenerator: () => string) => (store: Store<DomainEvent>) =>
    Handler.create<AddNodeCommand, DomainEvent, {}>({
      store,
      query: _ => Query.none(),
      project: _ => ({}),
      decide: (command, _) => {
        return Events.nodeAdded(uuidGenerator(), command.nodeType, 0);
      }
    });

export const renameNodeHandler =
  (store: Store<DomainEvent>) =>
    Handler.create<RenameNodeCommand, DomainEvent, boolean>({
      store,
      query: command => Query.where({tags: [`nodeId:${command.nodeId}`]}),
      project: events => events.length > 0,
      decide: (command, nodeExists) => {
        if (!nodeExists) {
          throw new Error(`Unknown nodeId ${command.nodeId}`);
        }
        return Events.nodeRenamed(command.nodeId, command.newName);
      }
    });
