import {beforeEach, describe, expect, it} from 'vitest';

import {createGraphApplication} from './createGraphApplication';
import {createDefaultGraphEventStore} from './graphEventStores';
import {Events} from '../domain/events';

const defaultChapterId = 'default-chapter';

describe('createGraphApplication', () => {
  beforeEach(async () => {
    const stores = await createDefaultGraphEventStore();
    await stores.graphStore.restoreBackup([]);
  });

  it('returns initially caught-up default workspace and empty graph snapshots from an empty store', async () => {
    const application = await createGraphApplication();
    const workspace = application.model.getWorkspace();
    const defaultProjectId = workspace.latestProjectId!;

    expect(workspace).toEqual({
      projects: [{id: defaultProjectId, name: 'Default Project'}],
      chaptersByProjectId: {
        [defaultProjectId]: [{id: defaultChapterId, title: 'Chapter 1'}],
      },
      latestProjectId: defaultProjectId,
    });
    expect(application.model.getScope()).toEqual({projectId: defaultProjectId, chapterId: defaultChapterId});
    expect(application.graphModel).toEqual({nodes: [], edges: [], lanes: [], nodeSchemas: {}, nodeExampleValues: {}});
    expect(application.model.getSnapshot()).toEqual(application.graphModel);
  });

  it('returns initially caught-up workspace and graph snapshots from existing store events', async () => {
    const stores = await createDefaultGraphEventStore();
    const existingProjectId = 'existing-project-id';
    const existingChapterId = 'existing-chapter-id';
    await stores.graphStore.restoreBackup([
      Events.projectAdded(existingProjectId, 'Checkout System'),
      Events.chapterAdded(existingProjectId, existingChapterId, 'Overview'),
      Events.nodeAdded(existingProjectId, existingChapterId, 'node-1', 'evt', 1, 'Checkout Completed'),
    ]);

    const application = await createGraphApplication({projectId: existingProjectId, chapterId: existingChapterId});

    expect(application.model.getWorkspace()).toEqual({
      projects: [{id: existingProjectId, name: 'Checkout System'}],
      chaptersByProjectId: {
        [existingProjectId]: [{id: existingChapterId, title: 'Overview'}],
      },
      latestProjectId: existingProjectId,
    });
    expect(application.model.getScope()).toEqual({
      projectId: existingProjectId,
      chapterId: existingChapterId,
    });
    expect(application.graphModel.nodes.map((node) => ({id: node.id, label: node.label, type: node.type}))).toEqual([
      {
        id: 'node-1',
        label: 'Checkout Completed',
        type: 'evt',
      },
    ]);
    expect(application.model.getSnapshot()).toEqual(application.graphModel);
  });

  it('bootstraps explicit workspace and scoped graph reads from existing history', async () => {
    const stores = await createDefaultGraphEventStore();
    await stores.graphStore.restoreBackup([
      Events.projectAdded('project-1', 'Existing'),
      Events.chapterAdded('project-1', 'chapter-1', 'First'),
      Events.nodeAdded('project-1', 'chapter-1', 'node-1', 'evt', 1, 'Recorded'),
    ]);

    const application = await createGraphApplication({projectId: 'project-1', chapterId: 'chapter-1'});
    expect(application.workspace.getWorkspaceSnapshot().projects).toEqual([{id: 'project-1', name: 'Existing'}]);
    expect(application.graph.getScope()).toEqual({projectId: 'project-1', chapterId: 'chapter-1'});
    expect(application.graph.getSnapshot().nodes[0].label).toBe('Recorded');
    const anotherView = application.graph.createScopedView({projectId: 'project-1', chapterId: 'chapter-1'});
    expect((await anotherView.setScope({projectId: 'project-1', chapterId: 'chapter-1'})).nodes[0].label).toBe('Recorded');
  });

  it('delivers explicit workspace and graph subscriptions after commands, sharing the facade state', async () => {
    const application = await createGraphApplication();
    const workspaceNames: string[][] = [];
    const graphLabels: string[][] = [];
    application.workspace.subscribeToWorkspace((snapshot) => workspaceNames.push(snapshot.projects.map((project) => project.name)), {
      emitCurrent: false,
    });
    application.graph.subscribe((snapshot) => graphLabels.push(snapshot.nodes.map((node) => node.label)), {emitCurrent: false});

    await application.commands.addNewSlice();
    const nodeId = application.graph.getSnapshot().nodes[0].id;
    await application.commands.renameNode(nodeId, 'Renamed');
    await application.commands.addProject('Another');

    expect(graphLabels).toEqual([['Node 1'], ['Renamed'], []]);
    expect(workspaceNames.at(-1)).toEqual(['Default Project', 'Another']);
    expect(application.model.getScope()).toEqual(application.graph.getScope());
    expect(application.model.getSnapshot()).toEqual(application.graph.getSnapshot());
  });

  it('delivers scoped graph subscription updates after commands append events', async () => {
    const application = await createGraphApplication();
    const scopedGraphView = application.model.createScopedGraphView(application.model.getScope());
    await scopedGraphView.setScope(application.model.getScope());
    const graphNotifications: string[][] = [];
    let latestNodeId: string | undefined;
    scopedGraphView.subscribe(
      (graph) => {
        latestNodeId = graph.nodes[0]?.id;
        graphNotifications.push(graph.nodes.map((node) => `${node.label}`));
      },
      {emitCurrent: false},
    );

    await application.model.addNewSlice();
    await application.model.renameNode(latestNodeId!, 'Renamed Node');

    expect(graphNotifications).toEqual([['Node 1'], ['Renamed Node']]);
  });
});
