import type {EdgeInput, LaneInput} from 'layout-lib';
import type {GraphNode} from '../graph/types';

export type EditorScope = {readonly projectId: string; readonly chapterId: string};
export type EditorSnapshot = {
  readonly revision: string;
  readonly scope: EditorScope;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly EdgeInput[];
  readonly lanes: readonly LaneInput[];
};
export type EditorCommand = {
  readonly scope: EditorScope;
  /** Revision captured when the user initiated the command; adapters must not silently rebase. */
  readonly baseRevision: string;
  readonly type: string;
  readonly data: Readonly<Record<string, unknown>>;
};
export type EditorCommandResult = {readonly revision: string; readonly createdIds: readonly string[]};

/** Persistence-neutral contract for a production editor scope. Implementations own storage and subscriptions. */
export interface ProductionEditorPort {
  getSnapshot(scope: EditorScope): Promise<EditorSnapshot>;
  subscribe(scope: EditorScope, listener: (snapshot: EditorSnapshot) => void): {unsubscribe(): void};
  execute(command: EditorCommand): Promise<EditorCommandResult>;
}
