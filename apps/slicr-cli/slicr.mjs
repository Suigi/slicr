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

function consumeOption(args, option) {
  const indexes = args.flatMap((arg, index) => (arg === option ? [index] : []));
  if (indexes.length > 1) throw new Error(`${option} may be specified only once`);
  if (!indexes.length) return undefined;
  const [index] = indexes;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value`);
  args.splice(index, 2);
  return value;
}

async function resolveProjectId(root, selectedProjectId) {
  const {events} = load(root);
  validateEventTypes(events);
  const {projectWorkspace} = await import('../../packages/slicr-core/src/workspaceProjector.ts');
  const projects = projectWorkspace(events).projects;
  if (selectedProjectId) {
    if (!projects.some((project) => project.id === selectedProjectId)) throw new Error(`Unknown project ID: ${selectedProjectId}`);
    return selectedProjectId;
  }
  if (projects.length === 1) return projects[0].id;
  if (projects.length === 0) throw new Error('The model has no projects. Add a project first.');
  throw new Error(`--project PROJECT_ID is required when the model has multiple projects (${projects.length} found).`);
}

async function initializeWorkspace(root, file) {
  const [{NdjsonSpecEventStore}, {initialWorkspaceDecider}, {handleCommand}] = await Promise.all([
    import('../../packages/event-sourcing/src/ndjsonSpecEventStore.ts'),
    import('../../packages/slicr-core/src/projectCommands/initialWorkspaceProcessor/initialWorkspaceProcessor.ts'),
    import('../../packages/slicr-core/src/eventSourcing.ts'),
  ]);
  const store = NdjsonSpecEventStore.open(root);
  try {
    const appended = await handleCommand(store, initialWorkspaceDecider({defaultChapterTitle: 'Default Chapter'}), {
      type: 'EnsureInitialWorkspace',
      data: {},
    });
    const project = appended.find((item) => item.event.type === 'ProjectAdded');
    const chapter = appended.find((item) => item.event.type === 'ChapterAdded');
    const revision = createHash('sha256').update(readFileSync(file)).digest('hex');
    console.log(
      JSON.stringify({
        initialized: true,
        path: file,
        projectId: project?.event.payload.projectId,
        projectName: project?.event.payload.name,
        chapterId: chapter?.event.payload.chapterId,
        chapterTitle: chapter?.event.payload.title,
        revision,
        appended: appended.length,
      }),
    );
  } finally {
    store.close();
  }
}

async function main(args) {
  const invocationCwd = process.env.INIT_CWD || process.cwd();
  let root = invocationCwd;
  const path = consumeOption(args, '--path');
  if (path) root = resolve(invocationCwd, path);
  const selectedProjectId = consumeOption(args, '--project');
  const [command, ...rest] = args;
  if (command === 'serve') {
    if (selectedProjectId) throw new Error('--project is not used by serve; select a project in the read API when needed');
    const portValue = consumeOption(rest, '--port');
    const port = portValue === undefined ? 4173 : Number(portValue);
    if (!Number.isInteger(port) || port < 0 || port > 65535 || rest.length) throw new Error('Usage: serve [--port PORT]');
    const {startServeServer} = await import('./serve.mjs');
    const assets = fileURLToPath(new URL('../slicr-editor/dist-project/', import.meta.url));
    const serving = startServeServer({root, assets, port});
    const address = await serving.listening;
    console.log(`Slicr project editor listening at http://${address.address}:${address.port} (editing enabled)`);
    const shutdown = () => serving.close().finally(() => process.exit(0));
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    return;
  }
  const scopedCommands = new Set(['chapters', 'show', 'rename-project', 'add-chapter', 'add-node', 'rename-node', 'connect-nodes']);
  if (selectedProjectId && !scopedCommands.has(command)) throw new Error(`--project is not used by ${command ?? 'help'}`);
  const projectId = scopedCommands.has(command) ? await resolveProjectId(root, selectedProjectId) : undefined;
  if (command === '--help' || !command) {
    console.log(
      'Usage: slicr [--path PROJECT_DIR] [--project PROJECT_ID] init | projects | chapters | show [CHAPTER_ID] [--format json|md] | rename-project NAME | add-project NAME | add-chapter TITLE | add-node CHAPTER_ID TYPE LANE LABEL | rename-node NODE_ID NAME | connect-nodes SOURCE_ID TARGET_ID [ROLE] | serve [--port PORT]',
    );
    console.log('When the model has one project, --project is optional; with multiple projects, specify its ID.');
    console.log(
      'CLI edits use the project .slicr/ history. The existing browser editor uses a separate IndexedDB store; the stores are not synchronized.',
    );
    return;
  }
  if (command === 'init') {
    if (rest.length) throw new Error('Usage: init');
    const directory = join(root, '.slicr');
    const file = join(directory, 'events.ndjson');
    if (existsSync(directory)) {
      if (!existsSync(file)) throw new Error(`Refusing to initialize: ${directory} already exists without a valid event log.`);
      const existing = load(root);
      validateEventTypes(existing.events);
      if (existing.events.length) throw new Error(`Refusing to initialize: ${directory} already contains events.`);
      await initializeWorkspace(root, file);
      return;
    }
    mkdirSync(directory);
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
    await initializeWorkspace(root, file);
    return;
  }
  if (command === 'rename-project') {
    const [name, ...extra] = rest;
    if (!name?.trim() || extra.length) throw new Error('Usage: [--project PROJECT_ID] rename-project NEW_NAME');
    return await runCommand(root, 'renameProject', {type: 'RenameProject', data: {projectId, name}}, {projectId, name});
  }
  const mutation = parseMutation(command, rest, projectId);
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
    if (rest.length) throw new Error('Usage: [--project PROJECT_ID] chapters');
    console.log(JSON.stringify({version: 1, revision, projectId, chapters: [...(model.chapters.get(projectId)?.values() ?? [])]}, null, 2));
    return;
  }
  if (command === 'show') {
    const formatIndex = rest.indexOf('--format');
    if (formatIndex >= 0 && (rest.indexOf('--format', formatIndex + 1) >= 0 || rest.length !== formatIndex + 2))
      throw new Error('Usage: [--project PROJECT_ID] show [CHAPTER_ID] [--format json|md]');
    const positional = formatIndex < 0 ? rest : rest.filter((_, index) => index !== formatIndex && index !== formatIndex + 1);
    if (positional.length > 1) throw new Error('Usage: [--project PROJECT_ID] show [CHAPTER_ID] [--format json|md]');
    const [chapterId] = positional;
    if (chapterId && !model.chapters.get(projectId)?.has(chapterId)) throw new Error(`Unknown chapter ID: ${chapterId}`);
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

function parseMutation(command, args, projectId) {
  const [a, b, c, d, extra] = args;
  switch (command) {
    case 'add-project':
      if (args.length !== 1 || !a.trim()) throw new Error('Usage: add-project NAME');
      return {decider: 'addProject', command: {type: 'AddProject', data: {name: a}}, result: {}};
    case 'add-chapter':
      if (args.length !== 1 || !a.trim()) throw new Error('Usage: [--project PROJECT_ID] add-chapter TITLE');
      return {decider: 'addChapter', command: {type: 'AddChapter', data: {projectId, title: a}}, result: {projectId}};
    case 'add-node':
      if (
        args.length !== 4 ||
        !a.trim() ||
        !['ui', 'cmd', 'evt', 'rm', 'dm', 'processor'].includes(b) ||
        !/^(0|[1-9]\d*)$/.test(c) ||
        !Number.isSafeInteger(Number(c)) ||
        !d.trim()
      )
        throw new Error('Usage: [--project PROJECT_ID] add-node CHAPTER_ID TYPE LANE LABEL');
      return {
        decider: 'addNode',
        command: {type: 'AddNode', data: {projectId, chapterId: a, nodeType: b, laneId: Number(c), label: d}},
        result: {projectId},
      };
    case 'rename-node':
      if (args.length !== 2 || !a.trim() || !b.trim()) throw new Error('Usage: [--project PROJECT_ID] rename-node NODE_ID NAME');
      return {
        decider: 'renameNode',
        command: {type: 'RenameNode', data: {projectId, nodeId: a, newName: b}},
        result: {projectId, nodeId: a, name: b},
      };
    case 'connect-nodes':
      if (
        args.length < 2 ||
        args.length > 3 ||
        !a?.trim() ||
        !b?.trim() ||
        extra ||
        (c !== undefined && !['flow', 'back-reference'].includes(c))
      )
        throw new Error('Usage: [--project PROJECT_ID] connect-nodes SOURCE_ID TARGET_ID [ROLE]');
      return {
        decider: 'connectNodes',
        command: {type: 'ConnectNodes', data: {projectId, sourceNodeId: a, targetNodeId: b, ...(c ? {role: c} : {})}},
        result: {projectId, sourceNodeId: a, targetNodeId: b},
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
  if (process.env.SLICR_TYPESCRIPT_RUNTIME !== '1') {
    const result = spawnSync(
      process.execPath,
      ['--import', new URL('./ts-register.mjs', import.meta.url).href, fileURLToPath(import.meta.url), ...args],
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
