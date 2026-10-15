#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFileSync, mkdirSync, openSync, closeSync, fsyncSync, existsSync, unlinkSync, rmdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

function fail(message) {
  console.error(`slicr: ${message}`);
  process.exitCode = 1;
}

function projectLegacyTags(event) {
  const payload = event.payload;
  if (!payload) return event;
  const fieldsByType = {
    ProjectAdded: ['projectId'],
    ProjectRenamed: ['projectId'],
    ChapterAdded: ['projectId', 'chapterId'],
    ChapterRenamed: ['projectId', 'chapterId'],
    NodeAdded: ['projectId', 'chapterId', 'nodeId'],
    NodeChapterChanged: ['projectId', 'chapterId', 'nodeId'],
    NodeRenamed: ['projectId', 'nodeId'],
    NodeRemoved: ['projectId', 'nodeId'],
    NodeTypeChanged: ['projectId', 'nodeId'],
    NodeSchemaChanged: ['projectId', 'nodeId'],
    NodeExampleValuesChanged: ['projectId', 'nodeId'],
    NodesConnected: ['projectId', 'sourceNodeId', 'targetNodeId'],
    NodesDisconnected: ['projectId', 'sourceNodeId', 'targetNodeId'],
  };
  const inferred = [];
  for (const field of fieldsByType[event.type] ?? []) {
    const value = payload[field];
    if (typeof value === 'string' && value.length) {
      inferred.push(field === 'sourceNodeId' || field === 'targetNodeId' ? `nodeId:${value}` : `${field}:${value}`);
    }
  }
  if (
    (event.type === 'NodesConnected' || event.type === 'NodesDisconnected') &&
    typeof payload.sourceNodeId === 'string' &&
    typeof payload.targetNodeId === 'string'
  ) {
    inferred.push(`connection:${payload.sourceNodeId}->${payload.targetNodeId}`);
  }
  const tags = inferred.filter((tag) => !event.tags.includes(tag));
  return tags.length ? {...event, tags: [...event.tags, ...tags]} : event;
}

