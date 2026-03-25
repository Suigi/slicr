import { describe, expect, it } from 'vitest';
import { toNodeAnalysisKey, toNodeAnalysisRef, toNodeAnalysisRefFromNode } from './nodeAnalysisKey';

describe('nodeAnalysisKey', () => {
  it('strips trailing numeric version suffixes from node keys', () => {
    expect(toNodeAnalysisKey('event@1')).toBe('event');
    expect(toNodeAnalysisKey('event@2')).toBe('event');
    expect(toNodeAnalysisKey('event')).toBe('event');
  });

  it('strips trailing numeric version suffixes from node refs', () => {
    expect(toNodeAnalysisRef('evt:event@1')).toBe('evt:event');
    expect(toNodeAnalysisRef('evt:event@2')).toBe('evt:event');
    expect(toNodeAnalysisRef('evt:event')).toBe('evt:event');
  });

  it('builds canonical node refs from nodes', () => {
    expect(toNodeAnalysisRefFromNode({ type: 'evt', name: 'event@3' })).toBe('evt:event');
    expect(toNodeAnalysisRefFromNode({ type: 'cmd', name: 'buy' })).toBe('cmd:buy');
  });
});
