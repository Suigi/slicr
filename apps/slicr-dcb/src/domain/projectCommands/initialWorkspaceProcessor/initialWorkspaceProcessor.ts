import {Handler, Query, Store} from '../../eventSourcing';
import {DomainEvent, Events} from '../../events';
import {v4 as uuid} from 'uuid';

export const initialWorkspaceProcessor = (args: {
  generateUuid?: () => string
} = {}) => (store: Store<DomainEvent>) => {
  const generateUuid = args.generateUuid || uuid;
  return Handler.create<void, DomainEvent, boolean>({
    store,
    query: () => Query.where({types: ['ProjectAdded']}),
    project: (events) => events.length === 0,
    decide: (_, isEmpty) => {
      if (isEmpty) {
        return [
          Events.projectAdded(generateUuid(), 'Default Project'),
          Events.chapterAdded(generateUuid(), 'default', 'Chapter 1'),
        ];
      } else {
        return [];
      }
    }
  });
};