import {type ProjectorStoreSubscription, subscribeProjectorToStore} from '@slicr/event-sourcing';

import {createProjectorInstance, type DcbSpecStore, replayProjector} from '@slicr/core/eventSourcing';
import {graphProjectorDefinition} from '@slicr/core/graphProjector/graphProjector';
import {workspaceProjectorDefinition, type WorkspaceProjection} from '@slicr/core/workspaceProjector';
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
  setScope(scope: GraphModelScope): Promise<RendererGraph>;
  getSnapshot(): RendererGraph;
  subscribe(listener: Listener<RendererGraph>, options?: {emitCurrent?: boolean}): Subscription;
};

export type GraphProjectionService = {
  refresh(): Promise<void>;
  getWorkspaceSnapshot(): WorkspaceProjection;
  subscribeToWorkspace(listener: Listener<WorkspaceProjection>, options?: {emitCurrent?: boolean}): Subscription;
  createScopedGraphView(initialScope?: GraphModelScope): ScopedGraphView;
};

type ResolvedGraphModelScope = {projectId: string; chapterId: string};

type GraphViewState = {
  requestedScope: GraphModelScope;
  resolvedScope: ResolvedGraphModelScope;
  snapshot: RendererGraph;
  listeners: Set<Listener<RendererGraph>>;
  pendingListeners: Map<Listener<RendererGraph>, {emitCurrent: boolean}>;
  subscription?: ProjectorStoreSubscription;
  activationVersion: number;
  ready: Promise<void>;
  isReady: boolean;
};

function resolveScope(workspace: WorkspaceProjection, scope: GraphModelScope): ResolvedGraphModelScope {
  const resolvedProjectId = workspace.projects.some((project) => project.id === scope.projectId)
    ? (scope.projectId ?? DEFAULT_PROJECT_ID)
    : (workspace.projects[0]?.id ?? DEFAULT_PROJECT_ID);
  const chapters = workspace.chaptersByProjectId[resolvedProjectId] ?? [];
  const resolvedChapterId = chapters.some((chapter) => chapter.id === scope.chapterId)
    ? (scope.chapterId ?? DEFAULT_CHAPTER_ID)
    : (chapters[0]?.id ?? DEFAULT_CHAPTER_ID);

  return {projectId: resolvedProjectId, chapterId: resolvedChapterId};
}

function isEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

const emptyWorkspaceSnapshot = (): WorkspaceProjection =>
  replayProjector(createProjectorInstance(workspaceProjectorDefinition, undefined), []);

const emptyRendererGraph = (): RendererGraph =>
  adaptModelGraphToRenderer(
    replayProjector(createProjectorInstance(graphProjectorDefinition, {projectId: DEFAULT_PROJECT_ID, chapterId: DEFAULT_CHAPTER_ID}), []),
  );