function load(root) {
  const file = join(root, '.slicr', 'events.ndjson');
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`No Slicr model at ${file}. Initialize a model explicitly before inspecting it.`);
    throw error;
  }
  const batches = [];
  let position = 1;
  const ids = new Set();
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  for (const [index, line] of lines.entries()) {
    let batch;
    try {
      batch = JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSON in event history at line ${index + 1}.`);
    }
    const {v, id, start, events, sha256} = batch;
    const digest = createHash('sha256').update(JSON.stringify({v, id, start, events})).digest('hex');
    if (
      v !== 1 ||
      typeof id !== 'string' ||
      !id ||
      ids.has(id) ||
      start !== position ||
      !Array.isArray(events) ||
      !events.length ||
      sha256 !== digest ||
      !events.every((e, i) => e.id === `${id}:${i}` && e.event && typeof e.event.type === 'string' && Array.isArray(e.event.tags))
    )
      throw new Error(`Incompatible or corrupt Slicr event history (line ${index + 1}, expected format v1).`);
    batch.events = events.map((entry) => ({...entry, event: projectLegacyTags(entry.event)}));
    batches.push(batch);
    ids.add(id);
    position += events.length;
  }
  return {events: batches.flatMap((b) => b.events.map((e) => e.event)), revision: createHash('sha256').update(text).digest('hex')};
}

function validateEventTypes(events) {
  const supported = new Set([
    'ProjectAdded',
    'ProjectRenamed',
    'ChapterAdded',
    'ChapterRenamed',
    'NodeAdded',
    'NodeChapterChanged',
    'NodeRenamed',
    'NodeRemoved',
    'NodeTypeChanged',
    'NodeSchemaChanged',
    'NodeExampleValuesChanged',
    'NodesConnected',
    'NodesDisconnected',
  ]);
  for (const event of events) if (!supported.has(event.type)) throw new Error(`Incompatible event type for Slicr model: ${event.type}`);
}

async function main(args) {
  let root = process.cwd();
  const pathIndex = args.indexOf('--path');
  if (pathIndex >= 0) {
    if (!args[pathIndex + 1]) throw new Error('--path requires a project directory');
    root = resolve(args[pathIndex + 1]);
    args.splice(pathIndex, 2);
  }
  const [command, ...rest] = args;
  if (command === '--help' || !command) {
    console.log(
      'Usage: slicr [--path PROJECT_DIR] init | projects | chapters PROJECT_ID | show PROJECT_ID [CHAPTER_ID] [--format json|md] | rename-project PROJECT_ID NAME | add-project NAME | add-chapter PROJECT_ID TITLE | add-node PROJECT_ID CHAPTER_ID TYPE LANE LABEL | rename-node PROJECT_ID NODE_ID NAME | connect-nodes PROJECT_ID SOURCE_ID TARGET_ID [ROLE]',
    );
    console.log(
      'CLI edits use the project .slicr/ history. The existing browser editor uses a separate IndexedDB store; the stores are not synchronized.',
    );
    return;
  }
  if (command === 'init') {
    if (rest.length) throw new Error('Usage: init');
    const directory = join(root, '.slicr');
    if (existsSync(directory)) throw new Error(`Refusing to initialize: ${directory} already exists.`);
    mkdirSync(directory);
    const file = join(directory, 'events.ndjson');
    let fd;
    let createdFile = false;
    try {
      fd = openSync(file, 'wx');
      createdFile = true;
      fsyncSync(fd);
      closeSync(fd);
      fd = undefined;
    } catch (error) {
      if (fd !== undefined) {
        try {
          closeSync(fd);
        } catch {
          // Cleanup must continue even when the descriptor close also fails.
        }
      }
      if (createdFile) unlinkSync(file);
      rmdirSync(directory);
      throw new Error(`Refusing to initialize: ${file} already exists or cannot be created (${error.message})`);
    }
    console.log(JSON.stringify({initialized: true, path: file, revision: createHash('sha256').update('').digest('hex')}));
    return;
  }
  if (command === 'rename-project') {
    const [projectId, name, ...extra] = rest;
    if (!projectId?.trim() || !name?.trim() || extra.length) throw new Error('Usage: rename-project PROJECT_ID NEW_NAME');
    return await runCommand(root, 'renameProject', {type: 'RenameProject', data: {projectId, name}}, {projectId, name});
  }
  const mutation = parseMutation(command, rest);
  if (mutation) return await runCommand(root, mutation.decider, mutation.command, mutation.result);
  const {events, revision} = load(root);
  validateEventTypes(events);
  const [{projectWorkspace}, {projectGraph}] = await Promise.all([
    import('../../packages/slicr-core/src/workspaceProjector.ts'),
    import('../../packages/slicr-core/src/graphProjector/graphProjector.ts'),
  ]);
  const workspace = projectWorkspace(events);
  const graphs = new Map(workspace.projects.map((item) => [item.id, projectGraph(events, item.id)]));
  const model = {
    projects: workspace.projects,
    chapters: new Map(
      Object.entries(workspace.chaptersByProjectId).map(([id, chapters]) => [
        id,
        new Map(chapters.map((chapter) => [chapter.id, chapter])),
      ]),
    ),
    nodes: workspace.projects.flatMap((item) =>
      (workspace.chaptersByProjectId[item.id] ?? []).flatMap((chapter) => {
        const graph = projectGraph(events, item.id, chapter.id);
        return graph.nodes.map((node) => ({
          id: node.nodeId,
          projectId: item.id,
          type: node.nodeType,
          laneId: node.laneId,
          label: node.label,
          chapterId: chapter.id,
          schema: graph.nodeSchemas[node.nodeId],
          exampleValues: graph.nodeExampleValues[node.nodeId],
        }));
      }),
    ),
    edges: [...graphs].flatMap(([projectId, graph]) => graph.edges.map((edge) => ({...edge, projectId}))),
  };
  if (command === 'projects') {
    console.log(JSON.stringify({version: 1, revision, projects: model.projects}, null, 2));
    return;
  }
  if (command === 'chapters') {
    const id = rest[0];
    if (!model.projects.some((p) => p.id === id)) throw new Error(`Unknown project ID: ${id ?? '(missing)'}`);
    console.log(JSON.stringify({version: 1, revision, projectId: id, chapters: [...(model.chapters.get(id)?.values() ?? [])]}, null, 2));
    return;
  }
  if (command === 'show') {
    const formatIndex = rest.indexOf('--format');
    if (
      formatIndex >= 0 &&
      ((formatIndex !== 1 && formatIndex !== 2) || rest.indexOf('--format', formatIndex + 1) >= 0 || rest.length !== formatIndex + 2)
    )
      throw new Error('Usage: show PROJECT_ID [CHAPTER_ID] [--format json|md]');
    const positional = formatIndex < 0 ? rest : rest.slice(0, formatIndex);
    if (positional.length < 1 || positional.length > 2) throw new Error('Usage: show PROJECT_ID [CHAPTER_ID] [--format json|md]');
    const [projectId, chapterId] = positional;
    if (!model.projects.some((p) => p.id === projectId)) throw new Error(`Unknown project ID: ${projectId ?? '(missing)'}`);
    const slice = {
      version: 1,
      revision,
      projectId,
      chapterId: chapterId ?? null,
      nodes: model.nodes.filter((n) => n.projectId === projectId && (!chapterId || n.chapterId === chapterId)),
      nodeSchemas: Object.fromEntries(
        model.nodes
          .filter((n) => n.projectId === projectId && (!chapterId || n.chapterId === chapterId) && n.schema)
          .map((n) => [n.id, n.schema]),
      ),
      nodeExampleValues: Object.fromEntries(
        model.nodes
          .filter((n) => n.projectId === projectId && (!chapterId || n.chapterId === chapterId) && n.exampleValues)
          .map((n) => [n.id, n.exampleValues]),
      ),
      edges: model.edges.filter(
        (e) =>
          e.sourceNodeId !== e.targetNodeId &&
          e.projectId === projectId &&
          model.nodes.some((n) => n.id === e.sourceNodeId && n.projectId === projectId && (!chapterId || n.chapterId === chapterId)) &&
          model.nodes.some((n) => n.id === e.targetNodeId && n.projectId === projectId && (!chapterId || n.chapterId === chapterId)),
      ),
    };
    if (chapterId && !model.chapters.get(projectId)?.has(chapterId)) throw new Error(`Unknown chapter ID: ${chapterId}`);
    const format = formatIndex >= 0 ? rest[formatIndex + 1] : 'json';
    if (format === 'json') console.log(JSON.stringify(slice, null, 2));
    else if (format === 'md')
      console.log(
        `# ${model.projects.find((p) => p.id === projectId).name}\n\nRevision: \`${revision}\`\n\n${chapterId ? `Chapter: \`${chapterId}\`\n\n` : ''}## Nodes\n${slice.nodes.map((n) => `- **${n.label}** (\`${n.id}\`, ${n.type})${n.schema ? `\n  - Schema: ${JSON.stringify(n.schema)}` : ''}${n.exampleValues ? `\n  - Example values: ${JSON.stringify(n.exampleValues)}` : ''}`).join('\n') || '_None_'}\n\n## Connections\n${slice.edges.map((e) => `- \`${e.sourceNodeId}\` → \`${e.targetNodeId}\` (${e.role})`).join('\n') || '_None_'}`,
      );
    else throw new Error('Format must be json or md');
    return;
  }
  throw new Error(`Unknown command: ${command}. Run slicr --help.`);
}

