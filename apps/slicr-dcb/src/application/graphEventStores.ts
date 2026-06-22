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
import type {AsyncGraphEventStore} from '../graph/eventSourcedGraphModel';

const EVENT_STORE_DATABASE_NAME = 'slicr-dcb.events.v1';
const EVENT_STORE_STREAM_NAME = 'graph';

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

  async readAll() {
    return (await this.store.read()).map(({event}) => event);
  }

  async replace(events: readonly DcbEvent[]) {
    this.store = MemorySpecEventStore.create<DcbEvent>();
    await this.store.append([...events]);
  }

  async clear() {
    this.store = MemorySpecEventStore.create<DcbEvent>();
  }
}

class IndexedDBAsyncGraphEventStore implements AsyncGraphEventStore {
  constructor(
    private readonly store: SpecEventStore<DcbEvent>,
    private readonly mutableStore: Pick<IndexedDBEventStore<DcbEvent>, 'replace' | 'clear'>,
  ) {}

  async append(events: DcbEvent | readonly DcbEvent[], condition?: AppendCondition) {
    const eventsToAppend = Array.isArray(events) ? events : [events];
    await this.store.append(eventsToAppend, condition);
  }

  async readAll() {
    return (await this.store.read()).map(({event}) => event);
  }

  replace(events: readonly DcbEvent[]) {
    return this.mutableStore.replace(events);
  }

  clear() {
    return this.mutableStore.clear();
  }
}

export async function createDefaultGraphEventStore(): Promise<{
  graphStore: AsyncGraphEventStore;
  commandStore: SpecEventStore<DcbEvent>;
}> {
  if (typeof indexedDB === 'undefined') {
    const store = new InMemoryGraphEventStore();
    return {
      graphStore: {
        append: async (events, condition) => {
          await store.append(Array.isArray(events) ? events : [events], condition);
        },
        readAll: () => store.readAll(),
        replace: (events) => store.replace(events),
        clear: () => store.clear(),
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
    graphStore: new IndexedDBAsyncGraphEventStore(specStore, mutableStore),
    commandStore: specStore,
  };
}
