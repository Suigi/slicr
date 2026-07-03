import {createEventSourcedGraphModel, type EventSourcedGraphModel, type GraphModelScope} from '../graph/eventSourcedGraphModel';
import type {RendererGraph} from '../graph/domainGraphAdapter';
import {createEventBackupService, type EventBackupService} from './eventBackup';
import {createDefaultGraphEventStore} from './graphEventStores';
import {ensureInitialWorkspace} from './initialWorkspace';

export async function createGraphApplication(
  scope: GraphModelScope = {},
  options: {ensureInitialWorkspace?: boolean} = {},
): Promise<{
  model: EventSourcedGraphModel;
  graphModel: RendererGraph;
  eventBackup: EventBackupService;
}> {
  const stores = await createDefaultGraphEventStore();

  if (options.ensureInitialWorkspace !== false) {
    await ensureInitialWorkspace({
      store: stores.commandStore,
    });
  }

  const model = createEventSourcedGraphModel({
    commandStore: stores.commandStore,
  });

  const eventBackup = createEventBackupService({
    store: stores.commandStore,
    adminStore: stores.graphStore,
  });

  const graphModel = await model.load(scope);

  return {model, graphModel, eventBackup};
}
