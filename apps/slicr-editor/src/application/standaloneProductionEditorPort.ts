import type {ProductionEditorPort, EditorCommand, EditorCommandResult, EditorScope, EditorSnapshot} from './productionEditorPort';
import type {createGraphApplication} from './createGraphApplication';

type Application = Awaited<ReturnType<typeof createGraphApplication>>;

/** Adapts the existing IndexedDB/event-sourced application without changing its storage or backup behavior. */
export function createStandaloneProductionEditorPort(application: Application): ProductionEditorPort {
  let revision = 0;
  let currentScope: EditorScope = application.graph.getScope();
  let lastFingerprint = '';
  let commandTail = Promise.resolve();
  const listeners = new Set<{scope: EditorScope; listener: (snapshot: EditorSnapshot) => void}>();
  const toSnapshot = (scope: EditorScope): EditorSnapshot => {
    const graph = application.graph.getSnapshot();
    return {...graph, scope, revision: String(revision)};
  };
  const notify = () => {
    currentScope = application.graph.getScope();
    const graph = application.graph.getSnapshot();
    const workspace = application.workspace.getWorkspaceSnapshot();
    const fingerprint = JSON.stringify([currentScope, graph, workspace]);
    if (fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;
    revision += 1;
    const snapshot = toSnapshot(currentScope);
    listeners.forEach(({scope, listener}) => {
      if (scope.projectId === currentScope.projectId && scope.chapterId === currentScope.chapterId) listener(snapshot);
    });
  };
  const graphSubscription = application.graph.subscribe(() => notify());
  const workspaceSubscription = application.workspace.subscribeToWorkspace(() => notify());
  void graphSubscription;
  void workspaceSubscription;

  return {
    async getSnapshot(scope) {
      await application.graph.setScope(scope);
      currentScope = application.graph.getScope();
      notify();
      return toSnapshot(currentScope);
    },
    subscribe(scope, listener) {
      const subscription = {scope, listener};
      listeners.add(subscription);
      if (scope.projectId === currentScope.projectId && scope.chapterId === currentScope.chapterId) listener(toSnapshot(scope));
      return {unsubscribe: () => listeners.delete(subscription)};
    },
    async execute(command: EditorCommand): Promise<EditorCommandResult> {
      // Serialize commands so a second action cannot pass the first action's observed revision.
      const previous = commandTail;
      let release!: () => void;
      commandTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        notify();
        if (command.baseRevision !== String(revision))
          throw new Error('The standalone graph changed since this editor view was loaded. Reload and retry.');
        await application.graph.setScope(command.scope);
        currentScope = application.graph.getScope();
        notify();
        if (
          command.baseRevision !== String(revision) ||
          currentScope.projectId !== command.scope.projectId ||
          currentScope.chapterId !== command.scope.chapterId
        )
          throw new Error('The standalone graph changed since this editor view was loaded. Reload and retry.');
        const before = application.graph.getSnapshot();
        const beforeWorkspace = application.workspace.getWorkspaceSnapshot();
        switch (command.type) {
          case 'AddNode':
            await application.commands.addNewSlice();
            break;
          case 'AddProject':
            await application.commands.addProject(command.data.name);
            break;
          case 'RenameProject':
            await application.commands.renameProject(command.data.projectId, command.data.name);
            break;
          case 'AddChapter':
            await application.commands.addChapter(command.data.title);
            break;
          case 'ConnectNodes':
            await application.commands.addConnection(command.data.sourceNodeId, command.data.targetNodeId, command.data.role);
            break;
          case 'DisconnectNodes':
            await application.commands.deleteConnection(command.data.edgeId);
            break;
          case 'AddConnectedNode':
            await application.commands.addConnectedNode({
              sourceNodeId: command.data.sourceNodeId,
              nodeType: command.data.nodeType,
              laneId: command.data.laneId,
              label: command.data.label,
            });
            break;
          case 'RenameNode':
            await application.commands.renameNode(command.data.nodeId, command.data.name);
            break;
          case 'ChangeNodeType':
            await application.commands.setNodeType(command.data.nodeId, command.data.newType);
            break;
          case 'ChangeNodeProperties':
            // One port command retains the two legacy schema/example commands (and their separate event writes).
            await application.commands.changeNodeSchema({nodeId: command.data.nodeId, schema: command.data.schema});
            await application.commands.changeNodeExampleValues({nodeId: command.data.nodeId, exampleValues: command.data.exampleValues});
            break;
          case 'DeleteNode':
            await application.commands.deleteNode(command.data.nodeId);
            break;
        }
        const after = application.graph.getSnapshot();
        const afterWorkspace = application.workspace.getWorkspaceSnapshot();
        const oldNodeIds = new Set(before.nodes.map(({id}) => id));
        const oldEdgeIds = new Set(before.edges.map(({id}) => id));
        const oldProjectIds = new Set(beforeWorkspace.projects.map(({id}) => id));
        const oldChapterIds = new Set(
          Object.values(beforeWorkspace.chaptersByProjectId)
            .flat()
            .map(({id}) => id),
        );
        const createdIds = [
          ...afterWorkspace.projects.filter(({id}) => !oldProjectIds.has(id)).map(({id}) => id),
          ...Object.values(afterWorkspace.chaptersByProjectId)
            .flat()
            .filter(({id}) => !oldChapterIds.has(id))
            .map(({id}) => id),
          ...after.nodes.filter(({id}) => !oldNodeIds.has(id)).map(({id}) => id),
          ...after.edges.filter(({id}) => !oldEdgeIds.has(id)).map(({id}) => id),
        ];
        if (command.type === 'AddChapter') {
          const createdChapterId = createdIds.find((id) =>
            (afterWorkspace.chaptersByProjectId[command.scope.projectId] ?? []).some((chapter) => chapter.id === id),
          );
          if (createdChapterId) {
            currentScope = {projectId: command.scope.projectId, chapterId: createdChapterId};
            await application.graph.setScope(currentScope);
          }
        }
        if (command.type === 'AddProject') {
          const createdProjectId = createdIds.find((id) => afterWorkspace.projects.some((project) => project.id === id));
          const createdChapterId = createdProjectId
            ? createdIds.find((id) => (afterWorkspace.chaptersByProjectId[createdProjectId] ?? []).some((chapter) => chapter.id === id))
            : undefined;
          if (createdProjectId && createdChapterId) {
            currentScope = {projectId: createdProjectId, chapterId: createdChapterId};
            await application.graph.setScope(currentScope);
          }
        }
        notify();
        return {revision: String(revision), createdIds};
      } finally {
        release();
      }
    },
  };
}
