import {createHash} from 'node:crypto';
import {createReadStream, readFileSync, realpathSync, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const projectionPage = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Slicr · Read-only project view</title>
<style>body{font:16px system-ui,sans-serif;max-width:1000px;margin:2rem auto;padding:0 1rem;color:#19343a}header{border-bottom:1px solid #ccd8d9;padding-bottom:1rem}label{display:inline-grid;gap:.25rem;margin:1rem 1rem 1rem 0}select{font:inherit;padding:.35rem}#identity{color:#52666b}#error{color:#9b1c1c;white-space:pre-wrap}li{margin:.4rem 0}.node{padding:.6rem;border:1px solid #ccd8d9;border-radius:4px;margin:.5rem 0}code{overflow-wrap:anywhere}</style></head>
<body><header><h1>Slicr project view <small>(read-only)</small></h1><div id="identity">Loading project model…</div></header>
<label>Project <select id="project"></select></label><label>Chapter <select id="chapter"></select></label>
<p id="error" role="alert"></p><main id="projection" aria-live="polite">Loading projection…</main>
<script>
const projectSelect=document.getElementById('project'),chapterSelect=document.getElementById('chapter'),identity=document.getElementById('identity'),errorBox=document.getElementById('error'),output=document.getElementById('projection');
function element(tag,text){const e=document.createElement(tag);e.textContent=text;return e}
async function api(path){const response=await fetch(path,{headers:{accept:'application/json'}});let body;try{body=await response.json()}catch{throw new Error('Server returned an invalid response ('+response.status+')')}if(!response.ok)throw new Error(body.error||('Request failed ('+response.status+')'));return body}
function selectedProject(){return projectSelect.value} function selectedChapter(){return chapterSelect.value}
async function loadProjection(){errorBox.textContent='';output.replaceChildren();if(!selectedProject()){output.textContent='No projects are present in this model.';return}output.textContent='Loading projection…';try{const q=new URLSearchParams({project:selectedProject()});if(selectedChapter())q.set('chapter',selectedChapter());const p=await api('/api/projection?'+q);output.replaceChildren(element('h2',p.projects.find(x=>x.id===p.projectId)?.name+' · '+(p.chapters.find(x=>x.id===p.chapterId)?.title||'All chapters')));output.append(element('p','Revision: '+p.revision));const nodes=element('section','');nodes.append(element('h3','Nodes ('+p.nodes.length+')'));if(!p.nodes.length)nodes.append(element('p','No nodes in this chapter.'));for(const n of p.nodes){const item=element('article','');item.className='node';item.append(element('strong',n.label+' · '+n.type));item.append(element('p','ID: '+n.id+' · lane '+n.laneId));if(p.nodeSchemas[n.id])item.append(element('p','Schema: '+JSON.stringify(p.nodeSchemas[n.id])));if(p.nodeExampleValues[n.id])item.append(element('p','Example values: '+JSON.stringify(p.nodeExampleValues[n.id])));nodes.append(item)}output.append(nodes);const edges=element('section','');edges.append(element('h3','Connections ('+p.edges.length+')'));const list=element('ul','');for(const edge of p.edges)list.append(element('li',edge.sourceNodeId+' → '+edge.targetNodeId+' ('+edge.role+')'));edges.append(list);output.append(edges,list)}catch(e){output.replaceChildren();errorBox.textContent='Could not load project projection: '+e.message}}
async function start(){try{const model=await api('/api/model');identity.textContent='Project directory: '+model.projectDirectory+' · Store: '+model.storeDirectory+' · Read-only';for(const p of model.projects){const option=element('option',p.name+' ('+p.id+')');option.value=p.id;projectSelect.append(option)}projectSelect.addEventListener('change',populateChapters);chapterSelect.addEventListener('change',loadProjection);populateChapters()}catch(e){identity.textContent='Project model unavailable';errorBox.textContent='Could not load project model: '+e.message;output.textContent='The project-backed view is unavailable.'}}
function populateChapters(){chapterSelect.replaceChildren();const chapters=window.model?.chaptersByProjectId?.[selectedProject()]||[];const all=element('option','All chapters');all.value='';chapterSelect.append(all);for(const c of chapters){const o=element('option',c.title+' ('+c.id+')');o.value=c.id;chapterSelect.append(o)}loadProjection()}
</script><script>/* Initialize from the API response; expose only fetched workspace metadata to the selector. */
(async()=>{try{const r=await fetch('/api/model');if(!r.ok){const b=await r.json();throw new Error(b.error||r.statusText)}window.model=await r.json();document.getElementById('identity').textContent='Project directory: '+window.model.projectDirectory+' · Store: '+window.model.storeDirectory+' · Read-only';const s=document.getElementById('project');for(const p of window.model.projects){const o=document.createElement('option');o.textContent=p.name+' ('+p.id+')';o.value=p.id;s.append(o)}s.addEventListener('change',()=>{const c=document.getElementById('chapter');c.replaceChildren();const a=document.createElement('option');a.textContent='All chapters';a.value='';c.append(a);for(const x of window.model.chaptersByProjectId[s.value]||[]){const o=document.createElement('option');o.textContent=x.title+' ('+x.id+')';o.value=x.id;c.append(o)}c.dispatchEvent(new Event('change'))});s.dispatchEvent(new Event('change'));document.getElementById('chapter').addEventListener('change',()=>{const q=new URLSearchParams({project:s.value});if(document.getElementById('chapter').value)q.set('chapter',document.getElementById('chapter').value);fetch('/api/projection?'+q).then(async r=>{const p=await r.json();if(!r.ok)throw new Error(p.error||r.statusText);const out=document.getElementById('projection');out.replaceChildren();const h=document.createElement('h2');h.textContent=(p.projects.find(x=>x.id===p.projectId)?.name||p.projectId)+' · '+(p.chapters.find(x=>x.id===p.chapterId)?.title||'All chapters');out.append(h);for(const n of p.nodes){const d=document.createElement('p');d.textContent=n.type+': '+n.label+' ['+n.id+']';out.append(d)}const edges=document.createElement('p');edges.textContent='Connections: '+p.edges.map(e=>e.sourceNodeId+' → '+e.targetNodeId+' ('+e.role+')').join(', ');out.append(edges);document.getElementById('error').textContent='' }).catch(e=>document.getElementById('error').textContent='Could not load project projection: '+e.message)})}catch(e){document.getElementById('identity').textContent='Project model unavailable';document.getElementById('error').textContent='Could not load project model: '+e.message}})();</script></body></html>`;

const readOnlyPage = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Slicr project view</title><style>body{font:16px system-ui;max-width:960px;margin:2rem auto;padding:0 1rem;color:#19343a}header{border-bottom:1px solid #ccd8d9}label{display:inline-grid;margin:1rem}#error{color:#9b1c1c}article{padding:.6rem;border:1px solid #ccd8d9;margin:.5rem 0}</style><body><header><h1>Slicr project view <small>(read-only)</small></h1><p id="identity">Loading project model…</p></header><label>Project <select id="project"></select></label><label>Chapter <select id="chapter"></select></label><p id="error" role="alert"></p><main id="projection" aria-live="polite">Loading projection…</main><script>
const byId=id=>document.getElementById(id), project=byId('project'), chapter=byId('chapter'), output=byId('projection'), error=byId('error');let model;
const el=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node};
async function request(path){const r=await fetch(path);const body=await r.json();if(!r.ok)throw Error(body.error||r.statusText);return body}
async function render(){error.textContent='';if(!project.value){output.textContent='No projects in this model.';return}output.textContent='Loading…';try{const q=new URLSearchParams({project:project.value});if(chapter.value)q.set('chapter',chapter.value);const p=await request('/api/projection?'+q);output.replaceChildren(el('h2',project.selectedOptions[0].text+' · '+chapter.selectedOptions[0].text),el('p','Revision: '+p.revision));const nodes=el('section','');nodes.append(el('h3','Nodes ('+p.nodes.length+')'));for(const n of p.nodes){const card=el('article','');card.append(el('strong',n.label+' · '+n.type),el('p','ID: '+n.id+' · Chapter: '+n.chapterId+' · Lane: '+n.laneId));if(p.nodeSchemas[n.id]!==undefined)card.append(el('p','Schema: '+JSON.stringify(p.nodeSchemas[n.id])));if(p.nodeExampleValues[n.id]!==undefined)card.append(el('p','Example values: '+JSON.stringify(p.nodeExampleValues[n.id])));nodes.append(card)}output.append(nodes);const edges=el('section','');edges.append(el('h3','Connections ('+p.edges.length+')'));const list=el('ul','');for(const edge of p.edges)list.append(el('li',edge.sourceNodeId+' → '+edge.targetNodeId+' ('+edge.role+')'));edges.append(list);output.append(edges)}catch(e){output.replaceChildren();error.textContent='Could not load project projection: '+e.message}}
function selectProject(){chapter.replaceChildren();const all=el('option','All chapters');all.value='';chapter.append(all);for(const c of model.chaptersByProjectId[project.value]||[]){const option=el('option',c.title+' ('+c.id+')');option.value=c.id;chapter.append(option)}render()}
(async()=>{try{model=await request('/api/model');byId('identity').textContent='Project: '+model.projectDirectory+' · Store: '+model.storeDirectory+' · Read-only';for(const p of model.projects){const option=el('option',p.name+' ('+p.id+')');option.value=p.id;project.append(option)}project.addEventListener('change',selectProject);chapter.addEventListener('change',render);selectProject()}catch(e){byId('identity').textContent='Project model unavailable';error.textContent='Could not load project model: '+e.message;output.textContent='The project-backed view is unavailable.'}})();
</script></body></html>`;

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
      !entries.every((e, i) => e.id === `${id}:${i}` && e.event && typeof e.event.type === 'string' && Array.isArray(e.event.tags))
    )
      throw Object.assign(new Error(`Incompatible or corrupt Slicr event history (line ${index + 1}, expected format v1).`), {status: 422});
    events.push(...entries.map(({event}) => event));
    ids.add(id);
    position += entries.length;
  }
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
  for (const event of events)
    if (!supported.has(event.type)) throw Object.assign(new Error(`Incompatible event type for Slicr model: ${event.type}`), {status: 422});
  return {events, revision: createHash('sha256').update(text).digest('hex')};
}

async function projectModel(root) {
  const {events, revision} = readModel(root);
  const [{projectWorkspace}, {projectGraph}] = await Promise.all([
    import('../../packages/slicr-core/src/workspaceProjector.ts'),
    import('../../packages/slicr-core/src/graphProjector/graphProjector.ts'),
  ]);
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
      if (pathname === '/') pathname = '/index.html';
      const file = resolve(assetRoot, `.${pathname}`);
      if (!file.startsWith(assetRoot + sep)) throw Object.assign(new Error('Not found'), {status: 404});
      const realAssetRoot = realpathSync(assetRoot);
      const realFile = realpathSync(file);
      if (!realFile.startsWith(realAssetRoot + sep) || !statSync(realFile).isFile())
        throw Object.assign(new Error('Not found'), {status: 404});
      if (pathname === '/index.html') {
        response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
        response.end(readOnlyPage);
        return;
      }
      response.writeHead(200, {'content-type': contentTypes[extname(file)] ?? 'application/octet-stream'});
      createReadStream(file).pipe(response);
    } catch (error) {
      const status = error.status ?? (error.code === 'ENOENT' ? 404 : 500);
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
