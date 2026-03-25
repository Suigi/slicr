import type { DiagramRendererAdapterProps } from './domSvgRenderer';
import { DomSvgDiagramRendererCamera } from './domSvgRendererCamera';

export function DomSvgCameraDiagramRenderer(props: DiagramRendererAdapterProps) {
  return (
    <DomSvgDiagramRendererCamera
      {...props}
      rendererId="dom-svg-camera"
    />
  );
}
