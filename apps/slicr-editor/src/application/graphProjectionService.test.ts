import {describe, expect, it} from 'vitest';

import {createGraphProjectionService} from './graphProjectionService';
import {Events, type DcbEvent} from '@slicr/core/events';
import {MemorySpecEventStore, Query, type ReadOptions, type SequencedEvent, type SpecEventStore} from '@slicr/event-sourcing';
import {NODE_HEIGHT, NODE_WIDTH} from '../graph/constants';

const defaultProjectId = 'default-project';

async function createStore(initialEvents: DcbEvent[] = []): Promise<SpecEventStore<DcbEvent>> {
  const commandStore = MemorySpecEventStore.create<DcbEvent>();

  if (initialEvents.length > 0) {
    await commandStore.append(initialEvents);
  }

  return commandStore;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return {promise, resolve};
}

async function createStoreWithQueryDelay(
  initialEvents: DcbEvent[],
  delayQuery: (queryCallNumber: number) => Promise<void> | void,
): Promise<SpecEventStore<DcbEvent>> {
  const store = MemorySpecEventStore.create<DcbEvent>();

  if (initialEvents.length > 0) {
    await store.append(initialEvents);
  }

  let queryCallCount = 0;

  return {
    read(options?: ReadOptions): Promise<readonly SequencedEvent<DcbEvent>[]> {
      return store.read(options);
    },
    async query(query: Query, options?: ReadOptions): Promise<readonly SequencedEvent<DcbEvent>[]> {
      queryCallCount += 1;
      await delayQuery(queryCallCount);
      return store.query(query, options);
    },
    append(events, condition) {
      return store.append(events, condition);
    },
    subscribe(query, listener) {
      return store.subscribe(query, listener);
    },
  };
}