export function createGraphProjectionService(config: {commandStore: DcbSpecStore}): GraphProjectionService {
  let workspaceSnapshot: WorkspaceProjection = emptyWorkspaceSnapshot();
  let workspaceReady: Promise<void> | undefined;
  let workspaceIsReady = false;
  const workspaceListeners = new Set<Listener<WorkspaceProjection>>();
  const pendingWorkspaceListeners = new Map<Listener<WorkspaceProjection>, {emitCurrent: boolean}>();
  const graphViews = new Set<GraphViewState>();

  const activateGraphView = async (graphView: GraphViewState): Promise<RendererGraph> => {
    const activationVersion = ++graphView.activationVersion;
    await ensureWorkspaceProjection();

    const resolvedScope = resolveScope(workspaceSnapshot, graphView.requestedScope);
    const previousSubscription = graphView.subscription;
    const nextSubscription = await subscribeProjectorToStore(config.commandStore, graphProjectorDefinition, resolvedScope, (modelGraph) => {
      if (graphView.activationVersion !== activationVersion) {
        return;
      }

      const nextSnapshot = adaptModelGraphToRenderer(modelGraph);
      const scopeChanged = !isEqual(graphView.resolvedScope, resolvedScope);
      const snapshotChanged = !isEqual(graphView.snapshot, nextSnapshot);
      graphView.resolvedScope = resolvedScope;
      graphView.snapshot = nextSnapshot;

      if (scopeChanged || snapshotChanged) {
        graphView.listeners.forEach((listener) => listener(graphView.snapshot));
      }
    });

    if (graphView.activationVersion !== activationVersion) {
      nextSubscription.unsubscribe();
      return graphView.snapshot;
    }

    graphView.subscription = nextSubscription;
    previousSubscription?.unsubscribe();
    return graphView.snapshot;
  };

  const flushPendingGraphListeners = (graphView: GraphViewState) => {
    graphView.pendingListeners.forEach((options, listener) => {
      graphView.listeners.add(listener);
      if (options.emitCurrent) {
        listener(graphView.snapshot);
      }
    });
    graphView.pendingListeners.clear();
  };

  const scheduleGraphViewActivation = (graphView: GraphViewState): Promise<RendererGraph> => {
    graphView.isReady = false;
    const activation = activateGraphView(graphView);
    graphView.ready = activation.then(() => {
      graphView.isReady = true;
      flushPendingGraphListeners(graphView);
    });
    return activation;
  };

  const ensureWorkspaceProjection = (): Promise<void> => {
    if (workspaceReady !== undefined) {
      return workspaceReady;
    }

    workspaceReady = (async () => {
      await subscribeProjectorToStore(config.commandStore, workspaceProjectorDefinition, undefined, (projection) => {
        const previousWorkspaceSnapshot = workspaceSnapshot;
        workspaceSnapshot = projection;

        if (!isEqual(previousWorkspaceSnapshot, workspaceSnapshot)) {
          workspaceListeners.forEach((listener) => listener(workspaceSnapshot));
        }

        graphViews.forEach((graphView) => {
          const nextResolvedScope = resolveScope(workspaceSnapshot, graphView.requestedScope);
          if (graphView.subscription === undefined || !isEqual(graphView.resolvedScope, nextResolvedScope)) {
            void scheduleGraphViewActivation(graphView);
          }
        });
      });
      workspaceIsReady = true;
      pendingWorkspaceListeners.forEach((options, listener) => {
        workspaceListeners.add(listener);
        if (options.emitCurrent) {
          listener(workspaceSnapshot);
        }
      });
      pendingWorkspaceListeners.clear();
    })();

    return workspaceReady;
  };

  return {
    async refresh() {
      await ensureWorkspaceProjection();
      await Promise.all([...graphViews].map((graphView) => graphView.ready));
    },
    getWorkspaceSnapshot() {
      return workspaceSnapshot;
    },
    subscribeToWorkspace(listener, options = {}) {
      const emitCurrent = options.emitCurrent !== false;
      if (workspaceIsReady) {
        workspaceListeners.add(listener);
        if (emitCurrent) {
          listener(workspaceSnapshot);
        }
      } else {
        pendingWorkspaceListeners.set(listener, {emitCurrent});
        void ensureWorkspaceProjection();
      }
      return {
        unsubscribe() {
          pendingWorkspaceListeners.delete(listener);
          workspaceListeners.delete(listener);
        },
      };
    },
    createScopedGraphView(initialScope = {}) {
      const graphView: GraphViewState = {
        requestedScope: initialScope,
        resolvedScope: resolveScope(workspaceSnapshot, initialScope),
        snapshot: emptyRendererGraph(),
        listeners: new Set(),
        pendingListeners: new Map(),
        activationVersion: 0,
        ready: Promise.resolve(),
        isReady: false,
      };
      graphViews.add(graphView);
      void ensureWorkspaceProjection();
      scheduleGraphViewActivation(graphView);

      return {
        getScope() {
          return graphView.resolvedScope;
        },
        async setScope(scope) {
          graphView.requestedScope = scope;
          return scheduleGraphViewActivation(graphView);
        },
        getSnapshot() {
          return graphView.snapshot;
        },
        subscribe(listener, options = {}) {
          const emitCurrent = options.emitCurrent !== false;
          if (graphView.isReady) {
            graphView.listeners.add(listener);
            if (emitCurrent) {
              listener(graphView.snapshot);
            }
          } else {
            graphView.pendingListeners.set(listener, {emitCurrent});
          }
          return {
            unsubscribe() {
              graphView.pendingListeners.delete(listener);
              graphView.listeners.delete(listener);
            },
          };
        },
      };
    },
  };
}
