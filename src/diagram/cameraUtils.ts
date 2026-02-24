import type { DiagramSceneModel } from './rendererContract';

export const MIN_CAMERA_ZOOM = 0.4;
export const MAX_CAMERA_ZOOM = 2.5;

export type CameraState = {
  x: number;
  y: number;
  zoom: number;
};

export function clampZoom(value: number): number {
  return Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM, value));
}

export function toWorldClientPoint(
  sceneModel: DiagramSceneModel | null,
  camera: CameraState,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  if (!sceneModel?.viewport) {
    return { x: clientX, y: clientY };
  }
  const tx = sceneModel.viewport.offsetX + camera.x;
  const ty = sceneModel.viewport.offsetY + camera.y;
  return {
    x: (clientX - tx) / camera.zoom,
    y: (clientY - ty) / camera.zoom
  };
}

export function zoomCameraAroundClientPoint(
  sceneModel: DiagramSceneModel | null,
  current: CameraState,
  clientX: number,
  clientY: number,
  zoomFactor: number
): CameraState {
  if (!sceneModel?.viewport) {
    return current;
  }
  const nextZoom = clampZoom(current.zoom * zoomFactor);
  if (nextZoom === current.zoom) {
    return current;
  }

  const tx = sceneModel.viewport.offsetX + current.x;
  const ty = sceneModel.viewport.offsetY + current.y;
  const worldX = (clientX - tx) / current.zoom;
  const worldY = (clientY - ty) / current.zoom;
  const nextTx = clientX - (worldX * nextZoom);
  const nextTy = clientY - (worldY * nextZoom);
  return {
    x: nextTx - sceneModel.viewport.offsetX,
    y: nextTy - sceneModel.viewport.offsetY,
    zoom: nextZoom
  };
}
