import { describe, expect, it } from 'vitest';
import { DomSvgDiagramRenderer } from './domSvgRenderer';
import { ExperimentalDiagramRenderer } from './experimentalRenderer';
import { getDiagramRenderer } from './rendererRegistry';

describe('rendererRegistry', () => {
  it('returns dom-svg renderer for dom-svg id', () => {
    expect(getDiagramRenderer('dom-svg')).toBe(DomSvgDiagramRenderer);
  });

  it('returns experimental renderer for experimental id', () => {
    expect(getDiagramRenderer('experimental')).toBe(ExperimentalDiagramRenderer);
  });

  it('falls back to dom-svg renderer for unknown id', () => {
    expect(getDiagramRenderer('unknown' as 'dom-svg')).toBe(DomSvgDiagramRenderer);
  });
});
