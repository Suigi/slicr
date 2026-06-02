import {MemoryStore, Query, Store} from '@slicr/event-sourcing';
import {DomainEvent} from '../events';
import {Edge, ModelGraph} from '../graph';

export class GraphProjector {
  private constructor(private readonly store: Store<DomainEvent>) {
  }

  public static create(config: { store?: Store<DomainEvent> } = {}): GraphProjector {
    return new GraphProjector(config.store ?? MemoryStore.create<DomainEvent>());
  }

  public project(): ModelGraph {
    const events = this.store.query(Query.where({
      types: [
        'NodeAdded',
        'NodeRenamed',
        'NodeRemoved',
        'NodeTypeChanged',
        'NodesConnected',
        'NodesDisconnected',
      ]
    }));
    const model: ModelGraph = {
      nodes: [],
      edges: [],
      lanes: [],
    };
    for (const event of events) {
      switch (event.type) {
        case 'NodeAdded':
          if (!model.nodes.some(node => node.nodeId === event.payload.nodeId)) {
            model.nodes.push({
              nodeId: event.payload.nodeId,
              nodeType: event.payload.type,
              laneId: event.payload.laneId,
              label: event.payload.label,
            });
          }
          break;
        case 'NodeRenamed': {
          const node = model.nodes.find(node => node.nodeId === event.payload.nodeId);
          if (node) {
            node.label = event.payload.newName;
          }
          break;
        }
        case 'NodeRemoved':
          model.nodes = model.nodes.filter(node => node.nodeId !== event.payload.nodeId);
          model.edges = model.edges.filter(edge =>
            edge.sourceNodeId !== event.payload.nodeId && edge.targetNodeId !== event.payload.nodeId
          );
          break;
        case 'NodeTypeChanged': {
          const node = model.nodes.find(node => node.nodeId === event.payload.nodeId);
          if (node) {
            node.nodeType = event.payload.newType;
          }
          break;
        }
        case 'NodesConnected': {
          const sourceExists = model.nodes.some(node => node.nodeId === event.payload.sourceNodeId);
          const targetExists = model.nodes.some(node => node.nodeId === event.payload.targetNodeId);
          if (sourceExists && targetExists && event.payload.sourceNodeId !== event.payload.targetNodeId) {
            const connection: Edge = {
              sourceNodeId: event.payload.sourceNodeId,
              targetNodeId: event.payload.targetNodeId,
              role: event.payload.role,
            };
            const existingIndex = model.edges.findIndex(edge =>
              edge.sourceNodeId === connection.sourceNodeId && edge.targetNodeId === connection.targetNodeId
            );
            if (existingIndex >= 0) {
              model.edges[existingIndex] = connection;
            } else {
              model.edges.push(connection);
            }
          }
          break;
        }
        case 'NodesDisconnected':
          model.edges = model.edges.filter(edge =>
            edge.sourceNodeId !== event.payload.sourceNodeId || edge.targetNodeId !== event.payload.targetNodeId
          );
          break;
      }
    }
    model.lanes = Array.from(new Set(model.nodes.map(node => node.laneId)))
      .sort((left, right) => left - right)
      .map(laneId => ({id: `lane-${laneId}`, order: laneId}));
    return model;
  }
}
