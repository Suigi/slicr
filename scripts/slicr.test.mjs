import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {promises as fs} from 'node:fs';

const cli = new URL('./slicr.mjs', import.meta.url);
function fixture(extraEvents = []) {
  const events = [
    {type: 'ProjectAdded', payload: {projectId: 'p1', name: 'Example'}, tags: ['projectId:p1']},
    {type: 'ChapterAdded', payload: {projectId: 'p1', chapterId: 'c1', title: 'Start'}, tags: ['projectId:p1', 'chapterId:c1']},
    {type: 'ChapterAdded', payload: {projectId: 'p1', chapterId: 'c2', title: 'Next'}, tags: ['projectId:p1', 'chapterId:c2']},
    {
      type: 'NodeAdded',
      payload: {projectId: 'p1', chapterId: 'c1', nodeId: 'n1', type: 'evt', laneId: 0, label: 'Created'},
      tags: ['projectId:p1', 'chapterId:c1', 'nodeId:n1'],
    },
    {
      type: 'NodeAdded',
      payload: {projectId: 'p1', chapterId: 'c2', nodeId: 'n2', type: 'cmd', laneId: 1, label: 'Handled'},
      tags: ['projectId:p1', 'chapterId:c2', 'nodeId:n2'],
    },
    {type: 'NodeSchemaChanged', payload: {projectId: 'p1', nodeId: 'n1', schema: {type: 'object'}}, tags: ['projectId:p1', 'nodeId:n1']},
    {
      type: 'NodeExampleValuesChanged',
      payload: {projectId: 'p1', nodeId: 'n1', exampleValues: [{id: 'x'}]},
      tags: ['projectId:p1', 'nodeId:n1'],
    },
    {
      type: 'NodesConnected',
      payload: {projectId: 'p1', sourceNodeId: 'n1', targetNodeId: 'n2', role: 'flow'},
      tags: ['projectId:p1', 'nodeId:n1', 'nodeId:n2'],
    },
    ...extraEvents,
  ];
  const dir = mkdtempSync(join(tmpdir(), 'slicr-cli-'));
  mkdirSync(join(dir, '.slicr'));
  function appendBatch(id, start, values) {
    const body = {v: 1, id, start, events: values.map((event, index) => ({id: `${id}:${index}`, event}))};
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
  return spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--experimental-loader',
      new URL('./ts-resolve-hook.mjs', import.meta.url).pathname,
      cli.pathname,
      ...args,
    ],
    {cwd, encoding: 'utf8'},
  );
}
test('lists, scopes, projects and renders markdown', () => {
  const {dir} = fixture();
  try {
    const projects = run(dir, 'projects');
    assert.equal(projects.status, 0, projects.stderr);
    assert.equal(JSON.parse(projects.stdout).projects[0].id, 'p1');
    const chapters = run(dir, 'chapters', 'p1');
    assert.deepEqual(
      JSON.parse(chapters.stdout).chapters.map((c) => c.id),
      ['c1', 'c2'],
    );
    const shown = run(dir, 'show', 'p1', 'c1');
    const value = JSON.parse(shown.stdout);
    assert.deepEqual(
      value.nodes.map((n) => n.id),
      ['n1'],
    );
    assert.deepEqual(value.nodeSchemas.n1, {type: 'object'});
    assert.deepEqual(value.nodeExampleValues.n1, [{id: 'x'}]);
    assert.deepEqual(value.edges, []);
    const markdown = run(dir, 'show', 'p1', '--format', 'md');
    assert.equal(markdown.status, 0, markdown.stderr);
    assert.match(markdown.stdout, /Created/);
    assert.match(markdown.stdout, /Schema: \{"type":"object"\}/);
    assert.match(markdown.stdout, /Example values: \[\{"id":"x"\}\]/);
    assert.notEqual(run(dir, 'show', 'p1', '--format', 'json', 'c1').status, 0);
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
    const result = run(disconnected.dir, 'show', 'p1');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).edges, []);
  } finally {
    rmSync(disconnected.dir, {recursive: true, force: true});
  }
  const self = fixture([
    {
      type: 'NodesConnected',
      payload: {projectId: 'p1', sourceNodeId: 'n1', targetNodeId: 'n1', role: 'loop'},
      tags: ['projectId:p1', 'nodeId:n1'],
    },
  ]);
  try {
    const result = run(self.dir, 'show', 'p1');
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
    {type: 'NodesConnected', payload: {projectId: 'p2', sourceNodeId: 'n1', targetNodeId: 'n2', role: 'other flow'}, tags: []},
  ]);
  try {
    value.appendBatch('isolated-updates', 14, [
      {type: 'NodeRenamed', payload: {projectId: 'p1', nodeId: 'n1', newName: 'Renamed'}, tags: []},
      {type: 'NodesDisconnected', payload: {projectId: 'p1', sourceNodeId: 'n1', targetNodeId: 'n2'}, tags: []},
    ]);
    let p2 = JSON.parse(run(value.dir, 'show', 'p2').stdout);
    assert.equal(p2.nodes.find((n) => n.id === 'n1').label, 'Other Created');
    assert.equal(p2.edges.length, 1);
    value.appendBatch('isolated-removal', 16, [{type: 'NodeRemoved', payload: {projectId: 'p1', nodeId: 'n1'}, tags: []}]);
    p2 = JSON.parse(run(value.dir, 'show', 'p2').stdout);
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
    const first = JSON.parse(run(value.dir, 'show', 'a:b').stdout);
    const second = JSON.parse(run(value.dir, 'show', 'a').stdout);
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
    const rename = run(unknown.dir, 'rename-project', 'p1', 'Should Not Append');
    assert.notEqual(rename.status, 0);
    assert.match(rename.stderr, /Incompatible event type/);
    assert.equal(readFileSync(file, 'utf8'), before);
  } finally {
    rmSync(unknown.dir, {recursive: true, force: true});
  }
});
test('installed bin invocation renames a project without caller-supplied Node loader flags', () => {
  const {dir} = fixture();
  try {
    const result = spawnSync(cli.pathname, ['--path', dir, 'rename-project', 'p1', 'Bin Rename'], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).name, 'Bin Rename');
    const noPath = spawnSync(cli.pathname, ['rename-project', 'p1', 'No Path'], {encoding: 'utf8', cwd: dir});
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
    const missing = run(dir, 'rename-project', 'missing', 'Nope');
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /not found/);
    assert.equal(readFileSync(file, 'utf8'), before);
    const renamed = run(dir, 'rename-project', 'p1', 'Renamed');
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
    const child = spawn(
      process.execPath,
      [
        '--experimental-strip-types',
        '--experimental-loader',
        new URL('./ts-resolve-hook.mjs', import.meta.url).pathname,
        worker,
        dir,
        barrier,
        id,
      ],
      {encoding: 'utf8'},
    );
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
