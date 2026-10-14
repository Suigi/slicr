import {describe, expect, it} from 'vitest';
import {type DcbEvent, MemorySpecEventStore} from '@slicr/core/eventSourcing';
import {Events} from '@slicr/core/events';
import {ensureInitialWorkspace} from './initialWorkspace';

describe('ensureInitialWorkspace', () => {
  it('appends the default workspace when no project exists', async () => {
    const store = MemorySpecEventStore.create<DcbEvent>();

    await ensureInitialWorkspace({store, generateUuid: () => 'project-1'});

    await expect(store.read()).resolves.toEqual([
      {
        position: 1,
        event: Events.projectAdded('project-1', 'Default Project'),
      },
      {
        position: 2,
        event: Events.chapterAdded('project-1', 'default-chapter', 'Chapter 1'),
      },
    ]);
  });

  it('does not append when a project already exists', async () => {
    const store = MemorySpecEventStore.create<DcbEvent>();
    await store.append([Events.projectAdded('existing-project', 'Existing Project')]);

    await ensureInitialWorkspace({store, generateUuid: () => 'project-1'});

    await expect(store.read()).resolves.toEqual([
      {
        position: 1,
        event: Events.projectAdded('existing-project', 'Existing Project'),
      },
    ]);
  });
});
