import {describe, expect, it} from 'vitest';
import {Atoms} from './atoms';
import {type Atom, MemorySpecEventStore, Query, SpecEventStore} from '../eventSourcing';
import {DcbEvent, Events, NodePropertyExampleValues, NodePropertySchema} from '../events';

const evaluate = <Scope, Model>(atom: Atom<DcbEvent, Scope, Model>) => async (store: SpecEventStore<DcbEvent>, scope: Scope): Promise<Model> => {
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
      const store = MemorySpecEventStore.create<DcbEvent>();

      const projection = await (evaluate(Atoms.projectExists)(store, {projectId: 'my-project'}));

      expect(projection)
        .toEqual(false);
    });

    it('given unrelated Projects, projects false', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([Events.projectAdded('unrelated-project-id', 'IRRELEVANT PROJECT NAME')]);

      const projection = await (evaluate(Atoms.projectExists)(store, {projectId: 'my-project'}));

      expect(projection)
        .toEqual(false);
    });

    it('given matching Project, projects true', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([Events.projectAdded('my-project-id', 'IRRELEVANT PROJECT NAME')]);

      const projection = await (evaluate(Atoms.projectExists)(store, {projectId: 'my-project-id'}));

      expect(projection)
        .toEqual(true);
    });

  });

  describe('chapterExists', () => {

    it('given no events, projects false', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();

      const projection = await (evaluate(Atoms.chapterExists)(store, {
        projectId: 'my-project-id',
        chapterId: 'my-chapter-id'
      }));

      expect(projection)
        .toEqual(false);
    });

    it('given the same chapter ID in a different project, projects false', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([Events.chapterAdded('unrelated-project-id', 'my-chapter-id', 'IRRELEVANT CHAPTER TITLE')]);

      const projection = await (evaluate(Atoms.chapterExists)(store, {
        projectId: 'my-project-id',
        chapterId: 'my-chapter-id'
      }));

      expect(projection)
        .toEqual(false);
    });

    it('given matching Chapter, projects true', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([Events.chapterAdded('my-project-id', 'my-chapter-id', 'IRRELEVANT CHAPTER TITLE')]);

      const projection = await (evaluate(Atoms.chapterExists)(store, {
        projectId: 'my-project-id',
        chapterId: 'my-chapter-id'
      }));

      expect(projection)
        .toEqual(true);
    });

  });

  describe('nodeExists', () => {
    const evaluateForNodeId = async (store: MemorySpecEventStore<DcbEvent>,
                                     nodeId: string) => {
      return await (evaluate(Atoms.nodeExists)(store, {
        projectId: 'project-id',
        nodeId: nodeId
      }));
    };

    it('given no events, projects false', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();

      const projection = await evaluateForNodeId(store, 'my-node-id');

      expect(projection)
        .toEqual(false);
    });

    it('given node with different ID, projects false', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([
        Events.nodeAdded('project-id', 'chapter-id', 'other-node-id', 'evt', 0)
      ]);

      const projection = await evaluateForNodeId(store, 'my-node-id');

      expect(projection)
        .toEqual(false);
    });

    it('given added node in correct Project and Chapter, projects true', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([
        Events.nodeAdded('project-id', 'chapter-id', 'node-id', 'evt', 0)
      ]);

      const projection = await evaluateForNodeId(store, 'node-id');

      expect(projection)
        .toEqual(true);
    });

    it('given removed node, projects false', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([
        Events.nodeAdded('project-id', 'chapter-id', 'node-id', 'evt', 0),
        Events.nodeRemoved('project-id', 'node-id')
      ]);

      const projection = await evaluateForNodeId(store, 'node-id');

      expect(projection)
        .toEqual(false);
    });

    it('given node in wrong Project, projects false', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([
        Events.nodeAdded('other-project-id', 'chapter-id', 'node-id', 'evt', 0),
      ]);

      const projection = await evaluateForNodeId(store, 'node-id');

      expect(projection)
        .toEqual(false);
    });

  });

  describe('nodeName', () => {
    it('given no events, projects false/undefined', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();

      const projection = await evaluate(Atoms.nodeName)(store, {projectId: 'project-id', nodeId: 'node-id'});

      expect(projection).toEqual({nodeExists: false, name: undefined});
    });

    it('given node exists, projects true/current label', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([Events.nodeAdded('project-id', 'chapter-id', 'node-id', 'evt', 0, 'Initial Name')]);

      const projection = await evaluate(Atoms.nodeName)(store, {projectId: 'project-id', nodeId: 'node-id'});

      expect(projection).toEqual({nodeExists: true, name: 'Initial Name'});
    });

    it('given node was renamed, projects true/latest name', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([
        Events.nodeAdded('project-id', 'chapter-id', 'node-id', 'evt', 0, 'Initial Name'),
        Events.nodeRenamed('project-id', 'node-id', 'Latest Name'),
      ]);

      const projection = await evaluate(Atoms.nodeName)(store, {projectId: 'project-id', nodeId: 'node-id'});

      expect(projection).toEqual({nodeExists: true, name: 'Latest Name'});
    });

    it('given node was removed, projects false/undefined', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([
        Events.nodeAdded('project-id', 'chapter-id', 'node-id', 'evt', 0, 'Initial Name'),
        Events.nodeRemoved('project-id', 'node-id'),
      ]);

      const projection = await evaluate(Atoms.nodeName)(store, {projectId: 'project-id', nodeId: 'node-id'});

      expect(projection).toEqual({nodeExists: false, name: undefined});
    });
  });

  describe('nodeType', () => {
    it('given no events, projects false/undefined', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();

      const projection = await evaluate(Atoms.nodeType)(store, {projectId: 'project-id', nodeId: 'node-id'});

      expect(projection).toEqual({nodeExists: false, type: undefined});
    });

    it('given node exists, projects true/current type', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([Events.nodeAdded('project-id', 'chapter-id', 'node-id', 'evt', 0)]);

      const projection = await evaluate(Atoms.nodeType)(store, {projectId: 'project-id', nodeId: 'node-id'});

      expect(projection).toEqual({nodeExists: true, type: 'evt'});
    });

    it('given node type was changed, projects true/latest type', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([
        Events.nodeAdded('project-id', 'chapter-id', 'node-id', 'evt', 0),
        Events.nodeTypeChanged('project-id', 'node-id', 'dm'),
      ]);

      const projection = await evaluate(Atoms.nodeType)(store, {projectId: 'project-id', nodeId: 'node-id'});

      expect(projection).toEqual({nodeExists: true, type: 'dm'});
    });

    it('given node was removed, projects false/undefined', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([
        Events.nodeAdded('project-id', 'chapter-id', 'node-id', 'evt', 0),
        Events.nodeRemoved('project-id', 'node-id'),
      ]);

      const projection = await evaluate(Atoms.nodeType)(store, {projectId: 'project-id', nodeId: 'node-id'});

      expect(projection).toEqual({nodeExists: false, type: undefined});
    });
  });

  describe('nodeChapter', () => {
    it('given no events, projects false/undefined', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([]);

      const projection = await evaluate(Atoms.nodeChapter)(
        store,
        {
          projectId: 'project-id',
          nodeId: 'source-node-id',
        }
      );

      expect(projection)
        .toEqual({nodeExists: false, chapterId: undefined});
    });

    it('given node exists, projects true/<chapter-id>', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([
        Events.nodeAdded('project-id', 'node-chapter-id', 'source-node-id', 'evt', 0),
      ]);

      const projection = await evaluate(Atoms.nodeChapter)(
        store,
        {
          projectId: 'project-id',
          nodeId: 'source-node-id',
        }
      );

      expect(projection)
        .toEqual({nodeExists: true, chapterId: 'node-chapter-id'});
    });

    it('given node was moved, projects true/<new-chapter-id>', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([
        Events.nodeAdded('project-id', 'node-chapter-id', 'source-node-id', 'evt', 0),
        Events.nodeChapterChanged('project-id', 'source-node-id', 'new-chapter-id'),
      ]);

      const projection = await evaluate(Atoms.nodeChapter)(
        store,
        {
          projectId: 'project-id',
          nodeId: 'source-node-id',
        }
      );

      expect(projection)
        .toEqual({nodeExists: true, chapterId: 'new-chapter-id'});
    });

    it('given node was removed, projects false/undefined', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([
        Events.nodeAdded('project-id', 'node-chapter-id', 'source-node-id', 'evt', 0),
        Events.nodeRemoved('project-id', 'source-node-id'),
      ]);

      const projection = await evaluate(Atoms.nodeChapter)(
        store,
        {
          projectId: 'project-id',
          nodeId: 'source-node-id',
        }
      );

      expect(projection)
        .toEqual({nodeExists: false, chapterId: undefined});
    });
  });

  describe('connectionExists', () => {
    it('given no events, projects false', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([]);

      const projection = await evaluate(Atoms.connectionExists)(
        store,
        {
          projectId: 'project-id',
          sourceNodeId: 'source-node-id',
          targetNodeId: 'target-node-id'
        }
      );

      expect(projection)
        .toEqual(false);
    });

    it('given connected nodes, projects true', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([
        Events.nodesConnected('project-id', 'source-node-id', 'target-node-id')
      ]);

      const projection = await evaluate(Atoms.connectionExists)(
        store,
        {
          projectId: 'project-id',
          sourceNodeId: 'source-node-id',
          targetNodeId: 'target-node-id'
        }
      );

      expect(projection)
        .toEqual(true);
    });

    it('given connected and then disconnected nodes, project false', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([
        Events.nodesConnected('project-id', 'source-node-id', 'target-node-id'),
        Events.nodesDisconnected('project-id', 'source-node-id', 'target-node-id'),
      ]);

      const projection = await evaluate(Atoms.connectionExists)(
        store,
        {
          projectId: 'project-id',
          sourceNodeId: 'source-node-id',
          targetNodeId: 'target-node-id'
        }
      );

      expect(projection)
        .toEqual(false);
    });
  });

  describe('nodeSchema', () => {
    it('given no events, projects []', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();

      const projectedSchema = await evaluate(Atoms.nodeSchema)(
        store,
        {
          projectId: 'project-id',
          nodeId: 'node-id'
        });

      expect(projectedSchema)
        .toEqual([]);
    });

    it('given node in wrong project, projects []', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([
        Events.nodeSchemaChanged('other-project-id', 'node-id', [])
      ]);

      const projectedSchema = await evaluate(Atoms.nodeSchema)(
        store,
        {
          projectId: 'project-id',
          nodeId: 'node-id'
        });

      expect(projectedSchema)
        .toEqual([]);
    });

    it('given node with schema, projects schema', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      const schema: NodePropertySchema[] = [{
        name: 'property-name',
        propertyId: 'property-id',
        type: 'string'
      }];
      await store.append([
        Events.nodeSchemaChanged('project-id', 'node-id', schema)
      ]);

      const projectedSchema = await evaluate(Atoms.nodeSchema)(
        store,
        {
          projectId: 'project-id',
          nodeId: 'node-id'
        });

      expect(projectedSchema)
        .toEqual(schema);
    });
  });

  describe('nodeExampleValues', () => {
    it('given no events, projects []', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();

      const projectedExampleValues = await evaluate(Atoms.nodeExampleValues)(
        store,
        {
          projectId: 'project-id',
          nodeId: 'node-id'
        });

      expect(projectedExampleValues)
        .toEqual([]);
    });

    it('given node in wrong project, projects []', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      await store.append([
        Events.nodeExampleValuesChanged('other-project-id', 'node-id', [])
      ]);

      const projectedExampleValues = await evaluate(Atoms.nodeExampleValues)(
        store,
        {
          projectId: 'project-id',
          nodeId: 'node-id'
        });

      expect(projectedExampleValues)
        .toEqual([]);
    });

    it('given node with example values, projects example values', async () => {
      const store = MemorySpecEventStore.create<DcbEvent>();
      const exampleValues: NodePropertyExampleValues[] = [{
        propertyId: 'property-id',
        scalarValue: 'example value'
      }];
      await store.append([
        Events.nodeExampleValuesChanged('project-id', 'node-id', exampleValues)
      ]);

      const projectedExampleValues = await evaluate(Atoms.nodeExampleValues)(
        store,
        {
          projectId: 'project-id',
          nodeId: 'node-id'
        });

      expect(projectedExampleValues)
        .toEqual(exampleValues);
    });
  });

});
