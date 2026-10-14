// Node-only spike: import through @slicr/event-sourcing/sqlite, never the browser entrypoint.
import {DatabaseSync} from 'node:sqlite';
import {linkSync, mkdirSync, mkdtempSync, rmSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Query, type SequencePosition} from './query.ts';
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

const APPLICATION_ID = 0x534c4352; // SLCR
const FORMAT_VERSION = 1;
const STORE_DIR = '.slicr';
const FILE = 'events.sqlite';

type Row = {position: number; event_json: string};

/** A missing store is never created by open. Only initialize creates .slicr/events.sqlite. */
export class SqliteSpecEventStore<E extends Event> implements SpecEventStore<E> {
  private readonly subscriptions = new Set<{query: Query; listener: AppendedEventsListener<E>}>();

  private readonly database: DatabaseSync;

  private constructor(database: DatabaseSync) {
    this.database = database;
  }

  static open<E extends Event>(projectDirectory: string): SqliteSpecEventStore<E> {
    const path = join(projectDirectory, STORE_DIR, FILE);
    // SQLite's URI mode=rw is an atomic writable, no-create open (unlike DatabaseSync(path)).
    const url = pathToFileURL(path);
    url.searchParams.set('mode', 'rw');
    let db: DatabaseSync;
    try {
      db = new DatabaseSync(url.href, {timeout: 5000});
    } catch (error) {
      throw new Error(`No Slicr event store at ${path}; initialize it explicitly first: ${String(error)}`, {cause: error});
    }
    try {
      verify(db);
      return new SqliteSpecEventStore<E>(db);
    } catch (error) {
      db.close();
      throw new Error(`Invalid or corrupt Slicr event store at ${path}: ${String(error)}`, {cause: error});
    }
  }

  static initialize<E extends Event>(projectDirectory: string): SqliteSpecEventStore<E> {
    const directory = join(projectDirectory, STORE_DIR);
    const path = join(directory, FILE);
    mkdirSync(directory, {recursive: true});
    // Build privately, then publish with an atomic no-clobber hard link. Neither a
    // competing initializer nor a pre-existing database is opened or modified.
    const stagingDirectory = mkdtempSync(join(directory, '.events-init-'));
    const stagedPath = join(stagingDirectory, FILE);
    try {
      const staged = new DatabaseSync(stagedPath, {timeout: 5000});
      try {
        staged.exec(`PRAGMA journal_mode=DELETE;
          BEGIN IMMEDIATE;
          PRAGMA application_id=${APPLICATION_ID};
          PRAGMA user_version=${FORMAT_VERSION};
          CREATE TABLE events (position INTEGER PRIMARY KEY, event_json TEXT NOT NULL);
          COMMIT;`);
      } finally {
        staged.close();
      }
      const identity = statSync(stagedPath);
      try {
        linkSync(stagedPath, path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new Error(`Slicr event store already exists at ${path}; refusing to overwrite`, {cause: error});
        }
        throw error;
      }
      // Do not hand out a connection to a different file if the published path was replaced.
      const published = statSync(path);
      if (published.dev !== identity.dev || published.ino !== identity.ino)
        throw new Error(`Slicr event store changed during initialization at ${path}`);
      const store = SqliteSpecEventStore.open<E>(projectDirectory);
      const current = statSync(path);
      if (current.dev !== identity.dev || current.ino !== identity.ino) {
        store.close();
        throw new Error(`Slicr event store changed during initialization at ${path}`);
      }
      return store;
    } finally {
      rmSync(stagingDirectory, {recursive: true, force: true});
    }
  }

  close(): void {
    this.database.close();
    this.subscriptions.clear();
  }

  async read(options: ReadOptions = {}): Promise<readonly SequencedEvent<E>[]> {
    const rows = this.database
      .prepare('SELECT position, event_json FROM events WHERE position > ? ORDER BY position')
      .all(options.from ?? 0) as Row[];
    return parseRows<E>(rows);
  }

  async query(query: Query, options: ReadOptions = {}): Promise<readonly SequencedEvent<E>[]> {
    return filterSequencedEventsByQuery(await this.read(options), query);
  }

  async append(events: readonly E[], condition?: AppendCondition): Promise<readonly SequencedEvent<E>[]> {
    if (events.length === 0) return [];
    // Serialize before BEGIN, so a bad event cannot leave a transaction open.
    const serialized = events.map((event) => {
      const json = JSON.stringify(event);
      if (json === undefined) throw new Error('Cannot serialize Slicr event');
      return json;
    });
    const db = this.database;
    let appended: SequencedEvent<E>[] = [];
    db.exec('BEGIN IMMEDIATE');
    try {
      if (condition) {
        // Do not yield while this connection holds a transaction: another append on
        // this instance could otherwise attempt a nested BEGIN IMMEDIATE.
        const rows = db
          .prepare('SELECT position, event_json FROM events WHERE position > ? ORDER BY position')
          .all(condition.after ?? 0) as Row[];
        const conflictingEvents = filterSequencedEventsByQuery(parseRows<E>(rows), condition.failIfEventsMatch);
        if (conflictingEvents.length) throw new AppendConditionFailedError(condition, conflictingEvents);
      }
      const next = db.prepare('SELECT COALESCE(MAX(position), 0) AS position FROM events').get() as {position: number};
      const insert = db.prepare('INSERT INTO events (position, event_json) VALUES (?, ?)');
      appended = events.map((event, i) => {
        const position = next.position + i + 1;
        insert.run(position, serialized[i]!);
        return {position, event};
      });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    await Promise.allSettled(
      [...this.subscriptions].map(async ({query, listener}) => {
        const matches = filterSequencedEventsByQuery(appended, query);
        if (matches.length) await listener(matches);
      }),
    );
    return appended;
  }

  subscribe(query: Query, listener: AppendedEventsListener<E>): StoreSubscription {
    const subscription = {query, listener};
    this.subscriptions.add(subscription);
    return {
      unsubscribe: () => {
        this.subscriptions.delete(subscription);
      },
    };
  }
}

function parseRows<E extends Event>(rows: Row[]): SequencedEvent<E>[] {
  return rows.map(({position, event_json}) => {
    try {
      const event = JSON.parse(event_json) as E;
      if (!event || typeof event.type !== 'string' || !Array.isArray(event.tags)) throw new Error('invalid event shape');
      return {position: position as SequencePosition, event};
    } catch (error) {
      throw new Error(`Corrupt Slicr event at position ${position}: ${String(error)}`);
    }
  });
}

function verify(db: DatabaseSync): void {
  const id = (db.prepare('PRAGMA application_id').get() as {application_id: number}).application_id;
  const version = (db.prepare('PRAGMA user_version').get() as {user_version: number}).user_version;
  if (id !== APPLICATION_ID || version !== FORMAT_VERSION) {
    throw new Error(`Incompatible Slicr event store format: application_id=${id}, version=${version}; expected SLCR v${FORMAT_VERSION}`);
  }
  const check = db.prepare('PRAGMA quick_check').get() as {quick_check: string};
  if (check.quick_check !== 'ok') throw new Error(`Corrupt Slicr event store: ${check.quick_check}`);
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='events'").get() as {sql: string} | undefined;
  if (!table || !/^CREATE TABLE events \(position INTEGER PRIMARY KEY, event_json TEXT NOT NULL\)$/i.test(table.sql)) {
    throw new Error('Incompatible Slicr event store: events table schema differs from v1');
  }
  const trigger = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='events' LIMIT 1").get() as
    {name: string} | undefined;
  if (trigger) throw new Error(`Incompatible Slicr event store: unexpected trigger on events: ${trigger.name}`);
}
