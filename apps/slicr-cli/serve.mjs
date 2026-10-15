import {createHash} from 'node:crypto';
import {createReadStream, readFileSync, realpathSync, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';

const string = (value) => typeof value === 'string';
const identifier = (value) => string(value) && value.length > 0;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const keysMatch = (value, fields) =>
  object(value) && Object.keys(value).length === fields.length && fields.every((field) => field in value);
const nodeType = (value) => ['ui', 'cmd', 'evt', 'rm', 'dm', 'processor'].includes(value);
const primitive = (value) => value === null || string(value);
const complexValue = (value) =>
  object(value) && Object.entries(value).every(([key, entry]) => identifier(key) && (primitive(entry) || complexValue(entry)));
const propertySchema = (value) =>
  object(value) &&
  Object.keys(value).every((key) => ['propertyId', 'name', 'type', 'list', 'optional', 'generated', 'properties'].includes(key)) &&
  identifier(value.propertyId) &&
  string(value.name) &&
  ['string', 'number', 'boolean', 'Object'].includes(value.type) &&
  ['list', 'optional', 'generated'].every((key) => !(key in value) || typeof value[key] === 'boolean') &&
  (!('properties' in value) || (Array.isArray(value.properties) && value.properties.every(propertySchema)));
const exampleValue = (value) =>
  object(value) &&
  Object.keys(value).every((key) => ['propertyId', 'scalarValue', 'scalarListValues', 'complexValue', 'complexListValues'].includes(key)) &&
  identifier(value.propertyId) &&
  ['scalarValue', 'scalarListValues', 'complexValue', 'complexListValues'].filter((key) => key in value).length === 1 &&
  (!('scalarValue' in value) || primitive(value.scalarValue)) &&
  (!('scalarListValues' in value) || (Array.isArray(value.scalarListValues) && value.scalarListValues.every(primitive))) &&
  (!('complexValue' in value) || complexValue(value.complexValue)) &&
  (!('complexListValues' in value) || (Array.isArray(value.complexListValues) && value.complexListValues.every(complexValue)));
const arrayOf = (validator) => (value) => Array.isArray(value) && value.every(validator);

// Payload fields and tag construction are kept in sync with the core event constructors.
const eventFields = {
  ProjectAdded: {projectId: identifier, name: string},
  ProjectRenamed: {projectId: identifier, newName: string},
  ChapterAdded: {projectId: identifier, chapterId: identifier, title: string},
  ChapterRenamed: {projectId: identifier, chapterId: identifier, newTitle: string},
  NodeAdded: {
    projectId: identifier,
    chapterId: identifier,
    nodeId: identifier,
    type: nodeType,
    laneId: (v) => Number.isSafeInteger(v) && v >= 0,
    label: string,
  },
  NodeChapterChanged: {projectId: identifier, nodeId: identifier, chapterId: identifier},
  NodeRenamed: {projectId: identifier, nodeId: identifier, newName: string},
  NodeRemoved: {projectId: identifier, nodeId: identifier},
  NodeTypeChanged: {projectId: identifier, nodeId: identifier, newType: nodeType},
  NodeSchemaChanged: {projectId: identifier, nodeId: identifier, schema: arrayOf(propertySchema)},
  NodeExampleValuesChanged: {projectId: identifier, nodeId: identifier, exampleValues: arrayOf(exampleValue)},
  NodesConnected: {
    projectId: identifier,
    sourceNodeId: identifier,
    targetNodeId: identifier,
    role: (v) => ['flow', 'back-reference'].includes(v),
  },
  NodesDisconnected: {projectId: identifier, sourceNodeId: identifier, targetNodeId: identifier},
};

function validateEvent(event, Events, line, position) {
  if (!Object.hasOwn(eventFields, event.type))
    throw Object.assign(new Error(`Incompatible event type in Slicr history at line ${line}, event ${position}: ${event.type}`), {
      status: 422,
    });
  const fields = eventFields[event.type];
  const payload = event.payload;
  const names = Object.keys(fields);
  if (
    !keysMatch(event, ['type', 'payload', 'tags']) ||
    !keysMatch(payload, names) ||
    !names.every((field) => fields[field](payload[field])) ||
    !Array.isArray(event.tags)
  )
    throw Object.assign(new Error(`Invalid ${event.type} payload or tags in Slicr history at line ${line}, event ${position}.`), {
      status: 422,
    });
  const constructor = Events[event.type[0].toLowerCase() + event.type.slice(1)];
  const expected = constructor(...names.map((field) => payload[field]));
  if (JSON.stringify(event.tags) !== JSON.stringify(expected.tags))
    throw Object.assign(new Error(`Invalid ${event.type} tags in Slicr history at line ${line}, event ${position}.`), {status: 422});
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function readModel(root) {
  const file = resolve(root, '.slicr/events.ndjson');
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT')
      throw Object.assign(new Error(`No Slicr model at ${file}. Initialize a model explicitly before serving it.`), {status: 404});
    throw error;
  }
  const events = [];
  const locations = [];
  const ids = new Set();
  let position = 1;
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  for (const [index, line] of lines.entries()) {
    let batch;
    try {
      batch = JSON.parse(line);
    } catch {
      throw Object.assign(new Error(`Invalid JSON in event history at line ${index + 1}.`), {status: 422});
    }
    if (!object(batch)) throw Object.assign(new Error(`Incompatible or corrupt Slicr event history at line ${index + 1}.`), {status: 422});
    const {v, id, start, events: entries, sha256} = batch;
    const digest = createHash('sha256')
      .update(JSON.stringify({v, id, start, events: entries}))
      .digest('hex');
    if (
      v !== 1 ||
      typeof id !== 'string' ||
      !id ||
      ids.has(id) ||
      start !== position ||
      !Array.isArray(entries) ||
      !entries.length ||
      sha256 !== digest ||
      !entries.every(
        (e, i) => object(e) && e.id === `${id}:${i}` && object(e.event) && typeof e.event.type === 'string' && Array.isArray(e.event.tags),
      )
    )
      throw Object.assign(new Error(`Incompatible or corrupt Slicr event history (line ${index + 1}, expected format v1).`), {status: 422});
    events.push(...entries.map(({event}) => event));
    locations.push(...entries.map((_, i) => ({line: index + 1, position: start + i})));
    ids.add(id);
    position += entries.length;
  }
  return {events, locations, revision: createHash('sha256').update(text).digest('hex')};
}

async function projectModel(root) {
  const {events, locations, revision} = readModel(root);
  const [{projectWorkspace}, {projectGraph}, {Events}] = await Promise.all([
    import('../../packages/slicr-core/src/workspaceProjector.ts'),
    import('../../packages/slicr-core/src/graphProjector/graphProjector.ts'),
    import('../../packages/slicr-core/src/events.ts'),
  ]);
  events.forEach((event, index) => validateEvent(event, Events, locations[index].line, locations[index].position));
  const workspace = projectWorkspace(events);
  const chapterIdByProjectAndNodeId = new Map();
  for (const event of events) {
    if (event.type === 'NodeAdded')
      chapterIdByProjectAndNodeId.set(JSON.stringify([event.payload.projectId, event.payload.nodeId]), event.payload.chapterId);
    if (event.type === 'NodeChapterChanged')
      chapterIdByProjectAndNodeId.set(JSON.stringify([event.payload.projectId, event.payload.nodeId]), event.payload.chapterId);
  }
  return {
    revision,
    workspace,
    chapterIdByProjectAndNodeId,
    projectGraph: (projectId, chapterId) => projectGraph(events, projectId, chapterId),
  };
}

export function startServeServer({root, assets, port = 0, host = '127.0.0.1'}) {
  const projectRoot = resolve(root);
  const assetRoot = resolve(assets);
  const server = createServer(async (request, response) => {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD' && !(request.method === 'POST' && request.url === '/api/command'))
        throw Object.assign(new Error('Only GET, HEAD and scoped POST /api/command are allowed.'), {status: 405});
      const hostHeader = request.headers.host;
      let requestHost;
      try {
        if (!hostHeader) throw new Error('missing Host header');
        requestHost = new URL(`http://${hostHeader}`).hostname.toLowerCase().replace(/^\[|\]$/g, '');
      } catch {
        throw Object.assign(new Error('Invalid or missing Host header.'), {status: 400});
      }
      if (!['localhost', '127.0.0.1', '::1'].includes(requestHost))
        throw Object.assign(new Error('Host header must name a loopback host (localhost, 127.0.0.1, or ::1).'), {status: 403});
      const url = new URL(request.url, `http://${hostHeader}`);
      if (url.pathname === '/api/command') {
        if (request.method !== 'POST') throw Object.assign(new Error('POST required.'), {status: 405});
        let body = '';
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 64 * 1024) throw Object.assign(new Error('Command body is too large.'), {status: 413});
        }
        let input;
        try {
          input = JSON.parse(body);
        } catch {
          throw Object.assign(new Error('Invalid JSON command.'), {status: 400});
        }
        if (!object(input) || typeof input.projectId !== 'string' || typeof input.type !== 'string' || !object(input.data))
          throw Object.assign(new Error('Expected a scoped command with projectId, type and data.'), {status: 400});
        const commandMap = {
          RenameNode: ['renameNode', ['nodeId', 'name'], (data) => ({projectId: input.projectId, nodeId: data.nodeId, newName: data.name})],
          AddNode: [
            'addNode',
            ['chapterId', 'nodeType', 'laneId', 'label'],
            (data) => ({
              projectId: input.projectId,
              chapterId: data.chapterId,
              nodeType: data.nodeType,
              laneId: data.laneId,
              label: data.label,
            }),
          ],
          ConnectNodes: [
            'connectNodes',
            ['sourceNodeId', 'targetNodeId', 'role'],
            (data) => ({
              projectId: input.projectId,
              sourceNodeId: data.sourceNodeId,
              targetNodeId: data.targetNodeId,
              ...(data.role ? {role: data.role} : {}),
            }),
          ],
          AddChapter: ['addChapter', ['title'], (data) => ({projectId: input.projectId, title: data.title})],
          RenameProject: ['renameProject', ['name'], (data) => ({projectId: input.projectId, name: data.name})],
        };
        const mapping = commandMap[input.type];
        if (!mapping) throw Object.assign(new Error(`Unsupported command type: ${input.type}`), {status: 400});
        const model = await projectModel(projectRoot);
        if (!model.workspace.projects.some((p) => p.id === input.projectId))
          throw Object.assign(new Error(`Unknown project ID: ${input.projectId}`), {status: 404});
        const allowedFields = mapping[1];
        if (
          Object.keys(input.data).some((key) => !allowedFields.includes(key)) ||
          allowedFields.some((key) => !(key in input.data) && !(input.type === 'ConnectNodes' && key === 'role'))
        )
          throw Object.assign(new Error('Invalid command data.'), {status: 400});
        const data = mapping[2](input.data);
        if (Object.values(data).some((value) => value === undefined))
          throw Object.assign(new Error('Invalid command data.'), {status: 400});
        const [{NdjsonSpecEventStore}, graphModule, projectModule, {handleCommand}] = await Promise.all([
          import('../../packages/event-sourcing/src/ndjsonSpecEventStore.ts'),
          import('../../packages/slicr-core/src/graphCommands/deciders.ts'),
          import('../../packages/slicr-core/src/projectCommands/projectCommandHandler.ts'),
          import('../../packages/slicr-core/src/eventSourcing.ts'),
        ]);
        const store = NdjsonSpecEventStore.open(projectRoot);
        let appended;
        try {
          const decider = graphModule.deciders()[mapping[0]] ?? projectModule.deciders()[mapping[0]];
          appended = await handleCommand(store, decider, {type: input.type, data});
        } finally {
          store.close();
        }
        response.writeHead(200, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
        response.end(JSON.stringify({appended: appended.length}));
        return;
      }
      if (url.pathname === '/api/model' || url.pathname === '/api/projection') {
        const model = await projectModel(projectRoot);
        const projectId = url.searchParams.get('project') || undefined;
        if (projectId && !model.workspace.projects.some((p) => p.id === projectId))
          throw Object.assign(new Error(`Unknown project ID: ${projectId}`), {status: 404});
        if (url.pathname === '/api/model') {
          response.writeHead(200, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
          response.end(
            JSON.stringify({
              version: 1,
              projectDirectory: projectRoot,
              storeDirectory: resolve(projectRoot, '.slicr'),
              revision: model.revision,
              projects: model.workspace.projects,
              chaptersByProjectId: model.workspace.chaptersByProjectId,
            }),
          );
          return;
        }
        const selectedProject = projectId ?? (model.workspace.projects.length === 1 ? model.workspace.projects[0]?.id : undefined);
        if (!selectedProject)
          throw Object.assign(new Error('Specify a project query parameter when the model contains multiple projects.'), {status: 400});
        const chapterId = url.searchParams.get('chapter') || undefined;
        const chapters = model.workspace.chaptersByProjectId[selectedProject] ?? [];
        if (chapterId && !chapters.some((chapter) => chapter.id === chapterId))
          throw Object.assign(new Error(`Unknown chapter ID: ${chapterId}`), {status: 404});
        const graph = model.projectGraph(selectedProject, chapterId);
        response.writeHead(200, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
        response.end(
          JSON.stringify({
            version: 1,
            revision: model.revision,
            projectId: selectedProject,
            chapterId: chapterId ?? null,
            projects: model.workspace.projects,
            chapters: chapters,
            nodes: graph.nodes.map((node) => ({
              id: node.nodeId,
              projectId: selectedProject,
              chapterId: model.chapterIdByProjectAndNodeId.get(JSON.stringify([selectedProject, node.nodeId])),
              type: node.nodeType,
              laneId: node.laneId,
              label: node.label,
            })),
            nodeSchemas: graph.nodeSchemas,
            nodeExampleValues: graph.nodeExampleValues,
            edges: graph.edges.filter((edge) => edge.sourceNodeId !== edge.targetNodeId),
          }),
        );
        return;
      }
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === '/' || pathname === '/index.html') pathname = '/project.html';
      if (pathname !== '/project.html' && !pathname.startsWith('/assets/')) throw Object.assign(new Error('Not found'), {status: 404});
      const file = resolve(assetRoot, `.${pathname}`);
      if (!file.startsWith(assetRoot + sep)) throw Object.assign(new Error('Not found'), {status: 404});
      const realAssetRoot = realpathSync(assetRoot);
      const realFile = realpathSync(file);
      if (!realFile.startsWith(realAssetRoot + sep) || !statSync(realFile).isFile())
        throw Object.assign(new Error('Not found'), {status: 404});
      if (pathname === '/project.html') {
        response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
        response.end(readFileSync(file));
        return;
      }
      response.writeHead(200, {'content-type': contentTypes[extname(file)] ?? 'application/octet-stream'});
      createReadStream(file).pipe(response);
    } catch (error) {
      const status = error.status ?? (error.name === 'AppendConditionFailedError' ? 409 : error.code === 'ENOENT' ? 404 : 500);
      response.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
      response.end(JSON.stringify({error: error.message}));
    }
  });
  const listening = new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolveListen(server.address());
    });
  });
  return {
    server,
    listening,
    close: () => new Promise((resolveClose, reject) => server.close((error) => (error ? reject(error) : resolveClose()))),
  };
}
