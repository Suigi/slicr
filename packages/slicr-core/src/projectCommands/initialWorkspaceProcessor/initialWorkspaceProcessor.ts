import {type Decider, type DcbEvent, Query} from '../../eventSourcing';
import {Events} from '../../events';
import {v4 as uuid} from 'uuid';
import {type EnsureInitialWorkspace} from '../commands';

export const DEFAULT_PROJECT_NAME = 'Default Project';
export const DEFAULT_CHAPTER_ID = 'default-chapter';
export const DEFAULT_CHAPTER_TITLE = 'Chapter 1';

export const initialWorkspaceDecider = (
  args: {
    generateUuid?: () => string;
  } = {},
): Decider<EnsureInitialWorkspace, DcbEvent, boolean> => {
  const generateUuid = args.generateUuid ?? uuid;
  return {
    query: () => Query.where({types: ['ProjectAdded']}),
    project: (_, events) => events.length === 0,
    decide: (_, isEmpty) => {
      if (!isEmpty) {
        return [];
      }

      const projectId = generateUuid();
      return [
        Events.projectAdded(projectId, DEFAULT_PROJECT_NAME),
        Events.chapterAdded(projectId, DEFAULT_CHAPTER_ID, DEFAULT_CHAPTER_TITLE),
      ];
    },
  };
};
