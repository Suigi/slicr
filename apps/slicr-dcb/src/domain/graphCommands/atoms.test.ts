import {describe, expect, it} from 'vitest';
import {Atom, Atoms} from './atoms';
import {MemorySpecEventStore, Query, SpecEventStore} from '@slicr/event-sourcing';
import {DomainEvent, Events} from '../events';

const evaluate = <Scope, Model>(atom: Atom<Scope, Model>) => async (store: SpecEventStore<DomainEvent>, scope: Scope): Promise<Model> => {
  const events = await store.query(atom.query(scope));
  return atom.project(scope, events.map(e => e.event));
};

describe('atoms', () => {

  describe('noOp', () => {
    it('does not query anything ', () => {
      expect(Atoms.noOp.query())
        .toEqual(Query.none());
    });

    it('does not project anything ', () => {
      expect(Atoms.noOp.project(undefined, []))
        .toEqual(undefined);
    });
  });

  describe('projectExists', () => {

    it('given no events, projects false', async () => {
      const store = MemorySpecEventStore.create<DomainEvent>();

      const projection = await (evaluate(Atoms.projectExists)(store, {projectId: 'my-project'}));

      expect(projection)
        .toEqual(false);
    });

    it('given unrelated Projects, projects false', async () => {
      const store = MemorySpecEventStore.create<DomainEvent>();
      await store.append([Events.projectAdded('unrelated-project-id', 'IRRELEVANT PROJECT NAME')]);

      const projection = await (evaluate(Atoms.projectExists)(store, {projectId: 'my-project'}));

      expect(projection)
        .toEqual(false);
    });

    it('given matching Project, projects true', async () => {
      const store = MemorySpecEventStore.create<DomainEvent>();
      await store.append([Events.projectAdded('my-project-id', 'IRRELEVANT PROJECT NAME')]);

      const projection = await (evaluate(Atoms.projectExists)(store, {projectId: 'my-project-id'}));

      expect(projection)
        .toEqual(true);
    });

  });

  describe('chapterExists', () => {

    it('given no events, projects false', async () => {
      const store = MemorySpecEventStore.create<DomainEvent>();

      const projection = await (evaluate(Atoms.chapterExists)(store, {chapterId: 'my-chapter-id'}));

      expect(projection)
        .toEqual(false);
    });

    it('given unrelated Chapters, projects false', async () => {
      const store = MemorySpecEventStore.create<DomainEvent>();
      await store.append([Events.chapterAdded('unrelated-project-id', 'other-chapter-id', 'IRRELEVANT CHAPTER TITLE')]);

      const projection = await (evaluate(Atoms.chapterExists)(store, {chapterId: 'my-chapter-id'}));

      expect(projection)
        .toEqual(false);
    });

    it('given matching Chapter, projects true', async () => {
      const store = MemorySpecEventStore.create<DomainEvent>();
      await store.append([Events.chapterAdded('my-project-id', 'my-chapter-id', 'IRRELEVANT CHAPTER TITLE')]);

      const projection = await (evaluate(Atoms.chapterExists)(store, {chapterId: 'my-chapter-id'}));

      expect(projection)
        .toEqual(true);
    });

  });

  describe('nodeExists', () => {
    const evaluateForNodeId = async (store: MemorySpecEventStore<DomainEvent>,
                                     nodeId: string) => {
      return await (evaluate(Atoms.nodeExists)(store, {
        projectId: 'project-id',
        nodeId: nodeId
      }));
    };

    it('given no events, projects false', async () => {
      const store = MemorySpecEventStore.create<DomainEvent>();

      const projection = await evaluateForNodeId(store, 'my-node-id');

      expect(projection)
        .toEqual(false);
    });

    it('given node with different ID, projects false', async () => {
      const store = MemorySpecEventStore.create<DomainEvent>();
      await store.append([
        Events.nodeAdded('project-id', 'chapter-id', 'other-node-id', 'evt', 0)
      ]);

      const projection = await evaluateForNodeId(store, 'my-node-id');

      expect(projection)
        .toEqual(false);
    });

    it('given added node in correct Project and Chapter, projects true', async () => {
      const store = MemorySpecEventStore.create<DomainEvent>();
      await store.append([
        Events.nodeAdded('project-id', 'chapter-id', 'node-id', 'evt', 0)
      ]);

      const projection = await evaluateForNodeId(store, 'node-id');

      expect(projection)
        .toEqual(true);
    });

    it('given removed node, projects false', async () => {
      const store = MemorySpecEventStore.create<DomainEvent>();
      await store.append([
        Events.nodeAdded('project-id', 'chapter-id', 'node-id', 'evt', 0),
        Events.nodeRemoved('project-id', 'node-id')
      ]);

      const projection = await evaluateForNodeId(store, 'node-id');

      expect(projection)
        .toEqual(false);
    });

    it('given node in wrong Project, projects false', async () => {
      const store = MemorySpecEventStore.create<DomainEvent>();
      await store.append([
        Events.nodeAdded('other-project-id', 'chapter-id', 'node-id', 'evt', 0),
      ]);

      const projection = await evaluateForNodeId(store, 'node-id');

      expect(projection)
        .toEqual(false);
    });

  });

});
