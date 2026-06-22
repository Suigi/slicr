import {MemoryStore, Query, type DcbStore} from '../eventSourcing';
import {DomainEvent} from '../events';
import {Edge, ModelGraph, NodeType} from '../graph';

export class GraphProjector {
  private constructor(private readonly store: DcbStore) {
  }

  public static create(config: { store?: DcbStore } = {}): GraphProjector {
    return new GraphProjector(config.store ?? MemoryStore.create<DomainEvent>());
  }

  public project(projectId: string, chapterId?: string): ModelGraph {
    const events = this.store.query(Query.where({
      types: [
        'NodeAdded',
        'NodeChapterChanged',
        'NodeRenamed',
        'NodeRemoved',
        'NodeTypeChanged',
        'NodeSchemaChanged',
        'NodeExampleValuesChanged',
        'NodesConnected',
        'NodesDisconnected',
      ],
      tags: [`projectId:${projectId}`],
    }));

    const nodesById = new Map<string, {nodeId: string, nodeType: NodeType, laneId: number, label: string, chapterId: string, exists: boolean}>();
    const nodeSchemas = new Map<string, ModelGraph['nodeSchemas'][string]>();
    const nodeExampleValues = new Map<string, ModelGraph['nodeExampleValues'][string]>();
    const edgesByConnection = new Map<string, Edge>();

    for (const event of events) {
      switch (event.type) {
        case 'NodeAdded':
          nodesById.set(event.payload.nodeId, {
            nodeId: event.payload.nodeId,
            nodeType: event.payload.type,
            laneId: event.payload.laneId,
            label: event.payload.label,
            chapterId: event.payload.chapterId,
            exists: true,
          });
          break;
        case 'NodeChapterChanged': {
          const node = nodesById.get(event.payload.nodeId);
          if (node?.exists) {
            node.chapterId = event.payload.chapterId;
          }
          break;
        }
        case 'NodeRenamed': {
          const node = nodesById.get(event.payload.nodeId);
          if (node?.exists) {
            node.label = event.payload.newName;
          }
          break;
        }
        case 'NodeRemoved': {
          const node = nodesById.get(event.payload.nodeId);
          if (node) {
            node.exists = false;
          }
          edgesByConnection.forEach((_, key) => {
            if (key.startsWith(`${event.payload.nodeId}->`) || key.endsWith(`->${event.payload.nodeId}`)) {
              edgesByConnection.delete(key);
            }
          });
          nodeSchemas.delete(event.payload.nodeId);
          nodeExampleValues.delete(event.payload.nodeId);
          break;
        }
        case 'NodeTypeChanged': {
          const node = nodesById.get(event.payload.nodeId);
          if (node?.exists) {
            node.nodeType = event.payload.newType;
          }
          break;
        }
        case 'NodeSchemaChanged': {
          const node = nodesById.get(event.payload.nodeId);
          if (node?.exists) {
            nodeSchemas.set(event.payload.nodeId, event.payload.schema);
          }
          break;
        }
        case 'NodeExampleValuesChanged': {
          const node = nodesById.get(event.payload.nodeId);
          if (node?.exists) {
            nodeExampleValues.set(event.payload.nodeId, event.payload.exampleValues);
          }
          break;
        }
        case 'NodesConnected':
          edgesByConnection.set(`${event.payload.sourceNodeId}->${event.payload.targetNodeId}`, {
            sourceNodeId: event.payload.sourceNodeId,
            targetNodeId: event.payload.targetNodeId,
            role: event.payload.role,
          });
          break;
        case 'NodesDisconnected':
          edgesByConnection.delete(`${event.payload.sourceNodeId}->${event.payload.targetNodeId}`);
          break;
      }
    }

    const visibleNodes = Array.from(nodesById.values())
      .filter(node => node.exists && (!chapterId || node.chapterId === chapterId))
      .map(({chapterId: _chapterId, exists: _exists, ...node}) => node);
    const visibleNodeIds = new Set(visibleNodes.map(node => node.nodeId));

    const model: ModelGraph = {
      nodes: visibleNodes,
      edges: Array.from(edgesByConnection.values()).filter(edge =>
        edge.sourceNodeId !== edge.targetNodeId &&
        visibleNodeIds.has(edge.sourceNodeId) &&
        visibleNodeIds.has(edge.targetNodeId)
      ),
      lanes: Array.from(new Set(visibleNodes.map(node => node.laneId)))
        .sort((left, right) => left - right)
        .map(laneId => ({id: `lane-${laneId}`, order: laneId})),
      nodeSchemas: Object.fromEntries(
        Array.from(nodeSchemas.entries()).filter(([nodeId]) => visibleNodeIds.has(nodeId))
      ),
      nodeExampleValues: Object.fromEntries(
        Array.from(nodeExampleValues.entries()).filter(([nodeId]) => visibleNodeIds.has(nodeId))
      ),
    };

    return model;
  }
}
