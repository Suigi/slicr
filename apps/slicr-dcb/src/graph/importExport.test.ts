import {describe, expect, it} from 'vitest';

import {Events, type DomainEvent} from '../domain/events';
import {parseImportEvents, serializeDomainEvents} from './importExport';

describe('import/export conversion utilities', () => {
  it('serializes ordered domain events for export', () => {
    const events: DomainEvent[] = [
      Events.nodeAdded('node-1', 'ui', 0, 'Start'),
      Events.nodeRenamed('node-1', 'Renamed'),
      Events.nodesConnected('node-1', 'node-2', 'flow'),
    ];

    expect(JSON.parse(serializeDomainEvents(events))).toEqual(events);
  });

  it('parses exported domain event arrays as replacement event streams', () => {
    const events: DomainEvent[] = [
      Events.nodeAdded('node-1', 'cmd', 1, 'Command'),
      Events.nodeTypeChanged('node-1', 'dm'),
    ];

    expect(parseImportEvents(JSON.stringify(events))).toEqual({ok: true, events});
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
        Events.nodeAdded('node-1', 'cmd', 2, 'Command'),
        Events.nodeAdded('node-2', 'evt', 2, 'Event'),
        Events.nodesConnected('node-1', 'node-2', 'back-reference'),
      ],
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
