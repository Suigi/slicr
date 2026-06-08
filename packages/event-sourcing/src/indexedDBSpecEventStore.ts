import {type Query, type SequencePosition} from './query';
import {matchesQueryItem} from './queryMatcher';
import {
  AppendConditionFailedError,
  type AppendCondition,
  type ReadOptions,
  type SequencedEvent,
  type SpecEventStore,
} from './specStore';
import type {Event} from './types';

type StoredEvent<E extends Event> = {
  readonly streamName: string;
  readonly event: E;
};

export type IndexedDBSpecEventStoreOptions = {
  readonly databaseName: string;
  readonly streamName: string;
};

export class IndexedDBSpecEventStore<E extends Event> implements SpecEventStore<E> {
  private static readonly storeName = 'events';

  private readonly database: IDBDatabase;
  private readonly streamName: string;

  private constructor(database: IDBDatabase, streamName: string) {
    this.database = database;
    this.streamName = streamName;
  }

  static async create<E extends Event>(options: IndexedDBSpecEventStoreOptions): Promise<IndexedDBSpecEventStore<E>> {
    const database = await openDatabase(options.databaseName);
    return new IndexedDBSpecEventStore<E>(database, options.streamName);
  }

  async read(options: ReadOptions = {}): Promise<readonly SequencedEvent<E>[]> {
    return this.readSequencedEvents(options.from);
  }

  async query(query: Query, options: ReadOptions = {}): Promise<readonly SequencedEvent<E>[]> {
    const events = await this.readSequencedEvents(options.from);
    if (query.kind === 'none') {
      return [];
    }

    if (query.kind === 'all') {
      return events;
    }

    return events.filter(sequencedEvent => query.items.some(queryItem => matchesQueryItem(queryItem, sequencedEvent.event)));
  }

  async append(events: readonly E[], condition?: AppendCondition): Promise<readonly SequencedEvent<E>[]> {
    if (events.length === 0) {
      return [];
    }

    const transaction = this.database.transaction(IndexedDBSpecEventStore.storeName, 'readwrite');
    const objectStore = transaction.objectStore(IndexedDBSpecEventStore.storeName);

    return await new Promise<readonly SequencedEvent<E>[]>((resolve, reject) => {
      const appendedEvents: SequencedEvent<E>[] = [];
      const conflictingEvents: SequencedEvent<E>[] = [];
      let settled = false;

      const settleResolve = (value: readonly SequencedEvent<E>[]): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value);
      };

      const settleReject = (error: Error): void => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      };

      transaction.oncomplete = () => {
        settleResolve(appendedEvents);
      };
      transaction.onerror = () => {
        settleReject(transaction.error ?? new Error('IndexedDB transaction failed'));
      };
      transaction.onabort = () => {
        settleReject(transaction.error ?? new Error('IndexedDB transaction aborted'));
      };

      const queueAppends = (): void => {
        events.forEach((event, index) => {
          const request = objectStore.add({streamName: this.streamName, event});
          request.onsuccess = () => {
            appendedEvents[index] = {
              position: request.result as SequencePosition,
              event,
            };
          };
          request.onerror = () => {
            settleReject(request.error ?? new Error('Failed to append IndexedDB events'));
          };
        });
      };

      if (condition === undefined) {
        queueAppends();
        return;
      }

      const request = objectStore.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor === null) {
          if (conflictingEvents.length > 0) {
            transaction.abort();
            settleReject(new AppendConditionFailedError(condition, conflictingEvents));
            return;
          }

          queueAppends();
          return;
        }

        const storedEvent = cursor.value as StoredEvent<E>;
        const position = cursor.key as SequencePosition;
        if (storedEvent.streamName === this.streamName && isConflicting(storedEvent.event, position, condition)) {
          conflictingEvents.push({position, event: storedEvent.event});
        }
        cursor.continue();
      };
      request.onerror = () => {
        settleReject(request.error ?? new Error('Failed to inspect IndexedDB events'));
      };
    });
  }

  private async readSequencedEvents(from?: SequencePosition): Promise<readonly SequencedEvent<E>[]> {
    const transaction = this.database.transaction(IndexedDBSpecEventStore.storeName, 'readonly');
    const objectStore = transaction.objectStore(IndexedDBSpecEventStore.storeName);
    const events: SequencedEvent<E>[] = [];

    await new Promise<void>((resolve, reject) => {
      const request = objectStore.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor === null) {
          resolve();
          return;
        }

        const storedEvent = cursor.value as StoredEvent<E>;
        const position = cursor.key as SequencePosition;
        if (storedEvent.streamName === this.streamName && (from === undefined || position > from)) {
          events.push({position, event: storedEvent.event});
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to read IndexedDB spec events'));
    });

    await waitForTransaction(transaction);
    return events;
  }
}

const openDatabase = (databaseName: string): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName, 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore(IndexedDBSpecEventStore['storeName'], {autoIncrement: true});
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error(`Failed to open IndexedDB database ${databaseName}`));
});

const waitForTransaction = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
});

const isConflicting = <E extends Event>(event: E, position: SequencePosition, condition: AppendCondition): boolean => {
  if (condition.after !== undefined && position <= condition.after) {
    return false;
  }

  if (condition.failIfEventsMatch.kind === 'none') {
    return false;
  }

  if (condition.failIfEventsMatch.kind === 'all') {
    return true;
  }

  return condition.failIfEventsMatch.items.some(queryItem => matchesQueryItem(queryItem, event));
};
