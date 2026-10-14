import {expect, test, type Page} from '@playwright/test';

test.use({permissions: ['clipboard-read', 'clipboard-write']});

const graph = (page: Page) => page.locator('.graph-workspace .node-box').filter({visible: true});
const node = (page: Page, label: string) => graph(page).filter({has: page.getByRole('button', {name: label, exact: true})});

async function addSlice(page: Page, label: string) {
  await page.getByRole('button', {name: '+ New Slice'}).click();
  const input = page.getByRole('textbox', {name: /Edit .* label/});
  await input.fill(label);
  await input.press('Enter');
  await expect(node(page, label)).toBeVisible();
}

async function selectProject(page: Page, name: string) {
  await page.getByRole('button', {name: /Current project:/}).click();
  await page.getByRole('option', {name, exact: true}).click();
  await expect(page.getByRole('button', {name: `Current project: ${name}`})).toBeVisible();
}

async function addProject(page: Page, name: string) {
  await page.getByRole('button', {name: /Current project:/}).click();
  await page.getByRole('option', {name: 'Add new Project ...'}).click();
  await page.locator('.project-switcher-option-add-input').fill(name);
  await page.getByRole('button', {name: 'Create project'}).click();
  // Creation adds a project but leaves selection on the current project.
  await selectProject(page, name);
}

async function openChapters(page: Page) {
  if (await page.getByRole('button', {name: 'Expand sidebar'}).isVisible()) {
    await page.getByRole('button', {name: 'Expand sidebar'}).click();
  }
}

async function addChapter(page: Page, title: string) {
  await openChapters(page);
  await page.getByRole('button', {name: 'Add chapter'}).click();
  await page.locator('.chapter-sidebar-create-input').fill(title);
  await page.getByRole('button', {name: 'Create chapter'}).click();
  await expect(page.locator('.chapter-nav-item-active')).toContainText(title);
}

async function backup(page: Page) {
  await page.getByRole('button', {name: 'Copy full event backup to clipboard'}).click();
  return await expect
    .poll(async () => {
      const text = await page.evaluate(() => navigator.clipboard.readText());
      try {
        const value = JSON.parse(text) as {version: number; events: unknown[]};
        return value.version === 1 && Array.isArray(value.events) ? text : '';
      } catch {
        return '';
      }
    })
    .not.toBe('');
}

async function backupText(page: Page) {
  await backup(page);
  return page.evaluate(() => navigator.clipboard.readText());
}

async function waitForLabelInBackup(page: Page, label: string) {
  await expect.poll(async () => (await backupText(page)).includes(`"${label}"`)).toBe(true);
}

test('opens a workspace, edits a real node and replays it after reload', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('button', {name: /Current project:/})).toBeVisible();
  await expect(page.locator('.graph-workspace')).toBeVisible();
  await openChapters(page);
  await expect(page.locator('.chapter-nav-item-active')).toBeVisible();
  await addSlice(page, 'Baseline first label');
  await node(page, 'Baseline first label').getByRole('button', {name: 'Baseline first label', exact: true}).dblclick();
  await page.getByRole('textbox', {name: 'Edit Baseline first label label'}).fill('Baseline edited label');
  await page.getByRole('textbox', {name: 'Edit Baseline first label label'}).press('Enter');
  await expect(node(page, 'Baseline edited label')).toBeVisible();
  await waitForLabelInBackup(page, 'Baseline edited label');
  await page.reload();
  await expect(node(page, 'Baseline edited label')).toBeVisible();
});

test('switches projects and chapters without leaking nodes, then reopens persisted scopes', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('button', {name: 'Current project: Default Project'})).toBeVisible();
  const firstProject = 'Default Project';
  await addSlice(page, 'First chapter node');
  await addChapter(page, 'Second chapter');
  await addSlice(page, 'Second chapter node');
  await expect(node(page, 'First chapter node')).toHaveCount(0);
  await addProject(page, 'Baseline second project');
  await addSlice(page, 'Other project node');
  await expect(node(page, 'Second chapter node')).toHaveCount(0);
  await waitForLabelInBackup(page, 'Other project node');
  await page.reload();
  await selectProject(page, 'Baseline second project');
  await expect(node(page, 'Other project node')).toBeVisible();
  await selectProject(page, firstProject);
  await openChapters(page);
  await page.getByRole('button', {name: /Second chapter/}).click();
  await expect(node(page, 'Second chapter node')).toBeVisible();
  await expect(node(page, 'Other project node')).toHaveCount(0);
  await page.locator('.chapter-nav-item').first().click();
  await expect(node(page, 'First chapter node')).toBeVisible();
  await expect(node(page, 'Second chapter node')).toHaveCount(0);
});

test('restores a clipboard backup and persists the restored state across reload', async ({page}) => {
  await page.goto('/');
  await addSlice(page, 'Kept before backup');
  await waitForLabelInBackup(page, 'Kept before backup');
  const captured = await backupText(page);
  const parsed = JSON.parse(captured) as {version: number; events: unknown[]};
  expect(parsed.version).toBe(1);
  expect(Array.isArray(parsed.events)).toBe(true);
  await addSlice(page, 'Discarded after backup');
  await waitForLabelInBackup(page, 'Discarded after backup');
  await page.evaluate((text) => navigator.clipboard.writeText(text), captured);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', {name: 'Restore full event backup from clipboard'}).click();
  await expect(node(page, 'Kept before backup')).toBeVisible();
  await expect(node(page, 'Discarded after backup')).toHaveCount(0);
  await page.reload();
  await expect(node(page, 'Kept before backup')).toBeVisible();
  await expect(node(page, 'Discarded after backup')).toHaveCount(0);
});
