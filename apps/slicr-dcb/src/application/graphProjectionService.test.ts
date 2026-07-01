import {describe, expect, it} from 'vitest';

import {createGraphProjectionService} from './graphProjectionService';
import {Events, type DcbEvent} from '../domain/events';
import {MemorySpecEventStore, type SpecEventStore} from '@slicr/event-sourcing';
import {NODE_HEIGHT, NODE_WIDTH} from '../graph/constants';

const defaultProjectId = 'default-project';

async function createStore(initialEvents: DcbEvent[] = []): Promise<SpecEventStore<DcbEvent>> {
  const commandStore = MemorySpecEventStore.create<DcbEvent>();

  if (initialEvents.length > 0) {
    await commandStore.append(initialEvents);
  }

  return commandStore;
}

describe('createGraphProjectionService', () => {
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
          height: NODE_HEIGHT
        },
      ],
      edges: [],
      lanes: [{id: 'lane-1', order: 1}],
      nodeSchemas: {},
      nodeExampleValues: {},
    });
  });

  it('notifies workspace and graph subscribers on refresh and scope changes', async () => {
    const commandStore = await createStore([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      Events.chapterAdded(defaultProjectId, 'chapter-2', 'Chapter 2'),
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'ui', 0, 'Default Chapter Node'),
      Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-2', 'evt', 1, 'Other Chapter Node'),
    ]);
    const service = createGraphProjectionService({commandStore});
    const graphView = service.createScopedGraphView({projectId: defaultProjectId, chapterId: 'default-chapter'});
    const workspaceNotifications: Array<{ projectCount: number; latestProjectId?: string }> = [];
    const graphNotifications: string[][] = [];

    service.subscribeToWorkspace((workspace) => {
      workspaceNotifications.push({
        projectCount: workspace.projects.length,
        latestProjectId: workspace.latestProjectId,
      });
    }, {emitCurrent: true});
    graphView.subscribe((graph) => {
      graphNotifications.push(graph.nodes.map((node) => node.id));
    }, {emitCurrent: true});

    await service.refresh();
    const graphAfterScopeChange = graphView.setScope({projectId: defaultProjectId, chapterId: 'chapter-2'});
    await commandStore.append([
      Events.projectAdded('project-2', 'Inventory System'),
      Events.chapterAdded('project-2', 'chapter-3', 'Stock Levels'),
      Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-3', 'dm', 2, 'Projected Later'),
    ]);
    await service.refresh();

    expect(workspaceNotifications).toEqual([
      {projectCount: 0, latestProjectId: undefined},
      {projectCount: 1, latestProjectId: defaultProjectId},
      {projectCount: 2, latestProjectId: 'project-2'},
    ]);
    expect(graphAfterScopeChange.nodes.map((node) => node.id)).toEqual(['node-2']);
    expect(graphNotifications).toEqual([
      [],
      ['node-1'],
      ['node-2'],
      ['node-2', 'node-3'],
    ]);
  });

  it('stops notifying unsubscribed workspace and graph listeners', async () => {
    const commandStore = await createStore([
      Events.projectAdded(defaultProjectId, 'Default Project'),
      Events.chapterAdded(defaultProjectId, 'default-chapter', 'Chapter 1'),
      Events.chapterAdded(defaultProjectId, 'chapter-2', 'Chapter 2'),
      Events.nodeAdded(defaultProjectId, 'default-chapter', 'node-1', 'ui', 0, 'Default Chapter Node'),
      Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-2', 'evt', 1, 'Other Chapter Node'),
    ]);
    const service = createGraphProjectionService({commandStore});
    const graphView = service.createScopedGraphView({projectId: defaultProjectId, chapterId: 'default-chapter'});
    const workspaceNotifications: Array<{ projectCount: number; latestProjectId?: string }> = [];
    const graphNotifications: string[][] = [];

    const workspaceSubscription = service.subscribeToWorkspace((workspace) => {
      workspaceNotifications.push({
        projectCount: workspace.projects.length,
        latestProjectId: workspace.latestProjectId,
      });
    }, {emitCurrent: true});
    const graphSubscription = graphView.subscribe((graph) => {
      graphNotifications.push(graph.nodes.map((node) => node.id));
    }, {emitCurrent: true});

    await service.refresh();
    workspaceSubscription.unsubscribe();
    graphSubscription.unsubscribe();

    graphView.setScope({projectId: defaultProjectId, chapterId: 'chapter-2'});
    await commandStore.append([
      Events.projectAdded('project-2', 'Inventory System'),
      Events.chapterAdded('project-2', 'chapter-3', 'Stock Levels'),
      Events.nodeAdded(defaultProjectId, 'chapter-2', 'node-3', 'dm', 2, 'Projected Later'),
    ]);
    await service.refresh();

    expect(workspaceNotifications).toEqual([
      {projectCount: 0, latestProjectId: undefined},
      {projectCount: 1, latestProjectId: defaultProjectId},
    ]);
    expect(graphNotifications).toEqual([
      [],
      ['node-1'],
    ]);
    expect(graphView.getSnapshot().nodes.map((node) => node.id)).toEqual(['node-2', 'node-3']);
  });
});
