import type { JSX } from 'react';
import type { DiagramRendererId } from '../domain/runtimeFlags';
import { DomSvgDiagramRenderer, type DiagramRendererAdapterProps } from './domSvgRenderer';
import { ExperimentalDiagramRenderer } from './experimentalRenderer';

export type DiagramRendererComponent = (props: DiagramRendererAdapterProps) => JSX.Element | null;

const RENDERERS: Record<DiagramRendererId, DiagramRendererComponent> = {
  'dom-svg': DomSvgDiagramRenderer,
  experimental: ExperimentalDiagramRenderer
};

export function getDiagramRenderer(id: DiagramRendererId): DiagramRendererComponent {
  return RENDERERS[id] ?? DomSvgDiagramRenderer;
}
