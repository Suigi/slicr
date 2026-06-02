import {type Query, type QueryItem} from './query';
import type {Event} from './types';

type StoredEvent<E extends Event> = {
  readonly streamName: string;
  readonly event: E;
};

export type IndexedDBEventStoreOptions = {
  readonly databaseName: string;
  readonly streamName: string;
};

export class IndexedDBEventStore<E extends Event> {
  private static readonly storeName = 'events';

  private readonly database: IDBDatabase;
  private readonly streamName: string;

  private constructor(database: IDBDatabase, streamName: string) {
    this.database = database;
    this.streamName = streamName;
  }

  static async create<E extends Event>(options: IndexedDBEventStoreOptions): Promise<IndexedDBEventStore<E>> {
    const database = await openDatabase(options.databaseName);
    return new IndexedDBEventStore<E>(database, options.streamName);
  }

  async append(events: E | readonly E[]): Promise<void> {
    const eventsToAppend = Array.isArray(events) ? events : [events];
    if (eventsToAppend.length === 0) {
      return;
    }

    const transaction = this.database.transaction(IndexedDBEventStore.storeName, 'readwrite');
    const objectStore = transaction.objectStore(IndexedDBEventStore.storeName);
    for (const event of eventsToAppend) {
      objectStore.add({streamName: this.streamName, event});
    }
    await waitForTransaction(transaction);
  }

  async readAll(): Promise<E[]> {
    const transaction = this.database.transaction(IndexedDBEventStore.storeName, 'readonly');
    const objectStore = transaction.objectStore(IndexedDBEventStore.storeName);
    const events: E[] = [];

    await new Promise<void>((resolve, reject) => {
      const request = objectStore.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor === null) {
          resolve();
          return;
        }

        const storedEvent = cursor.value as StoredEvent<E>;
        if (storedEvent.streamName === this.streamName) {
          events.push(storedEvent.event);
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to read IndexedDB events'));
    });

    await waitForTransaction(transaction);
    return events;
  }

  async query(query: Query): Promise<E[]> {
    if (query.kind === 'none') {
      return [];
    }

    const events = await this.readAll();
    if (query.kind === 'all') {
      return events;
    }

    return events.filter(event => query.items.some(queryItem => matches(queryItem, event)));
  }

  async clear(): Promise<void> {
    const transaction = this.database.transaction(IndexedDBEventStore.storeName, 'readwrite');
    const objectStore = transaction.objectStore(IndexedDBEventStore.storeName);

    await new Promise<void>((resolve, reject) => {
      const request = objectStore.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor === null) {
          resolve();
          return;
        }

        const storedEvent = cursor.value as StoredEvent<E>;
        if (storedEvent.streamName === this.streamName) {
          cursor.delete();
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to clear IndexedDB events'));
    });

    await waitForTransaction(transaction);
  }

  async replace(events: readonly E[]): Promise<void> {
    await this.clear();
    await this.append(events);
  }
}

const openDatabase = (databaseName: string): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName, 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore(IndexedDBEventStore['storeName'], {autoIncrement: true});
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error(`Failed to open IndexedDB database ${databaseName}`));
});

const waitForTransaction = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
});

const matches = <E extends Event>(queryItem: QueryItem, event: E): boolean => {
  const typeMatches = queryItem.types?.some(type => event.type === type) ?? true;
  const tagsMatch = queryItem.tags?.every(tag => event.tags.includes(tag)) ?? true;
  return typeMatches && tagsMatch;
};
