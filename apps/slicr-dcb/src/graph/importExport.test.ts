import {describe, expect, it} from 'vitest';

import {Events, type DomainEvent} from '../domain/events';
import {parseImportEvents, serializeDomainEvents} from './importExport';

const projectId = 'project-1';

describe('import/export conversion utilities', () => {
  it('serializes ordered domain events for export', () => {
    const events: DomainEvent[] = [
      Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'ui', 0, 'Start'),
      Events.nodeRenamed(projectId, 'node-1', 'Renamed'),
      Events.nodesConnected(projectId, 'node-1', 'node-2', 'flow'),
    ];

    expect(JSON.parse(serializeDomainEvents(events))).toEqual(events);
  });

  it('parses project-scoped graph event arrays and assigns the default project to legacy graph snapshots', () => {
    const events: DomainEvent[] = [
      Events.nodeAdded(projectId, 'chapter-1', 'node-1', 'cmd', 1, 'Command'),
      Events.nodeTypeChanged(projectId, 'node-1', 'dm'),
    ];
    const legacySnapshot = {
      nodes: [
        {id: 'node-1', label: 'Command', type: 'cmd', laneId: 'lane-2', width: 180, height: 86},
        {id: 'node-2', label: 'Event', type: 'evt', laneId: 'lane-2', width: 180, height: 86},
      ],
      edges: [
        {id: 'edge-node-1-node-2', sourceId: 'node-1', targetId: 'node-2', role: 'back-reference'},
      ],
      lanes: [
        {id: 'lane-2', order: 2},
      ],
    };

    expect(parseImportEvents(JSON.stringify(events))).toEqual({ok: true, events});
    expect(parseImportEvents(JSON.stringify(legacySnapshot))).toEqual({
      ok: true,
      events: [
        Events.nodeAdded('default-project', 'default-chapter', 'node-1', 'cmd', 2, 'Command'),
        Events.nodeAdded('default-project', 'default-chapter', 'node-2', 'evt', 2, 'Event'),
        Events.nodesConnected('default-project', 'node-1', 'node-2', 'back-reference'),
      ],
    });
  });

  it('parses chapter-aware graph event arrays as replacement event streams', () => {
    const events: DomainEvent[] = [
      Events.nodeAdded('project-1', 'chapter-1', 'node-1', 'cmd', 1, 'Command'),
      Events.nodeChapterChanged('project-1', 'node-1', 'chapter-2'),
    ];

    expect(parseImportEvents(JSON.stringify(events))).toEqual({ok: true, events});
    expect(JSON.parse(serializeDomainEvents(events))).toEqual(events);
  });

  it('accepts and serializes node property event streams with valid required payloads', () => {
    const importedEvents = [
      {
        type: 'NodeSchemaChanged',
        payload: {
          projectId,
          nodeId: 'node-1',
          schema: [
            {
              propertyId: 'prop-title',
              name: 'title',
              type: 'string',
              optional: true,
              extraSchemaField: 'ignored by validation',
            },
            {
              propertyId: 'prop-lines',
              name: 'lines',
              type: 'Object',
              list: true,
              properties: [{propertyId: 'prop-sku', name: 'sku', type: 'string'}],
            },
          ],
          extraPayloadField: 'ignored by validation',
        },
        tags: [`projectId:${projectId}`, 'nodeId:node-1'],
      },
      {
        type: 'NodeExampleValuesChanged',
        payload: {
          projectId,
          nodeId: 'node-1',
          exampleValues: [
            {propertyId: 'prop-title', scalarValue: 'Checkout completed', extraExampleField: true},
            {propertyId: 'prop-lines', complexListValues: [{'prop-sku': 'ABC-123'}]},
          ],
          extraPayloadField: 'ignored by validation',
        },
        tags: [`projectId:${projectId}`, 'nodeId:node-1'],
      },
    ];

    expect(parseImportEvents(JSON.stringify(importedEvents))).toEqual({ok: true, events: importedEvents});
    expect(JSON.parse(serializeDomainEvents(importedEvents as DomainEvent[]))).toEqual(importedEvents);
  });

  it('converts legacy graph snapshots into replacement event streams', () => {
    const legacySnapshot = {
      nodes: [
        {id: 'node-1', label: 'Command', type: 'cmd', laneId: 'lane-2', width: 180, height: 86},
        {id: 'node-2', label: 'Event', type: 'evt', laneId: 'lane-2', width: 180, height: 86},
      ],
      edges: [
        {id: 'edge-node-1-node-2', sourceId: 'node-1', targetId: 'node-2', role: 'back-reference'},
      ],
      lanes: [
        {id: 'lane-2', order: 2},
        {id: 'lane-99', order: 99},
      ],
    };

    expect(parseImportEvents(JSON.stringify(legacySnapshot))).toEqual({
      ok: true,
      events: [
        Events.nodeAdded('default-project', 'default-chapter', 'node-1', 'cmd', 2, 'Command'),
        Events.nodeAdded('default-project', 'default-chapter', 'node-2', 'evt', 2, 'Event'),
        Events.nodesConnected('default-project', 'node-1', 'node-2', 'back-reference'),
      ],
    });
  });

  it('rejects invalid node property event required payload shapes', () => {
    const malformedPropertyEventArray = [
      {
        type: 'NodeSchemaChanged',
        payload: {
          projectId,
          nodeId: 'node-1',
          schema: [
            {
              propertyId: 'prop-title',
              name: 'title',
              type: 'string',
              properties: [{propertyId: 'prop-nested', name: 'nested', type: 'string'}],
            },
          ],
        },
        tags: [`projectId:${projectId}`, 'nodeId:node-1'],
      },
    ];

    expect(parseImportEvents(JSON.stringify(malformedPropertyEventArray))).toEqual({
      ok: false,
      error: 'Import must be an exported event array or a legacy graph snapshot.',
    });
  });

  it('rejects malformed imports with a clear failure result', () => {
    const malformedEventArray = [
      {type: 'NodeAdded', payload: {nodeId: 'node-1'}, tags: ['nodeId:node-1']},
    ];

    expect(parseImportEvents(JSON.stringify(malformedEventArray))).toEqual({
      ok: false,
      error: 'Import must be an exported event array or a legacy graph snapshot.',
    });
    expect(parseImportEvents('{not json')).toEqual({ok: false, error: 'Import must be valid JSON.'});
  });
});
