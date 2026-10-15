import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, relative} from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {promises as fs} from 'node:fs';
import {Events} from '../../packages/slicr-core/src/events.ts';

const cli = new URL('./slicr.mjs', import.meta.url);
const packageBin = new URL('../../node_modules/.bin/slicr', import.meta.url).pathname;
const repositoryRoot = new URL('../../', import.meta.url).pathname;
function withConstructorTags(event) {
  const p = event.payload;
  const constructors = {
    ProjectAdded: () => Events.projectAdded(p.projectId, p.name),
    ProjectRenamed: () => Events.projectRenamed(p.projectId, p.newName),
    ChapterAdded: () => Events.chapterAdded(p.projectId, p.chapterId, p.title),
    ChapterRenamed: () => Events.chapterRenamed(p.projectId, p.chapterId, p.newTitle),
    NodeAdded: () => Events.nodeAdded(p.projectId, p.chapterId, p.nodeId, p.type, p.laneId, p.label),
    NodeRenamed: () => Events.nodeRenamed(p.projectId, p.nodeId, p.newName),
    NodeRemoved: () => Events.nodeRemoved(p.projectId, p.nodeId),
    NodeSchemaChanged: () => Events.nodeSchemaChanged(p.projectId, p.nodeId, p.schema),
    NodeExampleValuesChanged: () => Events.nodeExampleValuesChanged(p.projectId, p.nodeId, p.exampleValues),
    NodesConnected: () => Events.nodesConnected(p.projectId, p.sourceNodeId, p.targetNodeId, p.role),
    NodesDisconnected: () => Events.nodesDisconnected(p.projectId, p.sourceNodeId, p.targetNodeId),
  };
  return constructors[event.type]?.() ?? event;
}
function fixture(extraEvents = []) {
  const events = [
    Events.projectAdded('p1', 'Example'),
    Events.chapterAdded('p1', 'c1', 'Start'),
    Events.chapterAdded('p1', 'c2', 'Next'),
    Events.nodeAdded('p1', 'c1', 'n1', 'evt', 0, 'Created'),
    Events.nodeAdded('p1', 'c2', 'n2', 'cmd', 1, 'Handled'),
    Events.nodeSchemaChanged('p1', 'n1', [{propertyId: 'name', name: 'Name', type: 'string'}]),
    Events.nodeExampleValuesChanged('p1', 'n1', [{propertyId: 'name', scalarValue: 'x'}]),
    Events.nodesConnected('p1', 'n1', 'n2'),
    ...extraEvents.map(withConstructorTags),
  ];
  const dir = mkdtempSync(join(tmpdir(), 'slicr-cli-'));
  mkdirSync(join(dir, '.slicr'));
  function appendBatch(id, start, values) {
    const body = {
      v: 1,
      id,
      start,
      events: values.map((event, index) => ({id: `${id}:${index}`, event: withConstructorTags(event)})),
    };
    body.sha256 = createHash('sha256')
      .update(JSON.stringify({v: body.v, id: body.id, start: body.start, events: body.events}))
      .digest('hex');
    const file = join(dir, '.slicr', 'events.ndjson');
    writeFileSync(file, `${existsSync(file) ? readFileSync(file, 'utf8') : ''}${JSON.stringify(body)}\n`);
  }
  appendBatch('batch', 1, events);
  return {dir, appendBatch};
}
function run(cwd, ...args) {
  return spawnSync(process.execPath, ['--import', new URL('./ts-register.mjs', import.meta.url).href, cli.pathname, ...args], {
    cwd,
    encoding: 'utf8',
    env: {...process.env, INIT_CWD: cwd},
  });
}
function projectRun(cwd, projectId, ...args) {
  return run(cwd, '--project', projectId, ...args);
}
test('lists, scopes, projects and renders markdown', () => {
  const {dir} = fixture();
  try {
    const projects = run(dir, 'projects');
    assert.equal(projects.status, 0, projects.stderr);
    assert.equal(JSON.parse(projects.stdout).projects[0].id, 'p1');
    const chapters = projectRun(dir, 'p1', 'chapters');
    assert.deepEqual(
      JSON.parse(chapters.stdout).chapters.map((c) => c.id),
      ['c1', 'c2'],
    );
    const shown = projectRun(dir, 'p1', 'show', 'c1');
    const value = JSON.parse(shown.stdout);
    assert.deepEqual(
      value.nodes.map((n) => n.id),
      ['n1'],
    );
    assert.deepEqual(value.nodeSchemas.n1, [{propertyId: 'name', name: 'Name', type: 'string'}]);
    assert.deepEqual(value.nodeExampleValues.n1, [{propertyId: 'name', scalarValue: 'x'}]);
    assert.deepEqual(value.edges, []);
    const markdown = projectRun(dir, 'p1', 'show', '--format', 'md');
    assert.equal(markdown.status, 0, markdown.stderr);
    assert.match(markdown.stdout, /Created/);
    assert.match(markdown.stdout, /Schema: \[\{"propertyId":"name","name":"Name","type":"string"\}\]/);
    assert.match(markdown.stdout, /Example values: \[\{"propertyId":"name","scalarValue":"x"\}\]/);
    assert.notEqual(projectRun(dir, 'p1', 'show', 'c1', '--format', 'txt').status, 0);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
test('disconnect removes edge and self-connections are excluded', () => {
  const disconnected = fixture();
  disconnected.appendBatch('disconnect', 9, [
    {type: 'NodesDisconnected', payload: {projectId: 'p1', sourceNodeId: 'n1', targetNodeId: 'n2'}, tags: []},
  ]);
  try {
    const result = projectRun(disconnected.dir, 'p1', 'show');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).edges, []);
  } finally {
    rmSync(disconnected.dir, {recursive: true, force: true});
  }
  const self = fixture([
    {
      type: 'NodesConnected',
      payload: {projectId: 'p1', sourceNodeId: 'n1', targetNodeId: 'n1', role: 'flow'},
      tags: ['projectId:p1', 'nodeId:n1'],
    },
  ]);
  try {
    const result = projectRun(self.dir, 'p1', 'show');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).edges, [{projectId: 'p1', sourceNodeId: 'n1', targetNodeId: 'n2', role: 'flow'}]);
  } finally {
    rmSync(self.dir, {recursive: true, force: true});
  }
});
test('same node and edge IDs remain isolated across projects during updates and removals', () => {
  const value = fixture([
    {type: 'ProjectAdded', payload: {projectId: 'p2', name: 'Other'}, tags: []},
    {type: 'ChapterAdded', payload: {projectId: 'p2', chapterId: 'c1', title: 'Other'}, tags: []},
    {
      type: 'NodeAdded',
      payload: {projectId: 'p2', chapterId: 'c1', nodeId: 'n1', type: 'evt', laneId: 0, label: 'Other Created'},
      tags: [],
    },
    {
      type: 'NodeAdded',
      payload: {projectId: 'p2', chapterId: 'c1', nodeId: 'n2', type: 'cmd', laneId: 1, label: 'Other Handled'},
      tags: [],
    },
    {type: 'NodesConnected', payload: {projectId: 'p2', sourceNodeId: 'n1', targetNodeId: 'n2', role: 'back-reference'}, tags: []},
  ]);
  try {
    value.appendBatch('isolated-updates', 14, [
      {type: 'NodeRenamed', payload: {projectId: 'p1', nodeId: 'n1', newName: 'Renamed'}, tags: []},
      {type: 'NodesDisconnected', payload: {projectId: 'p1', sourceNodeId: 'n1', targetNodeId: 'n2'}, tags: []},
    ]);
    let p2 = JSON.parse(projectRun(value.dir, 'p2', 'show').stdout);
    assert.equal(p2.nodes.find((n) => n.id === 'n1').label, 'Other Created');
    assert.equal(p2.edges.length, 1);
    value.appendBatch('isolated-removal', 16, [{type: 'NodeRemoved', payload: {projectId: 'p1', nodeId: 'n1'}, tags: []}]);
    p2 = JSON.parse(projectRun(value.dir, 'p2', 'show').stdout);
    assert.deepEqual(
      p2.nodes.map((n) => n.id),
      ['n1', 'n2'],
    );
    assert.equal(p2.edges.length, 1);
  } finally {
    rmSync(value.dir, {recursive: true, force: true});
  }
});
test('delimiter-containing project and node IDs remain isolated on updates and removals', () => {
  const value = fixture([
    {type: 'ProjectAdded', payload: {projectId: 'a:b', name: 'First'}, tags: []},
    {type: 'ProjectAdded', payload: {projectId: 'a', name: 'Second'}, tags: []},
    {type: 'ChapterAdded', payload: {projectId: 'a:b', chapterId: 'c1', title: 'First'}, tags: []},
    {type: 'ChapterAdded', payload: {projectId: 'a', chapterId: 'c1', title: 'Second'}, tags: []},
    {type: 'NodeAdded', payload: {projectId: 'a:b', chapterId: 'c1', nodeId: 'c', type: 'evt', laneId: 0, label: 'First node'}, tags: []},
    {type: 'NodeAdded', payload: {projectId: 'a', chapterId: 'c1', nodeId: 'b:c', type: 'evt', laneId: 0, label: 'Second node'}, tags: []},
    {type: 'NodeRenamed', payload: {projectId: 'a:b', nodeId: 'c', newName: 'Updated first'}, tags: []},
    {type: 'NodeRemoved', payload: {projectId: 'a', nodeId: 'b:c'}, tags: []},
  ]);
  try {
    const first = JSON.parse(projectRun(value.dir, 'a:b', 'show').stdout);
    const second = JSON.parse(projectRun(value.dir, 'a', 'show').stdout);
    assert.deepEqual(
      first.nodes.map((n) => [n.id, n.label]),
      [['c', 'Updated first']],
    );
    assert.deepEqual(second.nodes, []);
  } finally {
    rmSync(value.dir, {recursive: true, force: true});
  }
});
test('explicit path works and reads do not change history', () => {
  const {dir} = fixture();
  const file = join(dir, '.slicr', 'events.ndjson');
  try {
    const before = readFileSync(file, 'utf8');
    const result = run(tmpdir(), '--path', dir, 'projects');
    assert.equal(result.status, 0, result.stderr);
    const revision = JSON.parse(result.stdout).revision;
    assert.equal(JSON.parse(run(dir, 'projects').stdout).revision, revision);
    assert.equal(readFileSync(file, 'utf8'), before);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
test('revision changes after valid batch and corrupt or unknown histories fail', () => {
  const value = fixture();
  try {
    const first = JSON.parse(run(value.dir, 'projects').stdout).revision;
    value.appendBatch('second', 9, [{type: 'ProjectRenamed', payload: {projectId: 'p1', newName: 'Changed'}, tags: []}]);
    const next = run(value.dir, 'projects');
    assert.equal(next.status, 0, next.stderr);
    assert.notEqual(JSON.parse(next.stdout).revision, first);
  } finally {
    rmSync(value.dir, {recursive: true, force: true});
  }
  for (const contents of ['{broken}\n', `${JSON.stringify({v: 1, id: 'x', start: 1, events: [], sha256: 'bad'})}\n`]) {
    const dir = mkdtempSync(join(tmpdir(), 'slicr-bad-'));
    mkdirSync(join(dir, '.slicr'));
    writeFileSync(join(dir, '.slicr', 'events.ndjson'), contents);
    try {
      assert.notEqual(run(dir, 'projects').status, 0);
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  }
  const unknown = fixture([{type: 'UnknownEvent', payload: {}, tags: []}]);
  try {
    const file = join(unknown.dir, '.slicr', 'events.ndjson');
    const before = readFileSync(file, 'utf8');
    assert.match(run(unknown.dir, 'projects').stderr, /Incompatible event type/);
    const rename = projectRun(unknown.dir, 'p1', 'rename-project', 'Should Not Append');
    assert.notEqual(rename.status, 0);
    assert.match(rename.stderr, /Incompatible event type/);
    assert.equal(readFileSync(file, 'utf8'), before);
  } finally {
    rmSync(unknown.dir, {recursive: true, force: true});
  }
});
test('root script forwards arguments to the workspace CLI', () => {
  const {dir} = fixture();
  try {
    const result = spawnSync('npm', ['run', 'slicr', '--', '--path', dir, 'projects'], {cwd: repositoryRoot, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /"projects": \[\s*\{/);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
test('relative --path is resolved from the npm invocation directory', () => {
  const parent = mkdtempSync(join(tmpdir(), 'slicr-relative-init-'));
  const project = join(parent, '_temp_project');
  mkdirSync(project);
  try {
    const relativeProject = relative(repositoryRoot, project);
    const result = spawnSync('npm', ['run', 'slicr', '--', '--path', relativeProject, 'init'], {cwd: repositoryRoot, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(project, '.slicr', 'events.ndjson')), true);
    const initialized = JSON.parse(result.stdout.trim().split('\n').at(-1));
    assert.equal(initialized.path, join(project, '.slicr', 'events.ndjson'));
    assert.equal(initialized.projectName, 'Default Project');
    assert.equal(initialized.chapterTitle, 'Default Chapter');
  } finally {
    rmSync(parent, {recursive: true, force: true});
  }
});
test('installed bin invocation renames a project without caller-supplied Node loader flags', () => {
  const {dir} = fixture();
  try {
    const result = spawnSync(packageBin, ['--path', dir, '--project', 'p1', 'rename-project', 'Bin Rename'], {
      encoding: 'utf8',
      cwd: tmpdir(),
      env: {...process.env, INIT_CWD: tmpdir()},
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).name, 'Bin Rename');
    const noPath = spawnSync(packageBin, ['--project', 'p1', 'rename-project', 'No Path'], {
      encoding: 'utf8',
      cwd: dir,
      env: {...process.env, INIT_CWD: dir},
    });
    assert.equal(noPath.status, 0, noPath.stderr);
    assert.equal(JSON.parse(noPath.stdout).name, 'No Path');
    assert.equal(JSON.parse(run(dir, 'projects').stdout).projects[0].name, 'No Path');
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
test('rename-project uses the shared decider and persists a readable rename', () => {
  const {dir} = fixture();
  const file = join(dir, '.slicr', 'events.ndjson');
  try {
    const before = readFileSync(file, 'utf8');
    const missing = projectRun(dir, 'missing', 'rename-project', 'Nope');
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /Unknown project ID/);
    assert.equal(readFileSync(file, 'utf8'), before);
    const renamed = projectRun(dir, 'p1', 'rename-project', 'Renamed');
    assert.equal(renamed.status, 0, renamed.stderr);
    assert.equal(JSON.parse(renamed.stdout).appended, 1);
    const readBack = run(dir, 'projects');
    assert.equal(readBack.status, 0, readBack.stderr);
    assert.equal(JSON.parse(readBack.stdout).projects[0].name, 'Renamed');
    assert.equal(JSON.parse(readBack.stdout).revision.length, 64);
    assert.equal(JSON.parse(renamed.stdout).revision, createHash('sha256').update(readFileSync(file)).digest('hex'));
    assert.equal(JSON.parse(readBack.stdout).revision, JSON.parse(renamed.stdout).revision);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
test('independent shared-handler writers conflict after a deterministic read barrier', async () => {
  const {dir} = fixture();
  const barrier = join(dir, 'barrier');
  const worker = new URL('./slicr-race-worker.mjs', import.meta.url).pathname;
  const children = [];
  let workers = [];
  const startWorker = (id) => {
    const child = spawn(process.execPath, ['--import', new URL('./ts-register.mjs', import.meta.url).href, worker, dir, barrier, id], {
      encoding: 'utf8',
    });
    children.push(child);
    let stdout = '';
    let stderr = '';
    let closed = false;
    const completion = new Promise((resolve) =>
      child.once('close', (status) => {
        closed = true;
        resolve({status, stdout, stderr});
      }),
    );
    child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));
    child.completion = completion;
    child.isClosed = () => closed;
    return completion;
  };
  try {
    workers = [startWorker('one'), startWorker('two')];
    const readyFiles = [join(barrier, 'one'), join(barrier, 'two')];
    const deadline = Date.now() + 10_000;
    while (
      !(
        await Promise.all(
          readyFiles.map((file) =>
            fs.access(file).then(
              () => true,
              () => false,
            ),
          ),
        )
      ).every(Boolean)
    ) {
      if (Date.now() >= deadline) throw new Error('Timed out waiting for race workers to reach read barrier');
      if (children.some((child) => child.isClosed())) throw new Error('Race worker exited before reaching read barrier');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await Promise.all(['one', 'two'].map((id) => fs.writeFile(join(barrier, `release-${id}`), 'go')));
    const results = await Promise.race([
      Promise.all(workers),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for race workers to complete')), 10_000)),
    ]);
    assert.equal(results.filter(({status}) => status === 0).length, 1);
    assert.equal(results.filter(({status}) => status === 1).length, 1);
    const decoded = results.map(({stdout}) => JSON.parse(stdout));
    assert.equal(decoded.filter(({result}) => result === 'success').length, 1);
    const conflict = decoded.find(({result}) => result === 'error');
    assert.equal(conflict.name, 'AppendConditionFailedError');
    assert.match(conflict.message, /changed concurrently.*Re-read the model and retry/);
    assert.equal(JSON.parse(run(dir, 'projects').stdout).projects[0].name.startsWith('Renamed-'), true);
  } finally {
    for (const child of children) if (!child.isClosed()) child.kill('SIGKILL');
    await Promise.all(
      children.map(async (child) => {
        if (child.isClosed()) return;
        await Promise.race([
          child.completion,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out awaiting race worker shutdown')), 5_000)),
        ]);
      }),
    );
    await Promise.allSettled(workers);
    rmSync(dir, {recursive: true, force: true});
  }
});
test('init creates a default project and chapter; scoped commands use shared decisions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-mutations-'));
  const file = join(dir, '.slicr', 'events.ndjson');
  const invoke = (...args) => run(dir, ...args);
  try {
    const initialized = invoke('init');
    assert.equal(initialized.status, 0, initialized.stderr);
    const initResult = JSON.parse(initialized.stdout);
    assert.equal(initResult.projectName, 'Default Project');
    assert.equal(initResult.chapterTitle, 'Default Chapter');
    assert.equal(initResult.appended, 2);
    const projectId = initResult.projectId;
    const defaultChapterId = initResult.chapterId;
    const chapters = JSON.parse(invoke('chapters').stdout);
    assert.deepEqual(
      chapters.chapters.map((chapter) => chapter.title),
      ['Default Chapter'],
    );

    const beforeInvalid = readFileSync(file, 'utf8');
    for (const args of [
      ['add-node', 'missing-chapter', 'evt', '0', 'No'],
      ['rename-node', 'missing-node', 'No'],
      ['connect-nodes', 'missing-source', 'missing-target'],
      ['add-node', defaultChapterId, 'bogus', '0', 'No'],
      ['add-node', defaultChapterId, 'evt', '-1', 'No'],
    ]) {
      assert.notEqual(invoke(...args).status, 0, args.join(' '));
      assert.equal(readFileSync(file, 'utf8'), beforeInvalid);
    }

    const namedChapter = invoke('--project', projectId, 'add-chapter', 'Named Chapter');
    assert.equal(namedChapter.status, 0, namedChapter.stderr);
    const chapter = invoke('add-chapter', 'Next');
    assert.equal(chapter.status, 0, chapter.stderr);
    const chapterId = JSON.parse(chapter.stdout).generatedIds[0];
    const node1 = invoke('add-node', defaultChapterId, 'evt', '0', 'Created');
    const node1Id = JSON.parse(node1.stdout).generatedIds[0];
    const node2 = invoke('add-node', chapterId, 'cmd', '1', 'Handled');
    const node2Id = JSON.parse(node2.stdout).generatedIds[0];
    assert.equal(invoke('rename-node', node1Id, 'Created').status, 0);
    assert.equal(JSON.parse(invoke('rename-node', node1Id, 'Created').stdout).appended, 0);
    const rename = invoke('rename-node', node1Id, 'Created successfully');
    assert.equal(JSON.parse(rename.stdout).appended, 1);
    assert.equal(JSON.parse(invoke('connect-nodes', node1Id, node2Id).stdout).appended, 1);
    assert.equal(JSON.parse(invoke('connect-nodes', node1Id, node2Id).stdout).appended, 0);
    assert.equal(JSON.parse(invoke('connect-nodes', node1Id, node1Id).stdout).appended, 0);
    const reopened = JSON.parse(invoke('show').stdout);
    assert.deepEqual(
      reopened.nodes.map(({id, label}) => [id, label]),
      [
        [node1Id, 'Created successfully'],
        [node2Id, 'Handled'],
      ],
    );
    assert.deepEqual(
      reopened.edges.map(({sourceNodeId, targetNodeId, role}) => [sourceNodeId, targetNodeId, role]),
      [[node1Id, node2Id, 'flow']],
    );

    const secondProject = invoke('add-project', 'Second Project');
    assert.equal(secondProject.status, 0, secondProject.stderr);
    const secondProjectId = JSON.parse(secondProject.stdout).generatedIds[0];
    const ambiguous = invoke('show');
    assert.notEqual(ambiguous.status, 0);
    assert.match(ambiguous.stderr, /--project PROJECT_ID is required/);
    assert.equal(invoke('--project', secondProjectId, 'chapters').status, 0);
    assert.equal(invoke('--project', projectId, 'show').status, 0);
    assert.notEqual(invoke('--project', 'missing-project', 'show').status, 0);

    const bytes = readFileSync(file);
    assert.equal(JSON.parse(invoke('projects').stdout).revision, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(JSON.parse(rename.stdout).revision.length, 64);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
test('init seeds an existing empty event log with the default workspace', () => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-init-empty-log-'));
  try {
    mkdirSync(join(dir, '.slicr'));
    writeFileSync(join(dir, '.slicr', 'events.ndjson'), '');
    const initialized = run(dir, 'init');
    assert.equal(initialized.status, 0, initialized.stderr);
    assert.equal(JSON.parse(initialized.stdout).projectName, 'Default Project');
    assert.equal(JSON.parse(initialized.stdout).chapterTitle, 'Default Chapter');
    assert.deepEqual(
      JSON.parse(run(dir, 'projects').stdout).projects.map((project) => project.name),
      ['Default Project'],
    );
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
test('init refuses to overwrite existing data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-init-'));
  try {
    const initialized = run(dir, 'init');
    assert.equal(initialized.status, 0, initialized.stderr);
    const original = readFileSync(join(dir, '.slicr', 'events.ndjson'), 'utf8');
    assert.equal(JSON.parse(run(dir, 'projects').stdout).projects[0].name, 'Default Project');
    const repeated = run(dir, 'init');
    assert.notEqual(repeated.status, 0);
    assert.equal(readFileSync(join(dir, '.slicr', 'events.ndjson'), 'utf8'), original);
    const incompatible = mkdtempSync(join(tmpdir(), 'slicr-init-existing-'));
    mkdirSync(join(incompatible, '.slicr'));
    const incompatibleFile = join(incompatible, '.slicr', 'events.ndjson');
    writeFileSync(incompatibleFile, 'existing bytes\n');
    const refused = run(incompatible, 'init');
    assert.notEqual(refused.status, 0);
    assert.equal(readFileSync(incompatibleFile, 'utf8'), 'existing bytes\n');
    rmSync(incompatible, {recursive: true, force: true});
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
test('missing model fails without creating files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-empty-'));
  try {
    const result = run(tmpdir(), '--path', dir, 'projects');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /No Slicr model/);
    assert.equal(existsSync(join(dir, '.slicr')), false);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