function parseMutation(command, args) {
  const [a, b, c, d, e, f, extra] = args;
  switch (command) {
    case 'add-project':
      if (args.length !== 1 || !a.trim()) throw new Error('Usage: add-project NAME');
      return {decider: 'addProject', command: {type: 'AddProject', data: {name: a}}, result: {}};
    case 'add-chapter':
      if (args.length !== 2 || !a.trim() || !b.trim()) throw new Error('Usage: add-chapter PROJECT_ID TITLE');
      return {decider: 'addChapter', command: {type: 'AddChapter', data: {projectId: a, title: b}}, result: {projectId: a}};
    case 'add-node':
      if (
        args.length !== 5 ||
        !a.trim() ||
        !b.trim() ||
        !['ui', 'cmd', 'evt', 'rm', 'dm', 'processor'].includes(c) ||
        !/^(0|[1-9]\d*)$/.test(d) ||
        !Number.isSafeInteger(Number(d)) ||
        !e.trim()
      )
        throw new Error('Usage: add-node PROJECT_ID CHAPTER_ID TYPE LANE LABEL');
      return {
        decider: 'addNode',
        command: {type: 'AddNode', data: {projectId: a, chapterId: b, nodeType: c, laneId: Number(d), label: e}},
        result: {projectId: a},
      };
    case 'rename-node':
      if (args.length !== 3 || !a.trim() || !b.trim() || !c.trim()) throw new Error('Usage: rename-node PROJECT_ID NODE_ID NAME');
      return {
        decider: 'renameNode',
        command: {type: 'RenameNode', data: {projectId: a, nodeId: b, newName: c}},
        result: {projectId: a, nodeId: b, name: c},
      };
    case 'connect-nodes':
      if (
        args.length < 3 ||
        args.length > 4 ||
        !a?.trim() ||
        !b?.trim() ||
        !c?.trim() ||
        extra ||
        (d !== undefined && !['flow', 'back-reference'].includes(d))
      )
        throw new Error('Usage: connect-nodes PROJECT_ID SOURCE_ID TARGET_ID [ROLE]');
      return {
        decider: 'connectNodes',
        command: {type: 'ConnectNodes', data: {projectId: a, sourceNodeId: b, targetNodeId: c, ...(d ? {role: d} : {})}},
        result: {projectId: a, sourceNodeId: b, targetNodeId: c},
      };
    default:
      return null;
  }
}

