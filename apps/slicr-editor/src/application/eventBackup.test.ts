import {describe, expect, it} from 'vitest';

import {Events} from '@slicr/core/events';
import {type DcbEvent, MemorySpecEventStore} from '@slicr/core/eventSourcing';
import {createEventBackupService, parseEventBackup, serializeEventBackup, type EventBackupAdminStore} from './eventBackup';

const events: DcbEvent[] = [
  Events.projectAdded('project-1', 'Checkout System'),
  Events.chapterAdded('project-1', 'chapter-1', 'Overview'),
  Events.nodeAdded('project-1', 'chapter-1', 'node-1', 'cmd', 1, 'Command'),
];

describe('event backup', () => {
  it('backupText returns version 1 event-backup JSON', async () => {
    const store = MemorySpecEventStore.create<DcbEvent>();
    await store.append(events);
    const service = createEventBackupService({
      store,
      adminStore: createAdminStore(),
    });

    await expect(service.backupText()).resolves.toBe(JSON.stringify({version: 1, events}));
  });

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
    const result = parseEventBackup(
      JSON.stringify({
        version: 1,
        events: [{type: 'Nope', payload: {}, tags: []}],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('invalid event');
    }
  });

  it('restoreFrom valid backup text restores through the admin abstraction', async () => {
    const restoredEvents: DcbEvent[][] = [];
    const backupText = JSON.stringify({version: 1, events});
    const service = createEventBackupService({
      store: MemorySpecEventStore.create<DcbEvent>(),
      adminStore: createAdminStore({
        restoreBackup: async (nextEvents) => {
          restoredEvents.push([...nextEvents]);
        },
      }),
    });

    await expect(service.restoreFrom(backupText)).resolves.toBeUndefined();
    expect(restoredEvents).toEqual([events]);
  });

  it.each([
    ['invalid JSON', '{not json', 'Backup must be valid JSON.'],
    ['bare event array', JSON.stringify(events), 'not a bare event array'],
    ['unsupported version', JSON.stringify({version: 2, events}), 'Backup version is unsupported. Expected version 1.'],
    ['legacy graph snapshot', JSON.stringify({nodes: [], edges: [], lanes: []}), 'version 1'],
    ['unknown event types', JSON.stringify({version: 1, events: [{type: 'Nope', payload: {}, tags: []}]}), 'invalid event'],
  ])('restoreFrom rejects %s', async (_label, backupText, expectedMessage) => {
    const service = createEventBackupService({
      store: MemorySpecEventStore.create<DcbEvent>(),
      adminStore: createAdminStore(),
    });

    await expect(service.restoreFrom(backupText)).rejects.toThrow(expectedMessage);
  });

  it('does not invoke replacement or change the exported stream for a rejected restore', async () => {
    const store = MemorySpecEventStore.create<DcbEvent>();
    await store.append(events);
    const restoreBackup = async () => {
      throw new Error('Unexpected replacement');
    };
    const service = createEventBackupService({store, adminStore: {restoreBackup}});
    const before = await service.backupText();

    await expect(service.restoreFrom(JSON.stringify({version: 2, events: []}))).rejects.toThrow('unsupported');
    await expect(service.backupText()).resolves.toBe(before);
  });
});

function createAdminStore(overrides: Partial<EventBackupAdminStore> = {}): EventBackupAdminStore {
  return {
    restoreBackup: async () => undefined,
    ...overrides,
  };
}
