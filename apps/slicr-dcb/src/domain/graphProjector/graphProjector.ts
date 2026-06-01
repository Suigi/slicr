import {MemoryStore, Query, Store} from '@slicr/event-sourcing';
import {DomainEvent} from '../events';
import {ModelGraph} from '../graph';

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
        'NodesConnected',
        'NodeRenamed']
    }));
    const model: ModelGraph = {
      nodes: [],
      edges: [],
      lanes: [],
    };
    for (const event of events) {
      switch (event.type) {
        case 'NodeAdded':
          model.nodes.push({
            nodeId: event.payload.nodeId,
            nodeType: event.payload.type,
            laneId: event.payload.laneId,
            label: event.payload.label,
          });
          if (!model.lanes.some(lane => lane.id === `lane-${event.payload.laneId}`)) {
            model.lanes.push({
              id: `lane-${event.payload.laneId}`,
              order: event.payload.laneId,
            });
          }
          break;
        case 'NodeRenamed': {
          const node = model.nodes.find(node => node.nodeId === event.payload.nodeId);
          node!.label = event.payload.newName;
          break;
        }
        case 'NodesConnected':
          model.edges.push({
            sourceNodeId: event.payload.sourceNodeId,
            targetNodeId: event.payload.targetNodeId,
            role: event.payload.role
          });
          break;
      }
    }
    return model;
  }
}