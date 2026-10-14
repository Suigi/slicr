// Node-only comparison spike. The NDJSON batch log is authoritative; SQLite holds only an in-flight batch.
import {randomUUID, createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, truncateSync, writeSync} from 'node:fs';
import {join} from 'node:path';
import {Query} from './query.ts';
import {filterSequencedEventsByQuery} from './queryMatcher.ts';
import {
  AppendConditionFailedError,
  type AppendCondition,
  type AppendedEventsListener,
  type ReadOptions,
  type SequencedEvent,
  type SpecEventStore,
  type StoreSubscription,
} from './specStore.ts';
import type {Event} from './types.ts';

const DIR = '.slicr';
const LOG = 'events.ndjson';
const DB = 'events-outbox.sqlite';
type Batch<E> = {v: 1; id: string; start: number; events: {id: string; event: E}[]; sha256: string};
type Pending = {line: string};
export type NdjsonCrashPoint = 'afterStage' | 'afterLogSync' | 'afterAcknowledgement';
export type NdjsonSpikeOptions = {crashAt?: (point: NdjsonCrashPoint) => void};

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function parseLog<E extends Event>(bytes: Buffer, firstPosition = 1): {batches: Batch<E>[]; tail: Buffer} {
  const batches: Batch<E>[] = [];
  let offset = 0;
  let next = firstPosition;
  const ids = new Set<string>();
  while (true) {
    const end = bytes.indexOf(10, offset);
    if (end < 0) break;
    let batch: Batch<E>;
    try {
      batch = JSON.parse(bytes.subarray(offset, end).toString('utf8')) as Batch<E>;
    } catch {
      throw new Error(`Corrupt NDJSON batch at byte ${offset}`);
    }
    const {v, id, start, events, sha256} = batch;
    if (
      v !== 1 ||
      typeof id !== 'string' ||
      !id ||
      ids.has(id) ||
      start !== next ||
      !Array.isArray(events) ||
      !events.length ||
      !events.every(
        (entry, index) =>
          entry.id === `${id}:${index}` && entry.event && typeof entry.event.type === 'string' && Array.isArray(entry.event.tags),
      ) ||
      sha256 !== digest({v, id, start, events})
    )
      throw new Error(`Invalid NDJSON batch at byte ${offset}`);
    batches.push(batch);
    ids.add(id);
    next += events.length;
    offset = end + 1;
  }
  return {batches, tail: bytes.subarray(offset)};
}

function entries<E extends Event>(batches: Batch<E>[]): SequencedEvent<E>[] {
  return batches.flatMap((batch) => batch.events.map(({event}, index) => ({position: batch.start + index, event})));
}

/** Experimental adapter: do not remove an outbox while a write may be in flight. */
export class NdjsonSpecEventStore<E extends Event> implements SpecEventStore<E> {
  private readonly subscribers = new Set<{query: Query; listener: AppendedEventsListener<E>}>();
  private readonly directory: string;
  private readonly db: DatabaseSync;
  private readonly options: NdjsonSpikeOptions;
  private constructor(directory: string, db: DatabaseSync, options: NdjsonSpikeOptions) {
    this.directory = directory;
    this.db = db;
    this.options = options;
  }

  static initialize<E extends Event>(project: string, options: NdjsonSpikeOptions = {}): NdjsonSpecEventStore<E> {
    const directory = join(project, DIR);
    mkdirSync(directory, {recursive: true});
    const file = join(directory, LOG);
    const fd = openSync(file, 'wx');
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    const dirFd = openSync(directory, 'r');
    try {
      fsyncSync(dirFd);
    } finally {
      closeSync(dirFd);
    }
    return this.open<E>(project, options);
  }

  static open<E extends Event>(project: string, options: NdjsonSpikeOptions = {}): NdjsonSpecEventStore<E> {
    const directory = join(project, DIR);
    if (!existsSync(join(directory, LOG))) throw new Error('Missing NDJSON event store; initialize it explicitly');
    // A runtime DB can be rebuilt only while all participants are stopped and no pending batch exists.
    const db = new DatabaseSync(join(directory, DB), {timeout: 5000});
    try {
      db.exec(
        'PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS outbox (slot INTEGER PRIMARY KEY CHECK(slot=1), line TEXT NOT NULL)',
      );
      const store = new NdjsonSpecEventStore<E>(directory, db, options);
      store.transaction(() => store.recover());
      return store;
    } catch (error) {
      db.close();
      throw error;
    }
  }

