import {mkdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';

const [root, barrier, workerId] = process.argv.slice(2);
const [{NdjsonSpecEventStore}, {deciders}, {handleCommand}] = await Promise.all([
  import('../packages/event-sourcing/src/ndjsonSpecEventStore.ts'),
  import('../packages/slicr-core/src/projectCommands/projectCommandHandler.ts'),
  import('../packages/event-sourcing/src/deciders/index.ts'),
]);
const store = NdjsonSpecEventStore.open(root);
const gatedStore = Object.create(store);
gatedStore.query = async (...args) => {
  const result = await store.query(...args);
  mkdirSync(barrier, {recursive: true});
  const ready = join(barrier, workerId);
  await import('node:fs/promises').then(({writeFile}) => writeFile(ready, 'ready'));
  const deadline = Date.now() + 10_000;
  while (!existsSync(join(barrier, `release-${workerId}`))) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for release signal: ${workerId}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return result;
};
try {
  const appended = await handleCommand(gatedStore, deciders().renameProject, {
    type: 'RenameProject',
    data: {projectId: 'p1', name: `Renamed-${workerId}`},
  });
  process.stdout.write(JSON.stringify({result: 'success', appended: appended.length}));
} catch (error) {
  process.stdout.write(JSON.stringify({result: 'error', name: error.name, message: error.message}));
  process.exitCode = 1;
} finally {
  store.close();
}
