import {createProjectorInstance, type DcbEvent, type DcbReadOptions, type DcbSpecStore, replayProjector} from '../domain/eventSourcing';
import {graphProjectorDefinition} from '../domain/graphProjector/graphProjector';
import {workspaceProjectorDefinition, type WorkspaceProjection} from '../domain/workspaceProjector';
import {adaptModelGraphToRenderer, type RendererGraph} from '../graph/domainGraphAdapter';

const DEFAULT_PROJECT_ID = 'default-project';
const DEFAULT_CHAPTER_ID = 'default-chapter';

export type GraphModelScope = {
  projectId?: string;
  chapterId?: string;
};

export type Subscription = {
  unsubscribe(): void;
};

type Listener<T> = (value: T) => void;

type ScopedGraphView = {
  getScope(): {projectId: string; chapterId: string};
  setScope(scope: GraphModelScope): RendererGraph;
  getSnapshot(): RendererGraph;
  subscribe(listener: Listener<RendererGraph>, options?: {emitCurrent?: boolean}): Subscription;
};

export type GraphProjectionService = {
  refresh(): Promise<void>;
  getWorkspaceSnapshot(): WorkspaceProjection;
  subscribeToWorkspace(listener: Listener<WorkspaceProjection>, options?: {emitCurrent?: boolean}): Subscription;
  createScopedGraphView(initialScope?: GraphModelScope): ScopedGraphView;
};

type GraphViewState = {
  requestedScope: GraphModelScope;
  resolvedScope: {projectId: string; chapterId: string};
  snapshot: RendererGraph;
  listeners: Set<Listener<RendererGraph>>;
};

function resolveScope(workspace: WorkspaceProjection, scope: GraphModelScope) {
  const resolvedProjectId = workspace.projects.some((project) => project.id === scope.projectId)
    ? (scope.projectId ?? DEFAULT_PROJECT_ID)
    : (workspace.projects[0]?.id ?? DEFAULT_PROJECT_ID);
  const chapters = workspace.chaptersByProjectId[resolvedProjectId] ?? [];
  const resolvedChapterId = chapters.some((chapter) => chapter.id === scope.chapterId)
    ? (scope.chapterId ?? DEFAULT_CHAPTER_ID)
    : (chapters[0]?.id ?? DEFAULT_CHAPTER_ID);

  return {projectId: resolvedProjectId, chapterId: resolvedChapterId};
}

function rendererGraphFor(events: readonly DcbEvent[], workspace: WorkspaceProjection, scope: GraphModelScope): {
  resolvedScope: {projectId: string; chapterId: string};
  snapshot: RendererGraph;
} {
  const resolvedScope = resolveScope(workspace, scope);
  const modelGraph = replayProjector(
    createProjectorInstance(graphProjectorDefinition, resolvedScope),
    events,
  );
  return {
    resolvedScope,
    snapshot: adaptModelGraphToRenderer(modelGraph),
  };
}

function isEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createGraphProjectionService(config: {commandStore: DcbSpecStore}): GraphProjectionService {
  let events: readonly DcbEvent[] = [];
  // Reserved for the upcoming incremental projector refresh path, where refresh()
  // will only read events after the last applied sequence position.
  let lastSeenPosition: number | undefined;
  let workspaceSnapshot: WorkspaceProjection = replayProjector(
    createProjectorInstance(workspaceProjectorDefinition, undefined),
    [],
  );
  const workspaceListeners = new Set<Listener<WorkspaceProjection>>();
  const graphViews = new Set<GraphViewState>();

  const readAllEvents = async (options: DcbReadOptions = {}) => config.commandStore.read(options);

  const recomputeGraphView = (graphView: GraphViewState): RendererGraph => {
    const previousSnapshot = graphView.snapshot;
    const previousScope = graphView.resolvedScope;
    const next = rendererGraphFor(events, workspaceSnapshot, graphView.requestedScope);
    graphView.resolvedScope = next.resolvedScope;
    graphView.snapshot = next.snapshot;

    if (!isEqual(previousSnapshot, graphView.snapshot) || !isEqual(previousScope, graphView.resolvedScope)) {
      graphView.listeners.forEach((listener) => listener(graphView.snapshot));
    }

    return graphView.snapshot;
  };

  return {
    async refresh() {
      const sequencedEvents = await readAllEvents();
      events = sequencedEvents.map(({event}) => event);
      lastSeenPosition = sequencedEvents.at(-1)?.position ?? lastSeenPosition;

      const nextWorkspaceSnapshot = replayProjector(
        createProjectorInstance(workspaceProjectorDefinition, undefined),
        events,
      );
      const workspaceChanged = !isEqual(workspaceSnapshot, nextWorkspaceSnapshot);
      workspaceSnapshot = nextWorkspaceSnapshot;

      graphViews.forEach(recomputeGraphView);

      if (workspaceChanged) {
        workspaceListeners.forEach((listener) => listener(workspaceSnapshot));
      }
    },
    getWorkspaceSnapshot() {
      return workspaceSnapshot;
    },
    subscribeToWorkspace(listener, options = {}) {
      workspaceListeners.add(listener);
      if (options.emitCurrent) {
        listener(workspaceSnapshot);
      }
      return {
        unsubscribe() {
          workspaceListeners.delete(listener);
        },
      };
    },
    createScopedGraphView(initialScope = {}) {
      const initialProjection = rendererGraphFor(events, workspaceSnapshot, initialScope);
      const graphView: GraphViewState = {
        requestedScope: initialScope,
        resolvedScope: initialProjection.resolvedScope,
        snapshot: initialProjection.snapshot,
        listeners: new Set(),
      };
      graphViews.add(graphView);

      return {
        getScope() {
          return graphView.resolvedScope;
        },
        setScope(scope) {
          graphView.requestedScope = scope;
          return recomputeGraphView(graphView);
        },
        getSnapshot() {
          return graphView.snapshot;
        },
        subscribe(listener, options = {}) {
          graphView.listeners.add(listener);
          if (options.emitCurrent) {
            listener(graphView.snapshot);
          }
          return {
            unsubscribe() {
              graphView.listeners.delete(listener);
            },
          };
        },
      };
    },
  };
}
