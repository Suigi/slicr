import {
  createEventSourcedGraphModel,
  createGraphCommands,
  type EventSourcedGraphModel,
  type GraphCommands,
  type GraphModelScope,
  type ScopedGraphView,
} from '../graph/eventSourcedGraphModel';
import type {RendererGraph} from '../graph/domainGraphAdapter';
import {createCommandRouter} from './commandRouter';
import {createEventBackupService, type EventBackupService} from './eventBackup';
import {createDefaultGraphEventStore} from './graphEventStores';
import {createGraphProjectionService, type GraphProjectionService} from './graphProjectionService';
import {ensureInitialWorkspace} from './initialWorkspace';

export async function createGraphApplication(
  scope: GraphModelScope = {},
  options: {ensureInitialWorkspace?: boolean} = {},
): Promise<{
  model: EventSourcedGraphModel;
  commands: GraphCommands;
  workspace: Pick<GraphProjectionService, 'getWorkspaceSnapshot' | 'subscribeToWorkspace'>;
  graph: ScopedGraphView & {createScopedView: GraphProjectionService['createScopedGraphView']};
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

  const commands = createGraphCommands({
    executeCommand,
    graphView: scopedGraphView,
    getWorkspaceSnapshot: () => projectionService.getWorkspaceSnapshot(),
  });
  const workspace = {
    getWorkspaceSnapshot: projectionService.getWorkspaceSnapshot,
    subscribeToWorkspace: projectionService.subscribeToWorkspace,
  };
  const graph = {
    getScope: scopedGraphView.getScope,
    setScope: scopedGraphView.setScope,
    getSnapshot: scopedGraphView.getSnapshot,
    subscribe: scopedGraphView.subscribe,
    createScopedView: projectionService.createScopedGraphView,
  };
  const model = createEventSourcedGraphModel({
    commandStore: stores.commandStore,
    executeCommand,
    projectionService,
    scopedGraphView,
    commands,
  });

  const eventBackup = createEventBackupService({
    store: stores.commandStore,
    adminStore: stores.graphStore,
  });

  return {model, commands, workspace, graph, graphModel: scopedGraphView.getSnapshot(), eventBackup};
}
