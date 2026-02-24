import type { JSX } from 'react';
import type { DiagramRendererId } from '../domain/runtimeFlags';
import { DomSvgDiagramRenderer } from './domSvgRenderer';
import { ExperimentalDiagramRenderer } from './experimentalRenderer';

type DiagramRendererComponent = () => JSX.Element | null;

const RENDERERS: Record<DiagramRendererId, DiagramRendererComponent> = {
  'dom-svg': DomSvgDiagramRenderer,
  experimental: ExperimentalDiagramRenderer
};

export function getDiagramRenderer(id: DiagramRendererId): DiagramRendererComponent {
  return RENDERERS[id] ?? DomSvgDiagramRenderer;
}
