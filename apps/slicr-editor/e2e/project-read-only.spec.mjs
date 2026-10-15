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
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Other chapter node'})).toBeVisible();
    await expect(page.locator('.edge-layer .edge-line')).toHaveCount(1);
    await page.getByLabel('Chapter', {exact: true}).selectOption(initial.chapterId);
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Visible project event'})).toBeVisible();
    await expect(page.locator('.canvas .node-label-button', {hasText: 'Other chapter node'})).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Add node'})).toBeVisible();
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
