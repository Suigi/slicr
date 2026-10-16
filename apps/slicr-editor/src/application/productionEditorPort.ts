import type {EdgeInput, LaneInput} from 'layout-lib';
import type {NodePropertyExampleValues, NodePropertySchema} from '@slicr/core/events';
import type {GraphNode, NodeType, AddDirection} from '../graph/types';

export type EditorScope = {readonly projectId: string; readonly chapterId: string};
export type EditorSnapshot = {
  readonly revision: string;
  readonly scope: EditorScope;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly EdgeInput[];
  readonly lanes: readonly LaneInput[];
  readonly nodeSchemas: Record<string, NodePropertySchema[]>;
  readonly nodeExampleValues: Record<string, NodePropertyExampleValues[]>;
};
export type EditorAction =
  | {type: 'AddNode'; data: {chapterId: string; nodeType: NodeType; laneId: number; label: string}}
  | {type: 'AddProject'; data: {name: string}}
  | {type: 'RenameProject'; data: {projectId: string; name: string}}
  | {type: 'AddChapter'; data: {title: string}}
  | {type: 'ConnectNodes'; data: {sourceNodeId: string; targetNodeId: string; role?: 'flow' | 'back-reference'}}
  | {type: 'DisconnectNodes'; data: {edgeId: string; sourceNodeId: string; targetNodeId: string}}
  | {
      type: 'AddConnectedNode';
      data: {chapterId: string; sourceNodeId: string; nodeType: NodeType; laneId: number; direction: AddDirection; label: string};
    }
  | {type: 'RenameNode'; data: {nodeId: string; name: string}}
  | {type: 'ChangeNodeType'; data: {nodeId: string; newType: NodeType}}
  | {type: 'ChangeNodeProperties'; data: {nodeId: string; schema: NodePropertySchema[]; exampleValues: NodePropertyExampleValues[]}}
  | {type: 'DeleteNode'; data: {nodeId: string}};

export type EditorCommand = EditorAction & {
  readonly scope: EditorScope;
  /** Revision captured when the user initiated the command; adapters must not silently rebase. */
  readonly baseRevision: string;
};
export type EditorCommandResult = {readonly revision: string; readonly createdIds: readonly string[]};

/** Persistence-neutral contract for a production editor scope. Implementations own storage and subscriptions. */
export interface ProductionEditorPort {
  getSnapshot(scope: EditorScope): Promise<EditorSnapshot>;
  subscribe(scope: EditorScope, listener: (snapshot: EditorSnapshot) => void): {unsubscribe(): void};
  execute(command: EditorCommand): Promise<EditorCommandResult>;
}
