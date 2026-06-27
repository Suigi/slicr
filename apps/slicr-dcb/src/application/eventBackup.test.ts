import {describe, expect, it} from 'vitest';

import {Events} from '../domain/events';
import {type DcbEvent, MemorySpecEventStore} from '../domain/eventSourcing';
import {createEventBackupService, parseEventBackup, serializeEventBackup, type AsyncGraphEventStore} from './eventBackup';

const events: DcbEvent[] = [
  Events.projectAdded('project-1', 'Checkout System'),
  Events.chapterAdded('project-1', 'chapter-1', 'Overview'),
  Events.nodeAdded('project-1', 'chapter-1', 'node-1', 'cmd', 1, 'Command'),
];

describe('event backup', () => {
  it('serializes events with version 1 metadata', () => {
    expect(JSON.parse(serializeEventBackup(events))).toEqual({version: 1, events});
  });

  it('parses valid version 1 event backups', () => {
    expect(parseEventBackup(JSON.stringify({version: 1, events}))).toEqual({ok: true, events});
  });

  it('rejects invalid JSON', () => {
    expect(parseEventBackup('{not json')).toEqual({ok: false, error: 'Backup must be valid JSON.'});
  });

  it('rejects bare event arrays', () => {
    const result = parseEventBackup(JSON.stringify(events));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('not a bare event array');
    }
  });

  it('rejects legacy graph snapshots', () => {
    const result = parseEventBackup(JSON.stringify({nodes: [], edges: [], lanes: []}));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('version');
    }
  });

  it('rejects unknown or malformed event types', () => {
    const result = parseEventBackup(JSON.stringify({
      version: 1,
      events: [{type: 'Nope', payload: {}, tags: []}],
    }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('invalid event');
    }
  });

  it('service reads all events from the spec store', async () => {
    const store = MemorySpecEventStore.create<DcbEvent>();
    await store.append(events);
    const service = createEventBackupService({
      store,
      adminStore: createAdminStore(),
    });

    await expect(service.readBackupEvents()).resolves.toEqual(events);
  });

  it('service restores through the admin abstraction', async () => {
    const restoredEvents: DcbEvent[][] = [];
    const service = createEventBackupService({
      store: MemorySpecEventStore.create<DcbEvent>(),
      adminStore: createAdminStore({restoreBackup: async (nextEvents) => {
        restoredEvents.push([...nextEvents]);
      }}),
    });

    await service.restoreBackup(events);

    expect(restoredEvents).toEqual([events]);
  });
});

function createAdminStore(overrides: Partial<AsyncGraphEventStore> = {}): AsyncGraphEventStore {
  return {
    append: async () => undefined,
    readAll: async () => [],
    restoreBackup: async () => undefined,
    clear: async () => undefined,
    ...overrides,
  };
}
