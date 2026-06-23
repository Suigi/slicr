import {describe, expect, it} from 'vitest';
import {AnyCommand, type DcbEvent, MemorySpecEventStore} from '../domain/eventSourcing';
import {createCommandRouter} from './commandRouter';
import {Events,} from '../domain/events';

describe('commandRouter', () => {
  it('routes AddProject and appends project events', async () => {
    const store = MemorySpecEventStore.create<DcbEvent>();
    const routeCommand = createCommandRouter({store});

    await routeCommand({
      type: 'AddProject',
      data: {name: 'My project'},
    });

    const events = await store.read();

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      position: 1,
      event: {
        type: 'ProjectAdded',
        payload: {name: 'My project'},
      },
    });
    expect(events[1]).toMatchObject({
      position: 2,
      event: {
        type: 'ChapterAdded',
        payload: {title: 'Chapter 1'},
      },
    });
    expect(events[1]?.event.payload.projectId).toBe(events[0]?.event.payload.projectId);
  });

  it('routes EnsureInitialWorkspace and appends default project events', async () => {
    const store = MemorySpecEventStore.create<DcbEvent>();
    const routeCommand = createCommandRouter({store, generateUuid: () => 'project-1'});

    await routeCommand({
      type: 'EnsureInitialWorkspace',
      data: {},
    });

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

  it('routes RenameProject and appends ProjectRenamed', async () => {
    const store = MemorySpecEventStore.create<DcbEvent>();
    await store.append([
      Events.projectAdded('project-1', 'Old name'),
    ]);
    const routeCommand = createCommandRouter({store});

    await routeCommand({
      type: 'RenameProject',
      data: {
        projectId: 'project-1',
        name: 'New name',
      },
    });

    await expect(store.read()).resolves.toEqual([
      {
        position: 1,
        event: Events.projectAdded('project-1', 'Old name'),
      },
      {
        position: 2,
        event: Events.projectRenamed('project-1', 'New name'),
      },
    ]);
  });

  it('throws for unknown command type', async () => {
    const routeCommand = createCommandRouter() as (command: AnyCommand) => Promise<void>;

    await expect(routeCommand({
      type: 'UnknownCommand',
      data: {},
    })).rejects.toThrow('No command handler registered for command type UnknownCommand');
  });
});
