import { DomSvgDiagramRenderer, type DiagramRendererAdapterProps } from './domSvgRenderer';

export function ExperimentalDiagramRenderer(props: DiagramRendererAdapterProps) {
  return (
    <DomSvgDiagramRenderer
      {...props}
      rendererId="experimental"
    />
  );
}
