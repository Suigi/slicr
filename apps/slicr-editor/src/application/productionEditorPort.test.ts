import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createGraphApplication} from './createGraphApplication';
import {createDefaultGraphEventStore} from './graphEventStores';
import {createProjectProductionEditorPort, ProjectCommandError} from './projectProductionEditorPort';
import {createStandaloneProductionEditorPort} from './standaloneProductionEditorPort';
import {Events} from '@slicr/core/events';

const scope = {projectId: 'p1', chapterId: 'c1'};

describe('standalone production editor port', () => {
  beforeEach(async () => {
    const stores = await createDefaultGraphEventStore();
    await stores.graphStore.restoreBackup([]);
  });

  it('normalizes IndexedDB-backed graph reads and reports the exact created node identity', async () => {
    const app = await createGraphApplication();
    const port = createStandaloneProductionEditorPort(app);
    const resolvedScope = app.graph.getScope();
    const initial = await port.getSnapshot(resolvedScope);
    expect(initial.nodes).toEqual([]);
    const result = await port.execute({
      scope: resolvedScope,
      baseRevision: initial.revision,
      type: 'AddNode',
      data: {chapterId: resolvedScope.chapterId, nodeType: 'ui', laneId: 0, label: 'New'},
    });
    expect(result.createdIds).toHaveLength(1);
    expect((await port.getSnapshot(resolvedScope)).nodes[0]?.id).toBe(result.createdIds[0]);
  });

  it('rejects a stale observed basis after a separate command changes the graph', async () => {
    const app = await createGraphApplication();
    const port = createStandaloneProductionEditorPort(app);
    const resolvedScope = app.graph.getScope();
    const initial = await port.getSnapshot(resolvedScope);
    await app.commands.addNewSlice();
    const updated = await port.getSnapshot(resolvedScope);
    expect(updated.revision).not.toBe(initial.revision);
    await expect(
      port.execute({
        scope: resolvedScope,
        baseRevision: initial.revision,
        type: 'AddNode',
        data: {chapterId: resolvedScope.chapterId, nodeType: 'ui', laneId: 0, label: 'New'},
      }),
    ).rejects.toThrow('changed since this editor view was loaded');
    expect((await port.getSnapshot(resolvedScope)).nodes).toHaveLength(1);
  });

  it('returns created project/chapter identities and follows the resulting scopes', async () => {
    const app = await createGraphApplication();
    const port = createStandaloneProductionEditorPort(app);
    const initial = await port.getSnapshot(app.graph.getScope());
    const project = await port.execute({scope: initial.scope, baseRevision: initial.revision, type: 'AddProject', data: {name: 'Second'}});
    const createdProjectId = project.createdIds[0];
    const createdChapterId = project.createdIds[1];
    expect(createdProjectId).toBeTruthy();
    expect(createdChapterId).toBeTruthy();
    const projectSnapshot = await port.getSnapshot({projectId: createdProjectId, chapterId: createdChapterId});
    expect(projectSnapshot.scope).toEqual({projectId: createdProjectId, chapterId: createdChapterId});
    const chapter = await port.execute({
      scope: projectSnapshot.scope,
      baseRevision: projectSnapshot.revision,
      type: 'AddChapter',
      data: {title: 'More'},
    });
    expect(chapter.createdIds).toHaveLength(1);
    expect((await port.getSnapshot({projectId: createdProjectId, chapterId: chapter.createdIds[0]})).scope.chapterId).toBe(
      chapter.createdIds[0],
    );
  });

  it('delivers only the active project/chapter to each subscriber across reads, commands, and cleanup', async () => {
    const otherScope = {projectId: 'p2', chapterId: 'c2'};
    const stores = await createDefaultGraphEventStore();
    await stores.graphStore.restoreBackup([
      Events.projectAdded('p1', 'First'),
      Events.chapterAdded('p1', 'c1', 'First chapter'),
      Events.nodeAdded('p1', 'c1', 'node-1', 'evt', 0, 'First node'),
      Events.projectAdded('p2', 'Second'),
      Events.chapterAdded('p2', 'c2', 'Second chapter'),
      Events.nodeAdded('p2', 'c2', 'node-2', 'evt', 0, 'Second node'),
    ]);
    const app = await createGraphApplication(scope);
    const port = createStandaloneProductionEditorPort(app);
    const first = vi.fn();
    const second = vi.fn();
    const firstSubscription = port.subscribe(scope, first);
    const secondSubscription = port.subscribe(otherScope, second);
    expect(first).toHaveBeenCalledWith(expect.objectContaining({scope, nodes: [expect.objectContaining({id: 'node-1'})]}));
    expect(second).not.toHaveBeenCalled();

    const firstCount = first.mock.calls.length;
    const secondSnapshot = await port.getSnapshot(otherScope);
    expect(first).toHaveBeenCalledTimes(firstCount);
    expect(second).toHaveBeenCalledWith(expect.objectContaining({scope: otherScope, nodes: [expect.objectContaining({id: 'node-2'})]}));
    const secondCount = second.mock.calls.length;
    await port.execute({
      scope: otherScope,
      baseRevision: secondSnapshot.revision,
      type: 'AddNode',
      data: {chapterId: otherScope.chapterId, nodeType: 'ui', laneId: 0, label: 'New'},
    });
    expect(first).toHaveBeenCalledTimes(firstCount);
    expect(second.mock.calls.length).toBeGreaterThan(secondCount);
    expect(second.mock.calls.at(-1)?.[0].nodes).toHaveLength(2);

    const secondAfterCommand = second.mock.calls.length;
    const firstSnapshot = await port.getSnapshot(scope);
    expect(second).toHaveBeenCalledTimes(secondAfterCommand);
    expect(first.mock.calls.length).toBeGreaterThan(firstCount);
    const firstAfterRead = first.mock.calls.length;
    await port.execute({
      scope,
      baseRevision: firstSnapshot.revision,
      type: 'AddNode',
      data: {chapterId: scope.chapterId, nodeType: 'ui', laneId: 0, label: 'New'},
    });
    expect(first.mock.calls.length).toBeGreaterThan(firstAfterRead);
    expect(first.mock.calls.at(-1)?.[0].nodes).toHaveLength(2);
    expect(second).toHaveBeenCalledTimes(secondAfterCommand);

    firstSubscription.unsubscribe();
    const firstAfterUnsubscribe = first.mock.calls.length;
    const secondAgain = await port.getSnapshot(otherScope);
    await port.execute({
      scope: otherScope,
      baseRevision: secondAgain.revision,
      type: 'AddNode',
      data: {chapterId: otherScope.chapterId, nodeType: 'ui', laneId: 0, label: 'New'},
    });
    expect(first).toHaveBeenCalledTimes(firstAfterUnsubscribe);
    expect(second.mock.calls.length).toBeGreaterThan(secondAfterCommand);
    secondSubscription.unsubscribe();
    const secondAfterUnsubscribe = second.mock.calls.length;
    const firstAgain = await port.getSnapshot(scope);
    await port.execute({
      scope,
      baseRevision: firstAgain.revision,
      type: 'AddNode',
      data: {chapterId: scope.chapterId, nodeType: 'ui', laneId: 0, label: 'New'},
    });
    expect(first).toHaveBeenCalledTimes(firstAfterUnsubscribe);
    expect(second).toHaveBeenCalledTimes(secondAfterUnsubscribe);
    expect(
      first.mock.calls.every(([snapshot]) => snapshot.scope.projectId === scope.projectId && snapshot.scope.chapterId === scope.chapterId),
    ).toBe(true);
    expect(
      second.mock.calls.every(
        ([snapshot]) => snapshot.scope.projectId === otherScope.projectId && snapshot.scope.chapterId === otherScope.chapterId,
      ),
    ).toBe(true);
  });

  it('does not allow two concurrent actions to reuse the same observed basis', async () => {
    const app = await createGraphApplication();
    const port = createStandaloneProductionEditorPort(app);
    const initial = await port.getSnapshot(app.graph.getScope());
    const command = {
      scope: initial.scope,
      baseRevision: initial.revision,
      type: 'AddNode',
      data: {chapterId: initial.scope.chapterId, nodeType: 'ui', laneId: 0, label: 'New'},
    } as const;
    const results = await Promise.allSettled([port.execute(command), port.execute(command)]);
    expect(results.map(({status}) => status)).toEqual(['fulfilled', 'rejected']);
    expect((await port.getSnapshot(initial.scope)).nodes).toHaveLength(1);
  });

  it('preserves both legacy standalone property events for one port command', async () => {
    const stores = await createDefaultGraphEventStore();
    await stores.graphStore.restoreBackup([
      Events.projectAdded('p1', 'Existing'),
      Events.chapterAdded('p1', 'c1', 'First'),
      Events.nodeAdded('p1', 'c1', 'node-1', 'evt', 0, 'Before'),
    ]);
    const app = await createGraphApplication(scope);
    const port = createStandaloneProductionEditorPort(app);
    const initial = await port.getSnapshot(scope);
    const schema = [{propertyId: 'prop-1', name: 'Name', type: 'string' as const}];
    const exampleValues = [{propertyId: 'prop-1', value: 'Ada'}];
    await port.execute({
      scope,
      baseRevision: initial.revision,
      type: 'ChangeNodeProperties',
      data: {nodeId: 'node-1', schema, exampleValues},
    });
    const events = (await stores.commandStore.read()).map(({event}) => event);
    expect(events.filter(({type}) => type === 'NodeSchemaChanged')).toHaveLength(1);
    expect(events.filter(({type}) => type === 'NodeExampleValuesChanged')).toHaveLength(1);
    expect((await port.getSnapshot(scope)).nodeSchemas['node-1']).toEqual(schema);
  });

  it('retains event/store command behavior for explicit mutations', async () => {
    const stores = await createDefaultGraphEventStore();
    await stores.graphStore.restoreBackup([
      Events.projectAdded('p1', 'Existing'),
      Events.chapterAdded('p1', 'c1', 'First'),
      Events.nodeAdded('p1', 'c1', 'node-1', 'evt', 0, 'Before'),
    ]);
    const app = await createGraphApplication(scope);
    const port = createStandaloneProductionEditorPort(app);
    const initial = await port.getSnapshot(scope);
    const result = await port.execute({scope, baseRevision: initial.revision, type: 'RenameNode', data: {nodeId: 'node-1', name: 'After'}});
    expect(result.createdIds).toEqual([]);
    expect((await port.getSnapshot(scope)).nodes[0]?.label).toBe('After');
    expect((await stores.commandStore.read()).some(({event}) => event.type === 'NodeRenamed')).toBe(true);
  });
});

