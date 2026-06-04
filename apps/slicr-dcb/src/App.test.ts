// @vitest-environment jsdom

import {describe, expect, it} from 'vitest';

import {App} from './App';
import {getKeyboardSuccessorNodeType, getSuccessorNodeType} from './graph/graphUtils';
import {isStoredGraphModel} from './graph/useGraphModel';

describe('App', () => {
  it('is defined', () => {
    expect(App).toBeTypeOf('function');
  });
});

describe('Decision Model nodes', () => {
  it('accepts decision model as a stored node type', () => {
    expect(
      isStoredGraphModel({
        nodes: [{ id: 'node-1', label: 'Decision Model', type: 'dm', laneId: 'lane-0', width: 160, height: 80 }],
        edges: [],
        lanes: [{ id: 'lane-0', order: 0 }],
      }),
    ).toBe(true);
  });

  it('connects from decision models like read models', () => {
    expect(getSuccessorNodeType('dm', 'top')).toBe('ui');
    expect(getKeyboardSuccessorNodeType('dm')).toBe('ui');
  });
});