describe('createGraphProjectionService', () => {
  it('delivers the caught-up workspace snapshot on first emitCurrent delivery', async () => {
    const commandStore = await createStore([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
    ]);
    const service = createGraphProjectionService({commandStore});
    const workspaceNotifications: Array<{projectCount: number; latestProjectId?: string}> = [];

    service.subscribeToWorkspace((workspace) => {
      workspaceNotifications.push({
        projectCount: workspace.projects.length,
        latestProjectId: workspace.latestProjectId,
      });
    });

    await service.refresh();

    expect(workspaceNotifications).toEqual([{projectCount: 1, latestProjectId: defaultProjectId}]);
  });

  it('delivers the caught-up scoped graph snapshot on first emitCurrent delivery', async () => {
    const commandStore = await createStore([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'ui', 0, 'Default Chapter Node'),
    ]);
    const service = createGraphProjectionService({commandStore});
    const graphView = service.createScopedGraphView({projectId: defaultProjectId, chapterId: 'default-chapter'});
    const graphNotifications: string[][] = [];

    graphView.subscribe((graph) => {
      graphNotifications.push(graph.nodes.map((node) => node.id));
    });

    await service.refresh();

    expect(graphNotifications).toEqual([['node-1']]);
  });

  it('updates workspace and graph subscriptions from store appends without manual refresh', async () => {
    const commandStore = await createStore([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'ui', 0, 'Default Chapter Node'),
    ]);
    const service = createGraphProjectionService({commandStore});
    const graphView = service.createScopedGraphView({projectId: defaultProjectId, chapterId: 'default-chapter'});
    const workspaceNotifications: Array<{projectCount: number; latestProjectId?: string}> = [];
    const graphNotifications: string[][] = [];

    await service.refresh();

    service.subscribeToWorkspace((workspace) => {
      workspaceNotifications.push({
        projectCount: workspace.projects.length,
        latestProjectId: workspace.latestProjectId,
      });
    });
    graphView.subscribe((graph) => {
      graphNotifications.push(graph.nodes.map((node) => node.id));
    });

    await commandStore.append([
      Events.projectAdded('project-2', 'Inventory System'),
      Events.chapterAdded('project-2', 'chapter-3', 'Stock Levels'),
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-2', 'evt', 1, 'Projected Later'),
    ]);

    expect(workspaceNotifications).toEqual([
      {projectCount: 1, latestProjectId: defaultProjectId},
      {projectCount: 2, latestProjectId: 'project-2'},
    ]);
    expect(graphNotifications).toEqual([['node-1'], ['node-1', 'node-2']]);
  });

  it('does not flush pending graph subscribers from a stale scope activation', async () => {
    const firstDelayedQueryStarted = deferred();
    const secondDelayedQueryStarted = deferred();
    const releaseChapter2CatchUp = deferred();
    const releaseChapter3CatchUp = deferred();
    let delayScopeChanges = false;
    let delayedScopeChangeCount = 0;
    const commandStore = await createStoreWithQueryDelay(
      [
        Events.projectAdded(defaultProjectId, 'Default Project'),
        Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
        Events.chapterAdded(defaultProjectId, 'chapter-2', 'Chapter 2'),
        Events.chapterAdded(defaultProjectId, 'chapter-3', 'Chapter 3'),
        Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'ui', 0, 'Default Chapter Node'),
        Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-2', 'evt', 1, 'Chapter 2 Node'),
        Events.nodeAdded(defaultProjectId, 'chapter-3', 'node-3', 'dm', 2, 'Chapter 3 Node'),
      ],
      async () => {
        if (!delayScopeChanges) {
          return;
        }

        delayedScopeChangeCount += 1;
        if (delayedScopeChangeCount === 1) {
          firstDelayedQueryStarted.resolve();
          await releaseChapter2CatchUp.promise;
        }
        if (delayedScopeChangeCount === 2) {
          secondDelayedQueryStarted.resolve();
          await releaseChapter3CatchUp.promise;
        }
      },
    );
    const service = createGraphProjectionService({commandStore});
    const graphView = service.createScopedGraphView({projectId: defaultProjectId, chapterId: 'default-chapter'});

    await service.refresh();

    delayScopeChanges = true;
    const chapter2ScopeChange = graphView.setScope({projectId: defaultProjectId, chapterId: 'chapter-2'});
    await firstDelayedQueryStarted.promise;
    const chapter3ScopeChange = graphView.setScope({projectId: defaultProjectId, chapterId: 'chapter-3'});
    await secondDelayedQueryStarted.promise;
    const graphNotifications: string[][] = [];

    graphView.subscribe((graph) => {
      graphNotifications.push(graph.nodes.map((node) => node.id));
    });

    releaseChapter2CatchUp.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(graphNotifications).toEqual([]);

    releaseChapter3CatchUp.resolve();
    await Promise.all([chapter2ScopeChange, chapter3ScopeChange]);

    expect(graphNotifications).toEqual([['node-3']]);
  });

  it('refreshes workspace and scoped graph snapshots from the command store', async () => {
    const commandStore = await createStore([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      Events.chapterAdded(defaultProjectId, 'chapter-2', 'Chapter 2'),
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'ui', 0, 'Default Chapter Node'),
      Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-2', 'evt', 1, 'Other Chapter Node'),
    ]);
    const service = createGraphProjectionService({commandStore});
    const graphView = service.createScopedGraphView({projectId: defaultProjectId, chapterId: 'chapter-2'});

    await service.refresh();

    expect(service.getWorkspaceSnapshot()).toEqual({
      projects: [{id: defaultProjectId, name: 'Default Project'}],
      chaptersByProjectId: {
        [defaultProjectId]: [
          {id: 'default-chapter', title: 'Chapter 1'},
          {id: 'chapter-2', title: 'Chapter 2'},
        ],
      },
      latestProjectId: defaultProjectId,
    });
    expect(graphView.getScope()).toEqual({projectId: defaultProjectId, chapterId: 'chapter-2'});
    expect(graphView.getSnapshot()).toEqual({
      nodes: [
        {
          id: 'node-2',
          label: 'Other Chapter Node',
          type: 'evt',
          laneId: 'lane-1',
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        },
      ],
      edges: [],
      lanes: [{id: 'lane-1', order: 1}],
      nodeSchemas: {},
      nodeExampleValues: {},
    });
  });

  it('notifies graph subscribers when scope changes and later matching appends arrive', async () => {
    const commandStore = await createStore([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      Events.chapterAdded(defaultProjectId, 'chapter-2', 'Chapter 2'),
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'ui', 0, 'Default Chapter Node'),
      Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-2', 'evt', 1, 'Other Chapter Node'),
    ]);
    const service = createGraphProjectionService({commandStore});
    const graphView = service.createScopedGraphView({projectId: defaultProjectId, chapterId: 'default-chapter'});
    const graphNotifications: string[][] = [];

    graphView.subscribe(
      (graph) => {
        graphNotifications.push(graph.nodes.map((node) => node.id));
      },
      {emitCurrent: true},
    );

    await service.refresh();
    const graphAfterScopeChange = await graphView.setScope({projectId: defaultProjectId, chapterId: 'chapter-2'});
    await commandStore.append([Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-3', 'dm', 2, 'Projected Later')]);

    expect(graphAfterScopeChange.nodes.map((node) => node.id)).toEqual(['node-2']);
    expect(graphNotifications).toEqual([['node-1'], ['node-2'], ['node-2', 'node-3']]);
  });

  it('stops notifying unsubscribed workspace listeners after later appends', async () => {
    const commandStore = await createStore([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
    ]);
    const service = createGraphProjectionService({commandStore});
    const workspaceNotifications: Array<{projectCount: number; latestProjectId?: string}> = [];

    const workspaceSubscription = service.subscribeToWorkspace(
      (workspace) => {
        workspaceNotifications.push({
          projectCount: workspace.projects.length,
          latestProjectId: workspace.latestProjectId,
        });
      },
      {emitCurrent: true},
    );

    await service.refresh();
    workspaceSubscription.unsubscribe();
    await commandStore.append([Events.projectAdded('project-2', 'Inventory System')]);

    expect(workspaceNotifications).toEqual([{projectCount: 1, latestProjectId: defaultProjectId}]);
  });

  it('stops notifying unsubscribed graph listeners while the scoped snapshot still catches up', async () => {
    const commandStore = await createStore([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      Events.chapterAdded(defaultProjectId, 'chapter-2', 'Chapter 2'),
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'ui', 0, 'Default Chapter Node'),
      Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-2', 'evt', 1, 'Other Chapter Node'),
    ]);
    const service = createGraphProjectionService({commandStore});
    const graphView = service.createScopedGraphView({projectId: defaultProjectId, chapterId: 'default-chapter'});
    const graphNotifications: string[][] = [];

    const graphSubscription = graphView.subscribe(
      (graph) => {
        graphNotifications.push(graph.nodes.map((node) => node.id));
      },
      {emitCurrent: true},
    );

    await service.refresh();
    graphSubscription.unsubscribe();

    await graphView.setScope({projectId: defaultProjectId, chapterId: 'chapter-2'});
    await commandStore.append([Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-3', 'dm', 2, 'Projected Later')]);

    expect(graphNotifications).toEqual([['node-1']]);
    expect(graphView.getSnapshot().nodes.map((node) => node.id)).toEqual(['node-2', 'node-3']);
  });
});
