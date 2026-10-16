import {test, expect} from '@playwright/test';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {startServeServer} from '../../slicr-cli/serve.mjs';

const editor = new URL('../', import.meta.url).pathname;
const cli = new URL('../../slicr-cli/slicr.mjs', import.meta.url).pathname;
const register = new URL('../../slicr-cli/ts-register.mjs', import.meta.url).href;
const assets = new URL('../dist-project/', import.meta.url).pathname;

function command(dir, ...args) {
  const result = spawnSync(process.execPath, ['--import', register, cli, '--path', dir, ...args], {encoding: 'utf8'});
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

test.beforeAll(() => {
  const build = spawnSync('npm', ['run', 'build:project'], {cwd: editor, encoding: 'utf8'});
  expect(build.status, build.stderr).toBe(0);
});

test('served editor edits the project store without opening IndexedDB and catches up across processes', async ({browser}) => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-project-browser-'));
  let serving;
  const context = await browser.newContext();
  try {
    const initial = command(dir, 'init');
    const node = command(dir, 'add-node', initial.chapterId, 'evt', '0', 'From project store');
    command(dir, 'rename-node', node.generatedIds[0], 'Visible project event');
    const otherChapter = command(dir, 'add-chapter', 'Another chapter');
    const otherNode = command(dir, 'add-node', otherChapter.generatedIds[0], 'cmd', '1', 'Other chapter node');
    command(dir, 'connect-nodes', node.generatedIds[0], otherNode.generatedIds[0]);
    const history = join(dir, '.slicr', 'events.ndjson');
    const before = readFileSync(history);
    serving = startServeServer({root: dir, assets});
    const {port} = await serving.listening;
    await context.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', {
        get: () => {
          throw Error('IndexedDB must not be opened');
        },
      });
    });
    const page = await context.newPage();
    const responses = [];
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    page.on('response', (response) => {
      if (response.url().includes('/api/')) responses.push(response.url());
    });
    await page.goto(`http://127.0.0.1:${port}/`);
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Visible project event'})).toBeVisible();
    await expect(page.getByLabel('Project store identity')).toContainText(dir);
    await expect(page.getByLabel('Project store identity')).toContainText('.slicr');
    await expect(page.getByLabel('Project store identity')).toContainText('project store');
    expect(responses.some((url) => url.includes('/api/model'))).toBe(true);
    expect(responses.some((url) => url.includes('/api/projection'))).toBe(true);
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Other chapter node'})).toHaveCount(0);
    await page.getByRole('button', {name: 'Another chapter'}).click();
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Other chapter node'})).toBeVisible();
    await expect(page.locator('.edge-layer .edge-line')).toHaveCount(0);
    await page.getByRole('button', {name: 'Default Chapter'}).click();
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Visible project event'})).toBeVisible();
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Other chapter node'})).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Add node', exact: true})).toBeVisible();
    await page.locator('.canvas .node-label-button', {hasText: 'Visible project event'}).dblclick();
    const editor = page.getByRole('textbox', {name: 'Edit Visible project event label'});
    await editor.fill('Browser project edit');
    await editor.press('Enter');
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Browser project edit'})).toBeVisible();
    expect(readFileSync(history)).not.toEqual(before);
    command(dir, 'rename-node', node.generatedIds[0], 'CLI project edit');
    await expect(page.locator('.canvas .node-label-button', {hasText: 'CLI project edit'})).toBeVisible({timeout: 5000});
    await page.reload();
    await expect(page.locator('.canvas .node-label-button', {hasText: 'CLI project edit'})).toBeVisible();
    expect(pageErrors).toEqual([]);
  } finally {
    await context.close();
    if (serving) await serving.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('project create workflows select the exact project and chapter and add nodes in lane zero', async ({browser}) => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-project-create-workflows-'));
  let serving;
  const context = await browser.newContext();
  try {
    command(dir, 'init');
    serving = startServeServer({root: dir, assets});
    const {port} = await serving.listening;
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.getByRole('button', {name: 'Current project: Default Project'}).click();
    await page.getByRole('option', {name: 'Add new Project ...'}).click();
    await page.locator('.project-switcher-option-add-input').fill('Created project');
    await page.getByRole('button', {name: 'Create project'}).click();
    await expect(page.getByRole('button', {name: 'Current project: Created project'})).toBeVisible();
    await page.getByRole('button', {name: 'Add chapter'}).click();
    await page.locator('.chapter-sidebar-create-input').fill('Created chapter');
    await page.locator('.chapter-sidebar-create-input').press('Enter');
    const chapter = page.getByRole('button', {name: 'Created chapter'});
    await expect(chapter).toHaveClass(/chapter-nav-item-active/);
    await page.getByRole('button', {name: 'Add node', exact: true}).click();
    const node = page.locator('.canvas .node-label-input');
    await expect(node).toBeVisible();
    const model = await (await page.request.get(`http://127.0.0.1:${port}/api/model`)).json();
    const project = model.projects.find((item) => item.name === 'Created project');
    const createdChapter = model.chaptersByProjectId[project.id].find((item) => item.title === 'Created chapter');
    const projection = await (
      await page.request.get(`http://127.0.0.1:${port}/api/projection?project=${project.id}&chapter=${createdChapter.id}`)
    ).json();
    expect(projection.nodes).toHaveLength(1);
    expect(projection.nodes[0].laneId).toBe(0);
  } finally {
    await context.close();
    if (serving) await serving.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('scope switches with pending property edits require an explicit flush or discard choice', async ({browser}) => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-project-scope-flush-'));
  let serving;
  const context = await browser.newContext();
  try {
    const initial = command(dir, 'init');
    const node = command(dir, 'add-node', initial.chapterId, 'evt', '0', 'Pending property node');
    const nextChapter = command(dir, 'add-chapter', 'Next chapter');
    serving = startServeServer({root: dir, assets});
    const {port} = await serving.listening;
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.locator('.canvas .node-label-button', {hasText: 'Pending property node'}).click();
    const schema = page.locator('.node-editor-schema input[placeholder="Add property"]');
    await schema.fill('Flush before switch');
    await schema.press('Enter');
    await page.getByRole('button', {name: 'Next chapter'}).click();
    const dialog = page.getByRole('dialog', {name: 'Property edits are pending'});
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', {name: 'Wait for flush'}).click();
    await expect(page.getByRole('button', {name: 'Next chapter'})).toHaveClass(/chapter-nav-item-active/);
    const projection = await (
      await page.request.get(`http://127.0.0.1:${port}/api/projection?project=${initial.projectId}&chapter=${initial.chapterId}`)
    ).json();
    expect(projection.nodeSchemas[node.generatedIds[0]].map((property) => property.name)).toContain('Flush before switch');
  } finally {
    await context.close();
    if (serving) await serving.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('rapid property edits retain the local draft and persist schema and example values', async ({browser}) => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-project-property-edits-'));
  let serving;
  const context = await browser.newContext();
  try {
    const initial = command(dir, 'init');
    const node = command(dir, 'add-node', initial.chapterId, 'evt', '0', 'Property node');
    serving = startServeServer({root: dir, assets});
    const {port} = await serving.listening;
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.locator('.canvas .node-label-button', {hasText: 'Property node'}).click();
    const schema = page.locator('.node-editor-schema input[placeholder="Add property"]');
    await schema.fill('First property');
    await schema.press('Enter');
    await schema.fill('Second property');
    await schema.press('Enter');
    await expect
      .poll(() => page.locator('.node-editor-schema input').evaluateAll((inputs) => inputs.map((input) => input.value)))
      .toContain('First property');
    await expect
      .poll(() => page.locator('.node-editor-schema input').evaluateAll((inputs) => inputs.map((input) => input.value)))
      .toContain('Second property');
    await expect.poll(() => readFileSync(join(dir, '.slicr', 'events.ndjson'), 'utf8')).toContain('Second property');
    const projection = await (await page.request.get(`http://127.0.0.1:${port}/api/projection?project=${initial.projectId}`)).json();
    expect(projection.nodeSchemas[node.generatedIds[0]].map((property) => property.name)).toEqual(['First property', 'Second property']);

    await schema.fill('Conflict property');
    await schema.press('Enter');
    command(dir, 'rename-node', node.generatedIds[0], 'Renamed during property save');
    await expect(page.getByRole('alert')).toContainText('Property edit was not saved');
    await expect(page.getByRole('alert')).toContainText('redo the edit');
    await expect
      .poll(async () => {
        const latest = await (await page.request.get(`http://127.0.0.1:${port}/api/projection?project=${initial.projectId}`)).json();
        return latest.nodeSchemas[node.generatedIds[0]].map((property) => property.name);
      })
      .toEqual(['First property', 'Second property']);
    await expect(schema).not.toHaveValue('Conflict property');
  } finally {
    await context.close();
    if (serving) await serving.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('a newer property draft survives a failed in-flight write and can be retried', async ({browser}) => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-project-property-retry-'));
  let serving;
  const context = await browser.newContext();
  try {
    const initial = command(dir, 'init');
    command(dir, 'add-node', initial.chapterId, 'evt', '0', 'Property node');
    serving = startServeServer({root: dir, assets});
    const {port} = await serving.listening;
    const page = await context.newPage();
    let failedFirstWrite = false;
    let signalFirstWrite;
    const firstWriteStarted = new Promise((resolve) => {
      signalFirstWrite = resolve;
    });
    await page.route('**/api/command', async (route) => {
      if (!failedFirstWrite) {
        failedFirstWrite = true;
        signalFirstWrite();
        await new Promise((resolve) => setTimeout(resolve, 450));
        await route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({error: 'Temporary failure'})});
        return;
      }
      await route.continue();
    });
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.locator('.canvas .node-label-button', {hasText: 'Property node'}).click();
    const schema = page.locator('.node-editor-schema input[placeholder="Add property"]');
    await schema.fill('First draft');
    await schema.press('Enter');
    await firstWriteStarted;
    await schema.fill('Newer draft');
    await schema.press('Enter');
    await expect.poll(() => readFileSync(join(dir, '.slicr', 'events.ndjson'), 'utf8')).toContain('Newer draft');
    await expect(page.getByRole('alert')).toContainText('Temporary failure');
    const projection = await (await page.request.get(`http://127.0.0.1:${port}/api/projection?project=${initial.projectId}`)).json();
    expect(projection.nodeSchemas[Object.keys(projection.nodeSchemas)[0]].map((property) => property.name)).toEqual([
      'First draft',
      'Newer draft',
    ]);
  } finally {
    await context.close();
    if (serving) await serving.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('a CLI property update after a successful served save replaces the acknowledged local draft', async ({browser}) => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-project-property-cli-catchup-'));
  let serving;
  const context = await browser.newContext();
  try {
    const initial = command(dir, 'init');
    const node = command(dir, 'add-node', initial.chapterId, 'evt', '0', 'Property node');
    serving = startServeServer({root: dir, assets});
    const {port} = await serving.listening;
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.locator('.canvas .node-label-button', {hasText: 'Property node'}).click();
    const schema = page.locator('.node-editor-schema input[placeholder="Add property"]');
    await schema.fill('First property');
    await schema.press('Enter');
    await expect.poll(() => readFileSync(join(dir, '.slicr', 'events.ndjson'), 'utf8')).toContain('First property');

    const projection = await (await page.request.get(`http://127.0.0.1:${port}/api/projection?project=${initial.projectId}`)).json();
    const model = await (await page.request.get(`http://127.0.0.1:${port}/api/model`)).json();
    const response = await page.request.post(`http://127.0.0.1:${port}/api/command`, {
      data: {
        projectId: initial.projectId,
        baseRevision: model.revision,
        type: 'ChangeNodeProperties',
        data: {
          nodeId: node.generatedIds[0],
          schema: [{propertyId: projection.nodeSchemas[node.generatedIds[0]][0].propertyId, name: 'CLI updated property', type: 'string'}],
          exampleValues: [],
        },
      },
    });
    expect(response.ok()).toBe(true);
    await expect(page.locator('.node-editor-schema input[placeholder="propertyName"]')).toHaveValue('CLI updated property', {
      timeout: 5000,
    });
  } finally {
    await context.close();
    if (serving) await serving.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('project editor preserves focused details, keyboard navigation, and label cancel/outside-save behavior', async ({browser}) => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-project-interactions-'));
  let serving;
  const context = await browser.newContext();
  try {
    const initial = command(dir, 'init');
    const source = command(dir, 'add-node', initial.chapterId, 'evt', '0', 'Source event');
    const target = command(dir, 'add-node', initial.chapterId, 'cmd', '1', 'Target command');
    command(dir, 'connect-nodes', source.generatedIds[0], target.generatedIds[0]);
    serving = startServeServer({root: dir, assets});
    const {port} = await serving.listening;
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    const sourceLabel = page.locator('.canvas .node-label-button', {hasText: 'Source event'});
    await sourceLabel.click();
    await expect(page.getByLabel('Focused node details')).toContainText('Source event');
    await expect(page.locator('.node-detail-panel')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.node-box.node-focused .node-label-button')).toHaveText('Target command');
    const original = readFileSync(join(dir, '.slicr', 'events.ndjson'), 'utf8');
    await page.keyboard.press('Enter');
    const edit = page.getByRole('textbox', {name: 'Edit Target command label'});
    await expect(edit).toBeVisible();
    await edit.fill('Cancelled name');
    await edit.press('Escape');
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Target command'})).toBeVisible();
    expect(readFileSync(join(dir, '.slicr', 'events.ndjson'), 'utf8')).toBe(original);
    await page.locator('.canvas').click({position: {x: 30, y: 220}});
    await page.locator('.canvas .node-label-button', {hasText: 'Target command'}).dblclick();
    await page.getByRole('textbox', {name: 'Edit Target command label'}).fill('Saved outside');
    await page.locator('.canvas').click({position: {x: 30, y: 220}});
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Saved outside'})).toBeVisible();
    const history = readFileSync(join(dir, '.slicr', 'events.ndjson'), 'utf8');
    expect((history.match(/NodeRenamed/g) ?? []).length).toBe(1);
  } finally {
    await context.close();
    if (serving) await serving.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('a delayed projection for an old chapter cannot replace the newly selected chapter', async ({browser}) => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-project-scope-race-'));
  let serving;
  const context = await browser.newContext();
  try {
    const initial = command(dir, 'init');
    command(dir, 'add-node', initial.chapterId, 'evt', '0', 'First chapter node');
    const secondChapter = command(dir, 'add-chapter', 'Second chapter');
    command(dir, 'add-node', secondChapter.generatedIds[0], 'cmd', '1', 'Second chapter node');
    serving = startServeServer({root: dir, assets});
    const {port} = await serving.listening;
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await expect(page.locator('.canvas .node-label-button', {hasText: 'First chapter node'})).toBeVisible();

    let releaseOldResponse;
    const delayed = new Promise((resolve) => (releaseOldResponse = resolve));
    let oldRequestStarted;
    const oldRequestStartedPromise = new Promise((resolve) => (oldRequestStarted = resolve));
    await page.route('**/api/projection**', async (route) => {
      if (new URL(route.request().url()).searchParams.get('chapter') !== initial.chapterId) return route.continue();
      const response = await route.fetch();
      oldRequestStarted();
      await delayed;
      await route.fulfill({response});
    });
    await page.getByRole('button', {name: 'Default Chapter'}).click();
    await oldRequestStartedPromise;
    await page.getByRole('button', {name: 'Second chapter'}).click();
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Second chapter node'})).toBeVisible();
    releaseOldResponse();
    await expect(page.locator('.canvas .node-label-button', {hasText: 'First chapter node'})).toHaveCount(0);
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Second chapter node'})).toBeVisible();
  } finally {
    await context.close();
    if (serving) await serving.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('stale edit conflict guidance remains visible after successful background polling', async ({browser}) => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-project-browser-conflict-'));
  let serving;
  const context = await browser.newContext();
  try {
    const initial = command(dir, 'init');
    const node = command(dir, 'add-node', initial.chapterId, 'evt', '0', 'Original label');
    serving = startServeServer({root: dir, assets});
    const {port} = await serving.listening;
    const base = `http://127.0.0.1:${port}`;
    const model = await (await fetch(`${base}/api/model`)).json();
    const projection = await (await fetch(`${base}/api/projection?project=${initial.projectId}`)).json();
    const page = await context.newPage();
    await page.goto(`${base}/`);
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Original label'})).toBeVisible();
    let refreshResponses = 0;
    await page.route('**/api/model', async (route) => {
      refreshResponses += 1;
      await route.fulfill({json: model});
    });
    await page.route('**/api/projection**', async (route) => {
      refreshResponses += 1;
      await route.fulfill({json: projection});
    });

    command(dir, 'rename-node', node.generatedIds[0], 'Changed by CLI');
    await page.locator('.canvas .node-label-button', {hasText: 'Original label'}).dblclick();
    const editor = page.getByRole('textbox', {name: 'Edit Original label label'});
    await editor.fill('Stale browser edit');
    await editor.press('Enter');
    await expect(page.getByRole('alert')).toContainText('changed since this editor view was loaded');
    const pollsAtConflict = refreshResponses;
    await expect.poll(() => refreshResponses).toBeGreaterThan(pollsAtConflict);
    await expect(page.getByRole('alert')).toContainText('changed since this editor view was loaded');
    await page.unrouteAll({behavior: 'wait'});
    const retryEditor = page.getByRole('textbox', {name: 'Edit Changed by CLI label'});
    await expect(retryEditor).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('changed since this editor view was loaded');
    await retryEditor.fill('Browser retry succeeded');
    await retryEditor.press('Enter');
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Browser retry succeeded'})).toBeVisible();
  } finally {
    await context.close();
    if (serving) await serving.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('a delayed background poll cannot overwrite a newer post-write projection', async ({browser}) => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-project-browser-order-'));
  let serving;
  const context = await browser.newContext();
  try {
    const initial = command(dir, 'init');
    command(dir, 'add-node', initial.chapterId, 'evt', '0', 'Before edit');
    serving = startServeServer({root: dir, assets});
    const {port} = await serving.listening;
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Before edit'})).toBeVisible();

    let releasePoll;
    const waitToRelease = new Promise((resolve) => (releasePoll = resolve));
    let pollStarted;
    const pollStartedPromise = new Promise((resolve) => (pollStarted = resolve));
    let pollFinished;
    const pollFinishedPromise = new Promise((resolve) => (pollFinished = resolve));
    let holdFirstPoll = true;
    await page.route('**/api/projection**', async (route) => {
      if (!holdFirstPoll) return route.continue();
      holdFirstPoll = false;
      const staleResponse = await route.fetch();
      pollStarted();
      await waitToRelease;
      await route.fulfill({response: staleResponse});
      pollFinished();
    });
    await pollStartedPromise;

    await page.locator('.canvas .node-label-button', {hasText: 'Before edit'}).dblclick();
    const editor = page.getByRole('textbox', {name: 'Edit Before edit label'});
    await editor.fill('After edit');
    await editor.press('Enter');
    await expect(page.locator('.canvas .node-label-button', {hasText: 'After edit'})).toBeVisible();
    releasePoll();
    await pollFinishedPromise;
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.locator('.canvas .node-label-button', {hasText: 'After edit'})).toBeVisible();
    expect(readFileSync(join(dir, '.slicr', 'events.ndjson'), 'utf8')).toContain('After edit');
  } finally {
    await context.close();
    if (serving) await serving.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('a superseded poll failure does not mask a successful write refresh', async ({browser}) => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-project-browser-old-poll-error-'));
  let serving;
  const context = await browser.newContext();
  try {
    const initial = command(dir, 'init');
    command(dir, 'add-node', initial.chapterId, 'evt', '0', 'Before edit');
    serving = startServeServer({root: dir, assets});
    const {port} = await serving.listening;
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Before edit'})).toBeVisible();

    let releasePoll;
    const waitToRelease = new Promise((resolve) => (releasePoll = resolve));
    let pollStarted;
    const pollStartedPromise = new Promise((resolve) => (pollStarted = resolve));
    let pollFinished;
    const pollFinishedPromise = new Promise((resolve) => (pollFinished = resolve));
    let holdFirstPoll = true;
    await page.route('**/api/projection**', async (route) => {
      if (!holdFirstPoll) return route.continue();
      holdFirstPoll = false;
      pollStarted();
      await waitToRelease;
      await route.fulfill({status: 503, json: {error: 'superseded poll failure'}});
      pollFinished();
    });
    await pollStartedPromise;

    await page.locator('.canvas .node-label-button', {hasText: 'Before edit'}).dblclick();
    const editor = page.getByRole('textbox', {name: 'Edit Before edit label'});
    await editor.fill('Write refresh wins');
    await editor.press('Enter');
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Write refresh wins'})).toBeVisible();
    releasePoll();
    await pollFinishedPromise;
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Write refresh wins'})).toBeVisible();
  } finally {
    await context.close();
    if (serving) await serving.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('a successful edit with a failed refresh is not reported as a failed save', async ({browser}) => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-project-browser-refresh-error-'));
  let serving;
  const context = await browser.newContext();
  try {
    const initial = command(dir, 'init');
    command(dir, 'add-node', initial.chapterId, 'evt', '0', 'Before edit');
    serving = startServeServer({root: dir, assets});
    const {port} = await serving.listening;
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Before edit'})).toBeVisible();
    let failNextProjection = false;
    await page.route('**/api/command', async (route) => {
      const response = await route.fetch();
      if (response.ok()) failNextProjection = true;
      await route.fulfill({response});
    });
    await page.route('**/api/projection**', async (route) => {
      if (failNextProjection) {
        failNextProjection = false;
        await route.fulfill({status: 503, json: {error: 'simulated refresh outage'}});
      } else {
        await route.continue();
      }
    });
    await page.locator('.canvas .node-label-button', {hasText: 'Before edit'}).dblclick();
    const editor = page.getByRole('textbox', {name: 'Edit Before edit label'});
    await editor.fill('Persisted edit');
    await editor.press('Enter');
    await expect(page.getByRole('alert')).toContainText('Edit saved, but project refresh failed');
    await expect(page.getByRole('alert')).not.toContainText('Could not save edit');
    await expect(page.locator('.canvas')).toBeVisible();
    await expect(page.getByRole('button', {name: 'Add node', exact: true})).toBeVisible();
    expect(readFileSync(join(dir, '.slicr', 'events.ndjson'), 'utf8')).toContain('Persisted edit');
  } finally {
    await context.close();
    if (serving) await serving.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

test('missing and corrupt project history is explained without creating or rewriting it', async ({page}) => {
  const dir = mkdtempSync(join(tmpdir(), 'slicr-project-browser-errors-'));
  const serving = startServeServer({root: dir, assets});
  try {
    const {port} = await serving.listening;
    await page.goto(`http://127.0.0.1:${port}/`);
    await expect(page.getByRole('alert')).toContainText('No Slicr model');
    command(dir, 'init');
    const history = join(dir, '.slicr', 'events.ndjson');
    writeFileSync(history, 'bad-json\n');
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('Invalid JSON');
    expect(readFileSync(history, 'utf8')).toBe('bad-json\n');
  } finally {
    await serving.close();
    rmSync(dir, {recursive: true, force: true});
  }
});
