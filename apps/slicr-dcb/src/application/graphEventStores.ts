import {
  type AppendCondition,
  IndexedDBEventStore,
  IndexedDBSpecEventStore,
  MemorySpecEventStore,
  Query,
  type ReadOptions,
  type SpecEventStore,
} from '@slicr/event-sourcing';
import type {DcbEvent} from '../domain/events';
import type {EventBackupAdminStore} from './eventBackup';

const EVENT_STORE_DATABASE_NAME = 'slicr-dcb.events.v1';
const EVENT_STORE_STREAM_NAME = 'graph';

let inMemoryGraphEventStore: InMemoryGraphEventStore | undefined;

class InMemoryGraphEventStore implements SpecEventStore<DcbEvent> {
  private store = MemorySpecEventStore.create<DcbEvent>();

  append(events: readonly DcbEvent[], condition?: AppendCondition) {
    return this.store.append(events, condition);
  }

  read(options?: ReadOptions) {
    return this.store.read(options);
  }

  query(query: Query, options?: ReadOptions) {
    return this.store.query(query, options);
  }

  subscribe(query: Query, listener: Parameters<SpecEventStore<DcbEvent>['subscribe']>[1]) {
    return this.store.subscribe(query, listener);
  }

  async readAll() {
    return (await this.store.read()).map(({event}) => event);
  }

  async restoreBackup(events: readonly DcbEvent[]) {
    this.store = MemorySpecEventStore.create<DcbEvent>();
    await this.store.append([...events]);
  }

  async clear() {
    this.store = MemorySpecEventStore.create<DcbEvent>();
  }
}

class IndexedDBEventBackupAdminStore implements EventBackupAdminStore {
  constructor(private readonly mutableStore: Pick<IndexedDBEventStore<DcbEvent>, 'replace'>) {}

  restoreBackup(events: readonly DcbEvent[]) {
    return this.mutableStore.replace(events);
  }
}

export async function createDefaultGraphEventStore(): Promise<{
  graphStore: EventBackupAdminStore;
  commandStore: SpecEventStore<DcbEvent>;
}> {
  if (typeof indexedDB === 'undefined') {
    inMemoryGraphEventStore ??= new InMemoryGraphEventStore();
    const store = inMemoryGraphEventStore;
    return {
      graphStore: {
        restoreBackup: (events) => store.restoreBackup(events),
      },
      commandStore: store,
    };
  }

  const [specStore, mutableStore] = await Promise.all([
    IndexedDBSpecEventStore.create<DcbEvent>({
      databaseName: EVENT_STORE_DATABASE_NAME,
      streamName: EVENT_STORE_STREAM_NAME,
    }),
    IndexedDBEventStore.create<DcbEvent>({
      databaseName: EVENT_STORE_DATABASE_NAME,
      streamName: EVENT_STORE_STREAM_NAME,
    }),
  ]);

  return {
    graphStore: new IndexedDBEventBackupAdminStore(mutableStore),
    commandStore: specStore,
  };
}
