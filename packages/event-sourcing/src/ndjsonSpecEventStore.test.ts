import {spawn} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {NdjsonSpecEventStore, type NdjsonCrashPoint} from './ndjsonSpecEventStore';
import {Query} from './query';

type TestEvent = {type: string; tags: string[]; payload: {writer: string}};
const directories: string[] = [];
const project = () => {
  const path = mkdtempSync(join(tmpdir(), 'slicr-ndjson-'));
  directories.push(path);
  return path;
};
const event = (writer: string): TestEvent => ({type: 'Changed', tags: ['same'], payload: {writer}});
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, {recursive: true, force: true})));
const log = (path: string) => join(path, '.slicr/events.ndjson');
const db = (path: string) => join(path, '.slicr/events-outbox.sqlite');

function crashAt(point: NdjsonCrashPoint) {
  return {
    crashAt: (actual: NdjsonCrashPoint) => {
      if (actual === point) throw new Error(`simulated ${point}`);
    },
  };
}

describe('NDJSON-authoritative outbox spike', () => {
  it('does not create artifacts when opening a missing model; initialization is explicit', async () => {
    const path = project();
    expect(() => NdjsonSpecEventStore.open(path)).toThrow(/initialize it explicitly/);
    expect(existsSync(join(path, '.slicr'))).toBe(false);
    const store = NdjsonSpecEventStore.initialize<TestEvent>(path);
    expect(await store.read()).toEqual([]);
    expect(() => NdjsonSpecEventStore.initialize(path)).toThrow();
    store.close();
  });

  it('replays batches in order after reopen; filters by revision and query', async () => {
    const path = project();
    const store = NdjsonSpecEventStore.initialize<TestEvent>(path);
    expect(await store.append([event('a'), event('b')])).toEqual([
      {position: 1, event: event('a')},
      {position: 2, event: event('b')},
    ]);
    await store.append([event('c')]);
    expect(await store.append([], {failIfEventsMatch: Query.all()})).toEqual([]);
    store.close();
    const reopened = NdjsonSpecEventStore.open<TestEvent>(path);
    expect(await reopened.read({from: 1})).toEqual([
      {position: 2, event: event('b')},
      {position: 3, event: event('c')},
    ]);
    expect(await reopened.query(Query.where({tags: ['same']}), {from: 2})).toEqual([{position: 3, event: event('c')}]);
    expect(readFileSync(log(path), 'utf8').trim().split('\n')).toHaveLength(2);
    reopened.close();
  });

  it.each(['afterStage', 'afterLogSync', 'afterAcknowledgement'] as const)('repairs crash point %s exactly once', async (point) => {
    const path = project();
    NdjsonSpecEventStore.initialize<TestEvent>(path).close();
    const store = NdjsonSpecEventStore.open<TestEvent>(path, crashAt(point));
    await expect(store.append([event('a'), event('b')])).rejects.toThrow(`simulated ${point}`);
    store.close();
    const reopened = NdjsonSpecEventStore.open<TestEvent>(path);
    expect(await reopened.read()).toEqual([
      {position: 1, event: event('a')},
      {position: 2, event: event('b')},
    ]);
    expect(readFileSync(log(path), 'utf8').trim().split('\n')).toHaveLength(1);
    const [batch] = readFileSync(log(path), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(batch.events.map((entry: {id: string}) => entry.id)).toEqual([`${batch.id}:0`, `${batch.id}:1`]);
    await reopened.append([event('c')]);
    expect((await reopened.read()).map(({position}) => position)).toEqual([1, 2, 3]);
    reopened.close();
  });

  it('refuses duplicate canonical batch IDs rather than replaying duplicate events', async () => {
    const path = project();
    const store = NdjsonSpecEventStore.initialize<TestEvent>(path);
    await store.append([event('a')]);
    store.close();
    const line = readFileSync(log(path), 'utf8');
    writeFileSync(log(path), line + line);
    expect(() => NdjsonSpecEventStore.open(path)).toThrow(/Invalid NDJSON batch/);
  });

  it('truncates only a matching torn final line with staged batch; fails closed without it', async () => {
    const path = project();
    NdjsonSpecEventStore.initialize<TestEvent>(path).close();
    const store = NdjsonSpecEventStore.open<TestEvent>(path, crashAt('afterStage'));
    await expect(store.append([event('a')])).rejects.toThrow();
    store.close();
    // A partial append after the stage commit is safely recognizable as a prefix of the staged line.
    const {DatabaseSync} = await import('node:sqlite');
    const sqlite = new DatabaseSync(db(path));
    const pending = sqlite.prepare('SELECT line FROM outbox').get() as {line: string};
    sqlite.close();
    writeFileSync(log(path), pending.line.slice(0, 37));
    const recovered = NdjsonSpecEventStore.open<TestEvent>(path);
    expect(await recovered.read()).toEqual([{position: 1, event: event('a')}]);
    recovered.close();
    writeFileSync(log(path), readFileSync(log(path), 'utf8') + '{"unexpected":');
    expect(() => NdjsonSpecEventStore.open(path)).toThrow(/Unrecoverable torn NDJSON tail/);
  });

  it('documents why deleting an outbox containing pending data loses an unpublished batch', async () => {
    const path = project();
    NdjsonSpecEventStore.initialize<TestEvent>(path).close();
    const store = NdjsonSpecEventStore.open<TestEvent>(path, crashAt('afterStage'));
    await expect(store.append([event('unpublished')])).rejects.toThrow();
    store.close();
    // This deliberately violates the quiescent/no-pending deletion precondition.
    rmSync(db(path));
    const rebuilt = NdjsonSpecEventStore.open<TestEvent>(path);
    expect(await rebuilt.read()).toEqual([]);
    rebuilt.close();
  });

  it('rebuilds the deleted runtime database from the canonical history after quiescence', async () => {
    const path = project();
    const store = NdjsonSpecEventStore.initialize<TestEvent>(path);
    await store.append([event('a')]);
    store.close();
    rmSync(db(path));
    const rebuilt = NdjsonSpecEventStore.open<TestEvent>(path);
    expect(await rebuilt.read()).toEqual([{position: 1, event: event('a')}]);
    await rebuilt.append([event('b')]);
    expect((await rebuilt.read()).map(({position}) => position)).toEqual([1, 2]);
    rebuilt.close();
  });

  it('serializes independent processes checking the same append condition', async () => {
    const path = project();
    NdjsonSpecEventStore.initialize<TestEvent>(path).close();
    function worker(writer: string) {
      const child = spawn(process.execPath, [
        '--experimental-strip-types',
        new URL('./ndjsonSpecEventStore.worker.mjs', import.meta.url).pathname,
        path,
        writer,
      ]);
      let output = '';
      const ready = new Promise<void>((resolve) =>
        child.stdout.on('data', (chunk: Buffer) => {
          output += chunk.toString();
          if (output.includes('ready\n')) resolve();
        }),
      );
      const result = new Promise<{ok: boolean; name?: string}>((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (code) => {
          if (code !== 0) reject(new Error(`worker exited ${code}: ${output}`));
          else resolve(JSON.parse(output.trim().split('\n').at(-1)!));
        });
      });
      return {child, ready, result};
    }
    const workers = [worker('a'), worker('b')];
    try {
      await Promise.all(workers.map((item) => item.ready));
      workers.forEach(({child}) => child.stdin.end('\n'));
      const results = await Promise.all(workers.map((item) => item.result));
      expect(results.filter(({ok}) => ok)).toHaveLength(1);
      expect(results.filter(({name}) => name === 'AppendConditionFailedError')).toHaveLength(1);
      const reopened = NdjsonSpecEventStore.open<TestEvent>(path);
      expect(await reopened.read()).toHaveLength(1);
      reopened.close();
    } finally {
      workers.forEach(({child}) => child.kill());
    }
  });
});
