#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve, join} from 'node:path';

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

const tupleKey = (...parts) => JSON.stringify(parts);

function project(events) {
  const projects = new Map();
  const chapters = new Map();
  const nodes = new Map();
  const edges = new Map();
  for (const event of events) {
    const p = event.payload;
    switch (event.type) {
      case 'ProjectAdded':
        projects.set(p.projectId, {id: p.projectId, name: p.name});
        break;
      case 'ProjectRenamed':
        if (projects.has(p.projectId)) projects.get(p.projectId).name = p.newName;
        break;
      case 'ChapterAdded': {
        const map = chapters.get(p.projectId) ?? new Map();
        map.set(p.chapterId, {id: p.chapterId, title: p.title});
        chapters.set(p.projectId, map);
        break;
      }
      case 'ChapterRenamed':
        if (chapters.get(p.projectId)?.has(p.chapterId)) chapters.get(p.projectId).get(p.chapterId).title = p.newTitle;
        break;
      case 'NodeAdded':
        nodes.set(tupleKey(p.projectId, p.nodeId), {
          id: p.nodeId,
          type: p.type,
          laneId: p.laneId,
          label: p.label,
          chapterId: p.chapterId,
          projectId: p.projectId,
        });
        break;
      case 'NodeRenamed': {
        const node = nodes.get(tupleKey(p.projectId, p.nodeId));
        if (node) node.label = p.newName;
        break;
      }
      case 'NodeChapterChanged': {
        const node = nodes.get(tupleKey(p.projectId, p.nodeId));
        if (node) node.chapterId = p.chapterId;
        break;
      }
      case 'NodeTypeChanged': {
        const node = nodes.get(tupleKey(p.projectId, p.nodeId));
        if (node) node.type = p.newType;
        break;
      }
      case 'NodeSchemaChanged': {
        const node = nodes.get(tupleKey(p.projectId, p.nodeId));
        if (node) node.schema = p.schema;
        break;
      }
      case 'NodeExampleValuesChanged': {
        const node = nodes.get(tupleKey(p.projectId, p.nodeId));
        if (node) node.exampleValues = p.exampleValues;
        break;
      }
      case 'NodeRemoved':
        nodes.delete(tupleKey(p.projectId, p.nodeId));
        for (const [key, e] of edges)
          if (e.projectId === p.projectId && (e.sourceNodeId === p.nodeId || e.targetNodeId === p.nodeId)) edges.delete(key);
        break;
      case 'NodesConnected': {
        const key = tupleKey(p.projectId, p.sourceNodeId, p.targetNodeId);
        edges.set(key, {projectId: p.projectId, sourceNodeId: p.sourceNodeId, targetNodeId: p.targetNodeId, role: p.role});
        break;
      }
      case 'NodesDisconnected':
        edges.delete(tupleKey(p.projectId, p.sourceNodeId, p.targetNodeId));
        break;
      default:
        throw new Error(`Incompatible event type for Slicr model: ${event.type}`);
    }
  }
  return {projects: [...projects.values()], chapters, nodes: [...nodes.values()], edges: [...edges.values()]};
}

function main(args) {
  let root = process.cwd();
  const pathIndex = args.indexOf('--path');
  if (pathIndex >= 0) {
    if (!args[pathIndex + 1]) throw new Error('--path requires a project directory');
    root = resolve(args[pathIndex + 1]);
    args.splice(pathIndex, 2);
  }
  const [command, ...rest] = args;
  if (command === '--help' || !command) {
    console.log('Usage: slicr [--path PROJECT_DIR] projects | chapters PROJECT_ID | show PROJECT_ID [CHAPTER_ID] [--format json|md]');
    return;
  }
  const {events, revision} = load(root);
  const model = project(events);
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

try {
  main(process.argv.slice(2));
} catch (error) {
  fail(error.message);
}
