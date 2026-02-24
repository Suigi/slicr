import type { DiagramRendererAdapterProps } from './domSvgRenderer';
import { DomSvgDiagramRendererCamera } from './domSvgRendererCamera';

export function ExperimentalDiagramRenderer(props: DiagramRendererAdapterProps) {
  return (
    <DomSvgDiagramRendererCamera
      {...props}
      rendererId="experimental"
    />
  );
}
