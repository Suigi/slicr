import {laneIdForOrder} from '../graph/constants';
import type {GraphNode} from '../graph/types';
import type {ProductionEditorPort, EditorCommand, EditorCommandResult, EditorScope, EditorSnapshot} from './productionEditorPort';

export class ProjectCommandError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ProjectCommandError';
  }
}

type Model = {revision: string};
type Projection = {
  revision: string;
  projectId: string;
  chapterId: string | null;
  nodes: {id: string; label: string; type: GraphNode['type']; laneId: number}[];
  edges: {sourceNodeId: string; targetNodeId: string; role?: 'flow' | 'back-reference'}[];
  nodeSchemas: EditorSnapshot['nodeSchemas'];
  nodeExampleValues: EditorSnapshot['nodeExampleValues'];
};

async function readJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {signal, headers: {accept: 'application/json'}});
  const body = await response.json();
  if (!response.ok) throw new ProjectCommandError(body.error ?? `Request failed (${response.status})`, response.status, body.code);
  return body as T;
}

/** Project-directory-backed port. Reads are revision-paired; subscriptions poll sequentially and are cancellable. */
export function createProjectProductionEditorPort(options: {pollIntervalMs?: number} = {}): ProductionEditorPort {
  const interval = options.pollIntervalMs ?? 1000;
  return {
    async getSnapshot(scope) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const query = new URLSearchParams({project: scope.projectId});
        if (scope.chapterId) query.set('chapter', scope.chapterId);
        const [projection, model] = await Promise.all([readJson<Projection>(`/api/projection?${query}`), readJson<Model>('/api/model')]);
        if (projection.revision !== model.revision) continue;
        return normalizeProjectSnapshot(scope, projection);
      }
      throw new Error('Project model and projection revisions did not converge.');
    },
    subscribe(scope, listener) {
      let active = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let controller: AbortController | undefined;
      let lastRevision: string | undefined;
      const poll = async () => {
        controller = new AbortController();
        try {
          const snapshot = await readSnapshotWithSignal(scope, controller.signal);
          if (active && snapshot.revision !== lastRevision) {
            lastRevision = snapshot.revision;
            listener(snapshot);
          }
        } catch (error) {
          if (active && !(error instanceof DOMException && error.name === 'AbortError'))
            console.error('Project editor subscription failed', error);
        } finally {
          if (active) timer = setTimeout(poll, interval);
        }
      };
      void poll();
      return {
        unsubscribe() {
          active = false;
          controller?.abort();
          if (timer !== undefined) clearTimeout(timer);
        },
      };
    },
    async execute(command: EditorCommand): Promise<EditorCommandResult> {
      const response = await fetch('/api/command', {
        method: 'POST',
        headers: {'content-type': 'application/json', accept: 'application/json'},
        body: JSON.stringify({
          projectId: command.scope.projectId,
          baseRevision: command.baseRevision,
          type: command.type,
          data:
            command.type === 'AddConnectedNode'
              ? {
                  chapterId: command.data.chapterId,
                  sourceNodeId: command.data.sourceNodeId,
                  nodeType: command.data.nodeType,
                  label: command.data.label,
                  direction: command.data.direction,
                }
              : command.type === 'DisconnectNodes'
                ? {sourceNodeId: command.data.sourceNodeId, targetNodeId: command.data.targetNodeId}
                : command.data,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new ProjectCommandError(body.error ?? `Request failed (${response.status})`, response.status, body.code);
      if (
        typeof body.revision !== 'string' ||
        !Array.isArray(body.generatedIds) ||
        body.generatedIds.some((id: unknown) => typeof id !== 'string')
      ) {
        throw new Error('Project command response is missing its committed revision or generated identities.');
      }
      return {revision: body.revision, createdIds: body.generatedIds};
    },
  };
}

async function readSnapshotWithSignal(scope: EditorScope, signal: AbortSignal): Promise<EditorSnapshot> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const query = new URLSearchParams({project: scope.projectId});
    if (scope.chapterId) query.set('chapter', scope.chapterId);
    const [projection, model] = await Promise.all([
      readJson<Projection>(`/api/projection?${query}`, signal),
      readJson<Model>('/api/model', signal),
    ]);
    if (projection.revision === model.revision) return normalizeProjectSnapshot(scope, projection);
  }
  throw new Error('Project model and projection revisions did not converge.');
}

function normalizeProjectSnapshot(scope: EditorScope, projection: Projection): EditorSnapshot {
  return {
    revision: projection.revision,
    scope: {projectId: projection.projectId, chapterId: projection.chapterId ?? scope.chapterId},
    nodes: projection.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      laneId: laneIdForOrder(node.laneId),
      width: 180,
      height: 80,
    })),
    edges: projection.edges.map((edge) => ({
      id: `edge-${edge.sourceNodeId}-${edge.targetNodeId}`,
      sourceId: edge.sourceNodeId,
      targetId: edge.targetNodeId,
      role: edge.role,
    })),
    lanes: [...new Set(projection.nodes.map(({laneId}) => laneId))].map((order) => ({id: laneIdForOrder(order), order})),
    nodeSchemas: projection.nodeSchemas,
    nodeExampleValues: projection.nodeExampleValues,
  };
}
