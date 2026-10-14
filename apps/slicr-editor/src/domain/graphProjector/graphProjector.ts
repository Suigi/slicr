import {
  createProjectorInstance,
  type DcbEvent,
  type DcbProjectorDefinition,
  type DcbStore,
  MemoryStore,
  Query,
  replayProjector,
} from '../eventSourcing';
import {Edge, ModelGraph, NodeType} from '../graph';

type GraphProjectorScope = {
  projectId: string;
  chapterId?: string;
};

type GraphProjectorState = {
  nodesById: Map<
    string,
    {
      nodeId: string;
      nodeType: NodeType;
      laneId: number;
      label: string;
      chapterId: string;
      exists: boolean;
    }
  >;
  nodeSchemas: Map<string, ModelGraph['nodeSchemas'][string]>;
  nodeExampleValues: Map<string, ModelGraph['nodeExampleValues'][string]>;
  edgesByConnection: Map<string, Edge>;
};

const graphEventTypes = [
  'NodeAdded',
  'NodeChapterChanged',
  'NodeRenamed',
  'NodeRemoved',
  'NodeTypeChanged',
  'NodeSchemaChanged',
  'NodeExampleValuesChanged',
  'NodesConnected',
  'NodesDisconnected',
] as const;

export const graphProjectorDefinition: DcbProjectorDefinition<GraphProjectorScope, GraphProjectorState, ModelGraph> = {
  query: (scope) =>
    Query.where({
      types: graphEventTypes,
      tags: [`projectId:${scope.projectId}`],
    }),
  initialState: () => ({
    nodesById: new Map(),
    nodeSchemas: new Map(),
    nodeExampleValues: new Map(),
    edgesByConnection: new Map(),
  }),
  evolve: (state, event, scope) => {
    if (!event.tags.includes(`projectId:${scope.projectId}`) || !graphEventTypes.includes(event.type as (typeof graphEventTypes)[number])) {
      return state;
    }

    switch (event.type) {
      case 'NodeAdded':
        state.nodesById.set(event.payload.nodeId, {
          nodeId: event.payload.nodeId,
          nodeType: event.payload.type,
          laneId: event.payload.laneId,
          label: event.payload.label,
          chapterId: event.payload.chapterId,
          exists: true,
        });
        break;
      case 'NodeChapterChanged': {
        const node = state.nodesById.get(event.payload.nodeId);
        if (node?.exists) {
          node.chapterId = event.payload.chapterId;
        }
        break;
      }
      case 'NodeRenamed': {
        const node = state.nodesById.get(event.payload.nodeId);
        if (node?.exists) {
          node.label = event.payload.newName;
        }
        break;
      }
      case 'NodeRemoved': {
        const node = state.nodesById.get(event.payload.nodeId);
        if (node) {
          node.exists = false;
        }
        state.edgesByConnection.forEach((_, key) => {
          if (key.startsWith(`${event.payload.nodeId}->`) || key.endsWith(`->${event.payload.nodeId}`)) {
            state.edgesByConnection.delete(key);
          }
        });
        state.nodeSchemas.delete(event.payload.nodeId);
        state.nodeExampleValues.delete(event.payload.nodeId);
        break;
      }
      case 'NodeTypeChanged': {
        const node = state.nodesById.get(event.payload.nodeId);
        if (node?.exists) {
          node.nodeType = event.payload.newType;
        }
        break;
      }
      case 'NodeSchemaChanged': {
        const node = state.nodesById.get(event.payload.nodeId);
        if (node?.exists) {
          state.nodeSchemas.set(event.payload.nodeId, event.payload.schema);
        }
        break;
      }
      case 'NodeExampleValuesChanged': {
        const node = state.nodesById.get(event.payload.nodeId);
        if (node?.exists) {
          state.nodeExampleValues.set(event.payload.nodeId, event.payload.exampleValues);
        }
        break;
      }
      case 'NodesConnected':
        state.edgesByConnection.set(`${event.payload.sourceNodeId}->${event.payload.targetNodeId}`, {
          sourceNodeId: event.payload.sourceNodeId,
          targetNodeId: event.payload.targetNodeId,
          role: event.payload.role,
        });
        break;
      case 'NodesDisconnected':
        state.edgesByConnection.delete(`${event.payload.sourceNodeId}->${event.payload.targetNodeId}`);
        break;
      default:
        break;
    }

    return state;
  },
  projection: (state, scope) => {
    const visibleNodes = Array.from(state.nodesById.values())
      .filter((node) => node.exists && (!scope.chapterId || node.chapterId === scope.chapterId))
      .map(({chapterId: _chapterId, exists: _exists, ...node}) => node);
    const visibleNodeIds = new Set(visibleNodes.map((node) => node.nodeId));

    return {
      nodes: visibleNodes,
      edges: Array.from(state.edgesByConnection.values()).filter(
        (edge) => edge.sourceNodeId !== edge.targetNodeId && visibleNodeIds.has(edge.sourceNodeId) && visibleNodeIds.has(edge.targetNodeId),
      ),
      lanes: Array.from(new Set(visibleNodes.map((node) => node.laneId)))
        .sort((left, right) => left - right)
        .map((laneId) => ({id: `lane-${laneId}`, order: laneId})),
      nodeSchemas: Object.fromEntries(Array.from(state.nodeSchemas.entries()).filter(([nodeId]) => visibleNodeIds.has(nodeId))),
      nodeExampleValues: Object.fromEntries(Array.from(state.nodeExampleValues.entries()).filter(([nodeId]) => visibleNodeIds.has(nodeId))),
    };
  },
};

export function projectGraph(events: readonly DcbEvent[], projectId: string, chapterId?: string): ModelGraph {
  return replayProjector(createProjectorInstance(graphProjectorDefinition, {projectId, chapterId}), events);
}

export class GraphProjector {
  private constructor(private readonly store: DcbStore) {}

  public static create(config: {store?: DcbStore} = {}): GraphProjector {
    return new GraphProjector(config.store ?? MemoryStore.create<DcbEvent>());
  }

  public project(projectId: string, chapterId?: string): ModelGraph {
    return projectGraph(
      this.store.query(
        Query.where({
          types: graphEventTypes,
          tags: [`projectId:${projectId}`],
        }),
      ),
      projectId,
      chapterId,
    );
  }
}
