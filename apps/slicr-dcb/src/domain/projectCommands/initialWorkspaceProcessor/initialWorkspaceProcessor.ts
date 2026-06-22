import {Handler, Query, Store} from '../../eventSourcing';
import {Events} from '../../events';
import {type DcbEvent} from '../../eventSourcing';
import {v4 as uuid} from 'uuid';

export const initialWorkspaceProcessor = (args: {
  generateUuid?: () => string
} = {}) => (store: Store<DcbEvent>) => {
  const generateUuid = args.generateUuid || uuid;
  return Handler.create<void, DcbEvent, boolean>({
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