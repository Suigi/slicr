import {createEventSourcedGraphModel, type EventSourcedGraphModel, type GraphModelScope} from '../graph/eventSourcedGraphModel';
import type {RendererGraph} from '../graph/domainGraphAdapter';
import {createDefaultGraphEventStore} from './graphEventStores';
import {ensureInitialWorkspace} from './initialWorkspace';

export async function createGraphApplication(scope: GraphModelScope = {}): Promise<{
  model: EventSourcedGraphModel,
  graphModel: RendererGraph,
}> {
  const stores = await createDefaultGraphEventStore();

  await ensureInitialWorkspace({
    store: stores.commandStore,
  });

  const model = createEventSourcedGraphModel({
    store: stores.graphStore,
    commandStore: stores.commandStore,
  });

  const graphModel = await model.load(scope);

  return {model, graphModel};
}