  close(): void {
    this.db.close();
    this.subscribers.clear();
  }

  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private recover(): Batch<E>[] {
    const file = join(this.directory, LOG);
    const bytes = readFileSync(file);
    const {batches, tail} = parseLog<E>(bytes);
    const pending = this.db.prepare('SELECT line FROM outbox WHERE slot=1').get() as Pending | undefined;
    if (tail.length) {
      // Only a prefix of the known staged batch is repairable. Arbitrary trailing data fails closed.
      if (!pending || !Buffer.from(pending.line).subarray(0, tail.length).equals(tail))
        throw new Error('Unrecoverable torn NDJSON tail (no matching staged batch)');
      const fd = openSync(file, 'r+');
      try {
        truncateSync(file, bytes.length - tail.length);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
    }
    if (pending) {
      let staged: Batch<E> | undefined;
      try {
        const candidate = JSON.parse(pending.line) as Batch<E>;
        staged = parseLog<E>(Buffer.from(pending.line), candidate.start).batches[0];
      } catch {
        throw new Error('Invalid staged batch');
      }
      if (!staged) throw new Error('Invalid staged batch');
      const existing = batches.find((batch) => batch.id === staged.id);
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(staged)) throw new Error('Staged batch differs from published batch');
      } else {
        const next = entries(batches).length + 1;
        if (staged.start !== next) throw new Error('Staged batch revision differs from canonical log');
        const fd = openSync(file, 'a');
        try {
          const data = Buffer.from(pending.line);
          let written = 0;
          while (written < data.length) written += writeSync(fd, data, written, data.length - written);
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        batches.push(staged);
        this.options.crashAt?.('afterLogSync');
      }
      this.db.prepare('DELETE FROM outbox WHERE slot=1').run();
      this.options.crashAt?.('afterAcknowledgement');
    }
    return batches;
  }

  async read(options: ReadOptions = {}): Promise<readonly SequencedEvent<E>[]> {
    return this.transaction(() => entries(this.recover()).filter(({position}) => position > (options.from ?? 0)));
  }
  async query(query: Query, options: ReadOptions = {}): Promise<readonly SequencedEvent<E>[]> {
    return filterSequencedEventsByQuery(await this.read(options), query);
  }
  async append(events: readonly E[], condition?: AppendCondition): Promise<readonly SequencedEvent<E>[]> {
    if (!events.length) return [];
    const copies = events.map((event) => {
      const copy = JSON.parse(JSON.stringify(event)) as E;
      if (!copy || typeof copy.type !== 'string' || !Array.isArray(copy.tags)) throw new Error('Invalid event');
      return copy;
    });
    const appended = this.transaction(() => {
      const current = entries(this.recover());
      if (condition) {
        const conflicting = filterSequencedEventsByQuery(
          current.filter(({position}) => position > (condition.after ?? 0)),
          condition.failIfEventsMatch,
        );
        if (conflicting.length) throw new AppendConditionFailedError(condition, conflicting);
      }
      const id = randomUUID();
      const fields = {v: 1 as const, id, start: current.length + 1, events: copies.map((event, i) => ({id: `${id}:${i}`, event}))};
      const batch: Batch<E> = {...fields, sha256: digest(fields)};
      const line = JSON.stringify(batch) + '\n';
      this.db.prepare('INSERT INTO outbox (slot, line) VALUES (1, ?)').run(line);
      // Stage must commit before publication, otherwise a crash can leave an unrepairable log.
      return batch;
    });
    // The lock is released between staging and publication. Other participants first
    // recover the staged row, so this caller must not publish a second copy.
    // A failed publish never reports success; a retry/reopen repairs the pending row.
    this.options.crashAt?.('afterStage');
    this.transaction(() => this.recover());
    const result = entries([appended]);
    await Promise.allSettled(
      [...this.subscribers].map(async ({query, listener}) => {
        const matches = filterSequencedEventsByQuery(result, query);
        if (matches.length) await listener(matches);
      }),
    );
    return result;
  }
  subscribe(query: Query, listener: AppendedEventsListener<E>): StoreSubscription {
    const subscription = {query, listener};
    this.subscribers.add(subscription);
    return {
      unsubscribe: () => {
        this.subscribers.delete(subscription);
      },
    };
  }
}