async function runCommand(root, deciderName, command, result) {
  const {events} = load(root);
  validateEventTypes(events);
  const [{NdjsonSpecEventStore}, graphModule, projectModule, {handleCommand}] = await Promise.all([
    import('../../packages/event-sourcing/src/ndjsonSpecEventStore.ts'),
    import('../../packages/slicr-core/src/graphCommands/deciders.ts'),
    import('../../packages/slicr-core/src/projectCommands/projectCommandHandler.ts'),
    import('../../packages/slicr-core/src/eventSourcing.ts'),
  ]);
  const store = NdjsonSpecEventStore.open(root);
  try {
    const decider = graphModule.deciders()[deciderName] ?? projectModule.deciders()[deciderName];
    const appended = await handleCommand(store, decider, command);
    const revision = createHash('sha256')
      .update(readFileSync(join(root, '.slicr', 'events.ndjson')))
      .digest('hex');
    const generatedFields =
      {
        addProject: {ProjectAdded: 'projectId', ChapterAdded: 'chapterId'},
        addChapter: {ChapterAdded: 'chapterId'},
        addNode: {NodeAdded: 'nodeId'},
      }[deciderName] ?? {};
    const generatedIds = appended.flatMap((item) => {
      const event = item.event;
      const field = generatedFields[event?.type];
      const value = field && event.payload?.[field];
      return typeof value === 'string' ? [value] : [];
    });
    console.log(JSON.stringify({...result, ...(generatedIds.length ? {generatedIds} : {}), revision, appended: appended.length}));
  } finally {
    store.close();
  }
}

try {
  const args = process.argv.slice(2);
  const commandIndex = args[0] === '--path' ? 2 : 0;
  if (process.env.SLICR_TYPESCRIPT_RUNTIME !== '1') {
    const result = spawnSync(
      process.execPath,
      [
        '--experimental-transform-types',
        '--experimental-loader',
        new URL('./ts-resolve-hook.mjs', import.meta.url).pathname,
        fileURLToPath(import.meta.url),
        ...args,
      ],
      {
        stdio: 'inherit',
        env: {...process.env, SLICR_TYPESCRIPT_RUNTIME: '1'},
      },
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } else await main(args);
} catch (error) {
  fail(error.message);
}
