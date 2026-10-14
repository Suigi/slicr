import {spawn, spawnSync, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {mkdirSync, mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {expectEmptyAppendIsNoOp} from './emptyAppendContract';
import {Query} from './query';
import {AppendConditionFailedError} from './specStore';
import {SqliteSpecEventStore} from './sqliteSpecEventStore';

type TestEvent = {type: string; payload: {writer: string}; tags: string[]};
const directories: string[] = [];
const project = () => {
  const path = mkdtempSync(join(tmpdir(), 'slicr-sqlite-'));
  directories.push(path);
  return path;
};
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, {recursive: true, force: true})));
const event = (writer: string): TestEvent => ({type: 'Changed', payload: {writer}, tags: ['same']});

describe('SqliteSpecEventStore spike', () => {
  it('does not initialize on discovery/read; explicit initialization creates versioned SQLite', async () => {
    const path = project();
    expect(() => SqliteSpecEventStore.open(path)).toThrow(/initialize it explicitly/);
    expect(existsSync(join(path, '.slicr'))).toBe(false);
    mkdirSync(join(path, '.slicr'));
    expect(() => SqliteSpecEventStore.open(path)).toThrow(/initialize it explicitly/);
    expect(existsSync(join(path, '.slicr/events.sqlite'))).toBe(false);
    const store = SqliteSpecEventStore.initialize<TestEvent>(path);
    expect(await store.read()).toEqual([]);
    expect(readFileSync(join(path, '.slicr/events.sqlite')).subarray(0, 16).toString()).toBe('SQLite format 3\0');
    expect(() => SqliteSpecEventStore.initialize(path)).toThrow(/already exists/);
    store.close();
  });

  it('serializes simultaneous conditional appends on the same connection', async () => {
    const store = SqliteSpecEventStore.initialize<TestEvent>(project());
    try {
      const results = await Promise.allSettled(['a', 'b'].map((writer) => store.append([event(writer)], {failIfEventsMatch: Query.all()})));
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const failure = results.find((result) => result.status === 'rejected');
      expect(failure).toMatchObject({reason: {name: 'AppendConditionFailedError', conflictingEvents: [{position: 1}]}});
      expect(await store.read()).toHaveLength(1);
      const positions = await Promise.all(['c', 'd'].map((writer) => store.append([event(writer)])));
      expect(positions.map(([entry]) => entry!.position)).toEqual([2, 3]);
    } finally {
      store.close();
    }
  });

  it('replays ordered positions across close and independent process restart', async () => {
    const path = project();
    const store = SqliteSpecEventStore.initialize<TestEvent>(path);
    expect(await store.append([event('a'), event('b')])).toEqual([
      {position: 1, event: event('a')},
      {position: 2, event: event('b')},
    ]);
    store.close();
    const process = spawnSync(
      processExec(),
      [
        '--experimental-strip-types',
        '--input-type=module',
        '-e',
        `import {SqliteSpecEventStore} from ${JSON.stringify(new URL('./sqliteSpecEventStore.ts', import.meta.url).href)};
       const s=SqliteSpecEventStore.open(${JSON.stringify(path)});
       console.log(JSON.stringify(await s.read()));
       await s.append([{type:'Changed',payload:{writer:'c'},tags:['same']}]); s.close();`,
      ],
      {encoding: 'utf8'},
    );
    expect(process.stderr).toBe('');
    expect(process.status).toBe(0);
    expect(JSON.parse(process.stdout)).toEqual([
      {position: 1, event: event('a')},
      {position: 2, event: event('b')},
    ]);
    const reopened = SqliteSpecEventStore.open<TestEvent>(path);
    expect(await reopened.read({from: 1})).toEqual([
      {position: 2, event: event('b')},
      {position: 3, event: event('c')},
    ]);
    expect(await reopened.query(Query.where({tags: ['same']}), {from: 2})).toEqual([{position: 3, event: event('c')}]);
    reopened.close();
  });

  it('atomically rejects a stale conditional append with conflicting events', async () => {
    const store = SqliteSpecEventStore.initialize<TestEvent>(project());
    await store.append([event('a')]);
    await expect(store.append([event('b')], {failIfEventsMatch: Query.where({tags: ['same']})})).rejects.toMatchObject({
      name: 'AppendConditionFailedError',
      conflictingEvents: [{position: 1, event: event('a')}],
    });
    expect(await store.read()).toHaveLength(1);
    await store.append([event('b')], {failIfEventsMatch: Query.all(), after: 1});
    await expect(store.append([event('c')], {failIfEventsMatch: Query.all(), after: 1})).rejects.toBeInstanceOf(AppendConditionFailedError);
    store.close();
  });

  it('rejects unexpected events triggers when opening a store', async () => {
    const path = project();
    SqliteSpecEventStore.initialize<TestEvent>(path).close();
    const {DatabaseSync} = await import('node:sqlite');
    const db = new DatabaseSync(join(path, '.slicr/events.sqlite'));
    try {
      db.exec("CREATE TRIGGER fail_second BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
    } finally {
      db.close();
    }
    expect(() => SqliteSpecEventStore.open<TestEvent>(path)).toThrow(/unexpected trigger on events: fail_second/);
  });

  it('treats an empty conditional append as an unconditional no-op', async () => {
    const store = SqliteSpecEventStore.initialize<TestEvent>(project());
    try {
      await expectEmptyAppendIsNoOp(store, event('a'));
    } finally {
      store.close();
    }
  });

  it('rejects foreign, incompatible, and corrupt formats clearly', async () => {
    const foreign = project();
    const {DatabaseSync} = await import('node:sqlite');
    const store = SqliteSpecEventStore.initialize<TestEvent>(foreign);
    store.close();
    const db = new DatabaseSync(join(foreign, '.slicr/events.sqlite'));
    db.exec('PRAGMA user_version=99');
    db.close();
    expect(() => SqliteSpecEventStore.open(foreign)).toThrow(/Incompatible Slicr event store format/);
    const corrupt = project();
    const corruptStore = SqliteSpecEventStore.initialize<TestEvent>(corrupt);
    corruptStore.close();
    writeFileSync(join(corrupt, '.slicr/events.sqlite'), 'not sqlite');
    expect(() => SqliteSpecEventStore.open(corrupt)).toThrow(/Invalid or corrupt Slicr event store/);
  });

  it('notifies local subscribers only after commit and ignores listener errors', async () => {
    const store = SqliteSpecEventStore.initialize<TestEvent>(project());
    const received: string[] = [];
    const subscription = store.subscribe(Query.where({tags: ['same']}), (events) => {
      received.push(events[0]!.event.payload.writer);
      throw new Error('listener failure');
    });
    await store.append([event('a')]);
    subscription.unsubscribe();
    await store.append([event('b')]);
    expect(received).toEqual(['a']);
    store.close();
  });

  it('publishes only one initialized database from competing processes', async () => {
    const path = project();
    const workers = ['a', 'b'].map((writer) => startWorker(path, writer, 'initialize'));
    try {
      await Promise.all(workers.map((worker) => worker.ready));
      workers.forEach((worker) => worker.process.stdin.end('\n'));
      const results = await Promise.all(workers.map((worker) => worker.result));
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toMatchObject([{ok: false, message: expect.stringMatching(/already exists/)}]);
      const store = SqliteSpecEventStore.open<TestEvent>(path);
      expect(await store.read()).toEqual([]);
      store.close();
    } finally {
      workers.forEach((worker) => worker.process.kill());
    }
  });

  it('does not claim or modify a database another actor created first', async () => {
    const path = project();
    mkdirSync(join(path, '.slicr'));
    const file = join(path, '.slicr/events.sqlite');
    writeFileSync(file, 'another actor owns this file');
    expect(() => SqliteSpecEventStore.initialize(path)).toThrow(/already exists/);
    expect(readFileSync(file, 'utf8')).toBe('another actor owns this file');
  });

  it('serializes conflicting conditional appends from independent processes', async () => {
    const path = project();
    SqliteSpecEventStore.initialize<TestEvent>(path).close();
    const workers = ['a', 'b'].map((writer) => startWorker(path, writer));
    try {
      await Promise.all(workers.map((worker) => worker.ready));
      workers.forEach((worker) => worker.process.stdin.end('\n'));
      const results = await Promise.all(workers.map((worker) => worker.result));
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toMatchObject([
        {ok: false, name: 'AppendConditionFailedError', conflictingEvents: [{position: 1}]},
      ]);
      const store = SqliteSpecEventStore.open<TestEvent>(path);
      expect(await store.read()).toHaveLength(1);
      store.close();
    } finally {
      workers.forEach((worker) => worker.process.kill());
    }
  });
});

const processExec = () => process.execPath;
type WorkerResult = {ok: boolean; name?: string; message?: string; conflictingEvents?: unknown[]};
function startWorker(
  path: string,
  writer: string,
  mode?: 'initialize',
): {
  process: ChildProcessWithoutNullStreams;
  ready: Promise<void>;
  result: Promise<WorkerResult>;
} {
  const child = spawn(
    processExec(),
    ['--experimental-strip-types', new URL('./sqliteSpecEventStore.worker.mjs', import.meta.url).pathname, path, writer, mode ?? 'append'],
    {stdio: 'pipe'},
  );
  let output = '';
  let readyResolve: () => void;
  const ready = new Promise<void>((resolve) => {
    readyResolve = resolve;
  });
  const result = new Promise<WorkerResult>((resolve, reject) => {
    child.stdout.on('data', (data: Buffer) => {
      output += data.toString();
      if (output.includes('ready\n')) readyResolve();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`worker exited ${code}: ${output}`));
      try {
        resolve(JSON.parse(output.trim().split('\n').at(-1)!));
      } catch (error) {
        reject(error);
      }
    });
  });
  return {process: child, ready, result};
}
