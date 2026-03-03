import { describe, expect, it } from 'vitest';
import { AddNodeType, buildAddNodeDsl } from './addNodeDsl';

describe('buildAddNodeDsl', () => {
  it('maps each dialog type to the correct DSL prefix', () => {
    const cases: Array<[AddNodeType, string]> = [
      ['generic', ''],
      ['event', 'evt'],
      ['read-model', 'rm'],
      ['ui', 'ui'],
      ['command', 'cmd'],
      ['exception', 'exc'],
      ['automation', 'aut'],
      ['external', 'ext']
    ];

    for (const [type, prefix] of cases) {
      const result = buildAddNodeDsl({
        type,
        name: 'new-node',
        alias: 'New Node',
        predecessors: [],
        usesKeys: []
      });
      const expectedPrefix = type === 'generic' ? `new-node "New Node"` : `${prefix}:new-node "New Node"`;
      expect(result.startsWith(expectedPrefix)).toBe(true);
    }
  });

  it('emits incoming predecessor lines and uses keys', () => {
    const result = buildAddNodeDsl({
      type: 'command',
      name: 'buy-ticket',
      alias: 'Buy Ticket',
      predecessors: ['evt:seed', 'rm:view'],
      usesKeys: ['alpha', 'beta'],
      collections: []
    });

    expect(result).toBe(
      'cmd:buy-ticket "Buy Ticket"\n'
      + '<- evt:seed\n'
      + '<- rm:view\n'
      + 'uses:\n'
      + '  alpha\n'
      + '  beta'
    );
  });

  it('deduplicates and trims predecessor and uses values', () => {
    const result = buildAddNodeDsl({
      type: 'event',
      name: 'thing-added',
      alias: '',
      predecessors: [' evt:seed ', '', 'evt:seed', 'cmd:add'],
      usesKeys: [' alpha ', 'alpha', '', 'beta'],
      collections: []
    });

    expect(result).toBe(
      'evt:thing-added\n'
      + '<- evt:seed\n'
      + '<- cmd:add\n'
      + 'uses:\n'
      + '  alpha\n'
      + '  beta'
    );
  });

  it('omits uses section when no uses keys are selected', () => {
    const result = buildAddNodeDsl({
      type: 'read-model',
      name: 'projection',
      alias: 'Projection',
      predecessors: ['evt:seed'],
      usesKeys: [],
      collections: []
    });

    expect(result).toBe('rm:projection "Projection"\n<- evt:seed');
  });

  it('emits collection mapping entries in uses block', () => {
    const result = buildAddNodeDsl({
      type: 'read-model',
      name: 'projection',
      alias: 'Projection',
      predecessors: ['evt:seed'],
      usesKeys: ['alpha'],
      collections: [{ name: 'rooms', keys: ['id', 'capacity'] }]
    });

    expect(result).toBe(
      'rm:projection "Projection"\n'
      + '<- evt:seed\n'
      + 'uses:\n'
      + '  alpha\n'
      + '  rooms <- collect ( { id, capacity } )'
    );
  });
});
