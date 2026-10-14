import {createEventSourcedGraphModel, type EventSourcedGraphModel, type GraphModelScope} from '../graph/eventSourcedGraphModel';
import type {RendererGraph} from '../graph/domainGraphAdapter';
import {createCommandRouter} from './commandRouter';
import {createEventBackupService, type EventBackupService} from './eventBackup';
import {createDefaultGraphEventStore} from './graphEventStores';
import {createGraphProjectionService} from './graphProjectionService';
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

  const executeCommand = createCommandRouter({store: stores.commandStore});
  const projectionService = createGraphProjectionService({commandStore: stores.commandStore});
  const scopedGraphView = projectionService.createScopedGraphView(scope);

  await projectionService.refresh();

  const model = createEventSourcedGraphModel({
    commandStore: stores.commandStore,
    executeCommand,
    projectionService,
    scopedGraphView,
  });

  const eventBackup = createEventBackupService({
    store: stores.commandStore,
    adminStore: stores.graphStore,
  });

  return {model, graphModel: scopedGraphView.getSnapshot(), eventBackup};
}
