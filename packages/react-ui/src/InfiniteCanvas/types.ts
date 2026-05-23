import type { CSSProperties, HTMLAttributes, PointerEventHandler, ReactNode } from 'react';

export type CanvasCamera = {
  x: number;
  y: number;
  zoom: number;
};

export type CanvasBounds = {
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
};

export type InfiniteCanvasControls = {
  pan?: boolean;
  wheelPan?: boolean;
  wheelZoom?: boolean;
  toolbar?: boolean;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
};

export type InfiniteCanvasHandle = {
  getCamera: () => CanvasCamera;
  setCamera: (camera: CanvasCamera) => void;
  resetCamera: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitBounds: (bounds: CanvasBounds, options?: { padding?: number }) => void;
};

export type InfiniteCanvasProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onPointerDown'> & {
  children: ReactNode;
  overlay?: ReactNode;
  camera?: CanvasCamera;
  defaultCamera?: CanvasCamera;
  bounds?: CanvasBounds;
  controls?: InfiniteCanvasControls;
  onCameraChange?: (camera: CanvasCamera) => void;
  onCanvasPointerDown?: PointerEventHandler<HTMLDivElement>;
  ignorePanSelector?: string;
  viewportRef?: React.Ref<HTMLDivElement>;
  worldClassName?: string;
  worldStyle?: CSSProperties;
  hidden?: boolean;
};