describe('project production editor port', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  it('pairs model/projection revisions and maps normalized graph and properties', async () => {
    const model = {revision: 'r1'};
    const projection = {
      revision: 'r1',
      projectId: 'p1',
      chapterId: 'c1',
      nodes: [{id: 'n1', label: 'One', type: 'evt', laneId: 0}],
      edges: [],
      nodeSchemas: {n1: []},
      nodeExampleValues: {n1: []},
    };
    fetchMock.mockImplementation(
      async (url: string) => new Response(JSON.stringify(String(url).includes('/api/model') ? model : projection)),
    );
    const snapshot = await createProjectProductionEditorPort().getSnapshot(scope);
    expect(snapshot.scope).toEqual(scope);
    expect(snapshot.revision).toBe('r1');
    expect(snapshot.nodes[0]).toMatchObject({id: 'n1', label: 'One'});
    expect(snapshot.nodeSchemas).toEqual({n1: []});
  });
  it('translates typed graph identifiers without changing the observed revision or receipt', async () => {
    const port = createProjectProductionEditorPort();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({revision: 'r2', generatedIds: ['node-exact', 'edge-exact']})));

    const created = await port.execute({
      scope,
      baseRevision: 'r1',
      type: 'AddConnectedNode',
      data: {chapterId: 'c1', sourceNodeId: 'n1', nodeType: 'evt', laneId: -1, direction: 'top', label: 'New'},
    });
    expect(created).toEqual({revision: 'r2', createdIds: ['node-exact', 'edge-exact']});
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      projectId: 'p1',
      baseRevision: 'r1',
      type: 'AddConnectedNode',
      data: {chapterId: 'c1', sourceNodeId: 'n1', nodeType: 'evt', direction: 'top', label: 'New'},
    });
    await port.execute({
      scope,
      baseRevision: 'r2',
      type: 'DisconnectNodes',
      data: {edgeId: 'edge-n1-n2', sourceNodeId: 'n1', targetNodeId: 'n2'},
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).data).toEqual({sourceNodeId: 'n1', targetNodeId: 'n2'});
  });

  it('preserves typed stale conflicts and exact server-generated identities', async () => {
    const port = createProjectProductionEditorPort();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({error: 'stale', code: 'BASE_REVISION_MISMATCH'}), {status: 409}));
    await expect(port.execute({scope, baseRevision: 'old', type: 'RenameNode', data: {nodeId: 'n1', name: 'After'}})).rejects.toMatchObject(
      {
        code: 'BASE_REVISION_MISMATCH',
        status: 409,
      } satisfies Partial<ProjectCommandError>,
    );
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({revision: 'r2', generatedIds: ['new-node']})));
    await expect(
      port.execute({
        scope,
        baseRevision: 'r1',
        type: 'AddNode',
        data: {chapterId: scope.chapterId, nodeType: 'ui', laneId: 0, label: 'New'},
      }),
    ).resolves.toEqual({
      revision: 'r2',
      createdIds: ['new-node'],
    });
  });
});
