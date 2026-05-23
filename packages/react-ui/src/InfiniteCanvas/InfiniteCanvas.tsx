import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  CanvasBounds,
  CanvasCamera,
  InfiniteCanvasControls,
  InfiniteCanvasHandle,
  InfiniteCanvasProps,
} from "./types";

const DEFAULT_CAMERA: CanvasCamera = { x: 0, y: 0, zoom: 1 };
const DEFAULT_CONTROLS: Required<InfiniteCanvasControls> = {
  pan: true,
  wheelPan: true,
  wheelZoom: true,
  toolbar: false,
  minZoom: 0.1,
  maxZoom: 4,
  zoomStep: 2,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (value: T) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref) {
        ref.current = value;
      }
    });
  };
}

function zoomAroundPoint(
  camera: CanvasCamera,
  clientX: number,
  clientY: number,
  factor: number,
  controls: Required<InfiniteCanvasControls>,
  bounds?: CanvasBounds,
) {
  const nextZoom = clamp(
    camera.zoom * factor,
    controls.minZoom,
    controls.maxZoom,
  );
  const tx = (bounds?.offsetX ?? 0) + camera.x;
  const ty = (bounds?.offsetY ?? 0) + camera.y;
  const worldX = (clientX - tx) / camera.zoom;
  const worldY = (clientY - ty) / camera.zoom;

  return {
    x: clientX - worldX * nextZoom - (bounds?.offsetX ?? 0),
    y: clientY - worldY * nextZoom - (bounds?.offsetY ?? 0),
    zoom: nextZoom,
  };
}

function getViewportPoint(
  element: HTMLDivElement | null,
  clientX: number,
  clientY: number,
) {
  const rect = element?.getBoundingClientRect();
  return {
    x: clientX - (rect?.left ?? 0),
    y: clientY - (rect?.top ?? 0),
  };
}

export const InfiniteCanvas = forwardRef<
  InfiniteCanvasHandle,
  InfiniteCanvasProps
>(function InfiniteCanvas(
  {
    children,
    overlay,
    camera: controlledCamera,
    defaultCamera = DEFAULT_CAMERA,
    bounds,
    controls: controlsOverride,
    onCameraChange,
    onCanvasPointerDown,
    ignorePanSelector,
    viewportRef,
    worldClassName,
    worldStyle,
    hidden = false,
    className,
    style,
    ...rest
  },
  ref,
) {
  const controls = { ...DEFAULT_CONTROLS, ...controlsOverride };
  const internalViewportRef = useRef<HTMLDivElement | null>(null);
  const heldWheelZoomModifiersRef = useRef({ ctrl: false, meta: false });
  const [uncontrolledCamera, setUncontrolledCamera] = useState(defaultCamera);
  const isControlled = controlledCamera !== undefined;
  const camera = controlledCamera ?? uncontrolledCamera;
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const updateCamera = useCallback(
    (nextCamera: CanvasCamera | ((current: CanvasCamera) => CanvasCamera)) => {
      const baseCamera = cameraRef.current;
      const resolved =
        typeof nextCamera === "function" ? nextCamera(baseCamera) : nextCamera;
      const clamped = {
        ...resolved,
        zoom: clamp(resolved.zoom, controls.minZoom, controls.maxZoom),
      };
      cameraRef.current = clamped;
      if (!isControlled) {
        setUncontrolledCamera(clamped);
      }
      onCameraChange?.(clamped);
    },
    [controls.maxZoom, controls.minZoom, isControlled, onCameraChange],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const viewport = internalViewportRef.current;
      const width = viewport?.clientWidth ?? bounds?.width ?? 0;
      const height = viewport?.clientHeight ?? bounds?.height ?? 0;
      updateCamera((current) =>
        zoomAroundPoint(current, width / 2, height / 2, factor, controls, bounds),
      );
    },
    [bounds, controls, updateCamera],
  );

  const resetCamera = useCallback(
    () => updateCamera(defaultCamera),
    [defaultCamera, updateCamera],
  );

  const fitBounds = useCallback(
    (nextBounds: CanvasBounds, options: { padding?: number } = {}) => {
      const viewport = internalViewportRef.current;
      const viewportWidth = viewport?.clientWidth ?? nextBounds.width;
      const viewportHeight = viewport?.clientHeight ?? nextBounds.height;
      const padding = options.padding ?? 0;
      const availableWidth = Math.max(1, viewportWidth - padding * 2);
      const availableHeight = Math.max(1, viewportHeight - padding * 2);
      const zoom = clamp(
        Math.min(
          availableWidth / Math.max(1, nextBounds.width),
          availableHeight / Math.max(1, nextBounds.height),
        ),
        controls.minZoom,
        controls.maxZoom,
      );

      updateCamera({
        x:
          padding -
          (nextBounds.offsetX ?? 0) * zoom +
          (availableWidth - nextBounds.width * zoom) / 2,
        y:
          padding -
          (nextBounds.offsetY ?? 0) * zoom +
          (availableHeight - nextBounds.height * zoom) / 2,
        zoom,
      });
    },
    [controls.maxZoom, controls.minZoom, updateCamera],
  );

  useImperativeHandle(
    ref,
    () => ({
      getCamera: () => camera,
      setCamera: updateCamera,
      resetCamera,
      zoomIn: () => zoomBy(controls.zoomStep),
      zoomOut: () => zoomBy(1 / controls.zoomStep),
      fitBounds,
    }),
    [camera, controls.zoomStep, fitBounds, resetCamera, updateCamera, zoomBy],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Control") {
        heldWheelZoomModifiersRef.current.ctrl = true;
      }
      if (event.key === "Meta") {
        heldWheelZoomModifiersRef.current.meta = true;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Control") {
        heldWheelZoomModifiersRef.current.ctrl = false;
      }
      if (event.key === "Meta") {
        heldWheelZoomModifiersRef.current.meta = false;
      }
    };
    const resetHeldModifiers = () => {
      heldWheelZoomModifiersRef.current.ctrl = false;
      heldWheelZoomModifiersRef.current.meta = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", resetHeldModifiers);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", resetHeldModifiers);
    };
  }, []);

  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    onCanvasPointerDown?.(event);
    if (event.defaultPrevented || !controls.pan || event.button !== 0) {
      return;
    }
    if (
      ignorePanSelector &&
      event.target instanceof Element &&
      event.target.closest(ignorePanSelector)
    ) {
      return;
    }

    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const startCamera = camera;

    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId || (moveEvent.buttons & 1) === 0) {
        return;
      }
      updateCamera({
        ...startCamera,
        x: startCamera.x + moveEvent.clientX - startX,
        y: startCamera.y + moveEvent.clientY - startY,
      });
    };

    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onWheel = useCallback(
    (event: WheelEvent) => {
      const modifierZoomActive =
        event.ctrlKey ||
        event.metaKey ||
        heldWheelZoomModifiersRef.current.ctrl ||
        heldWheelZoomModifiersRef.current.meta;

      if (controls.wheelZoom && modifierZoomActive) {
        event.preventDefault();
        const point = getViewportPoint(
          internalViewportRef.current,
          event.clientX,
          event.clientY,
        );
        const factor = Math.pow(controls.zoomStep, -event.deltaY / 100);
        updateCamera((current) =>
          zoomAroundPoint(current, point.x, point.y, factor, controls, bounds),
        );
        return;
      }

      if (controls.wheelPan) {
        event.preventDefault();
        updateCamera((current) => ({
          ...current,
          x: current.x - event.deltaX,
          y: current.y - event.deltaY,
        }));
      }
    },
    [bounds, controls, updateCamera],
  );

  useEffect(() => {
    const element = internalViewportRef.current;
    if (!element) {
      return;
    }

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
    };
  }, [onWheel]);

  const worldTransform = `translate(${(bounds?.offsetX ?? 0) + camera.x}px, ${(bounds?.offsetY ?? 0) + camera.y}px) scale(${camera.zoom})`;

  return (
    <div
      {...rest}
      ref={mergeRefs(internalViewportRef, viewportRef)}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        touchAction: "none",
        overscrollBehavior: "none",
        ...style,
      }}
      onPointerDown={beginPan}
      aria-hidden={hidden || rest["aria-hidden"]}
      data-camera-x={camera.x}
      data-camera-y={camera.y}
      data-camera-zoom={camera.zoom}
    >
      <div
        style={{
          width: bounds ? `${bounds.width}px` : undefined,
          height: bounds ? `${bounds.height}px` : undefined,
          position: "relative",
        }}
      >
        <div
          className={worldClassName}
          data-camera-x={camera.x}
          data-camera-y={camera.y}
          data-camera-zoom={camera.zoom}
          style={{
            transform: worldTransform,
            transformOrigin: "0 0",
            position: "absolute",
            inset: 0,
            ...worldStyle,
          }}
        >
          {children}
        </div>
      </div>

      {overlay}

      {controls.toolbar && (
        <div
          className="infinite-canvas-toolbar"
          style={{ position: "absolute", right: 12, bottom: 12 }}
        >
          <button
            type="button"
            onClick={() => zoomBy(controls.zoomStep)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1 / controls.zoomStep)}
            aria-label="Zoom out"
          >
            −
          </button>
          <button type="button" onClick={resetCamera} aria-label="Reset camera">
            Reset
          </button>
        </div>
      )}
    </div>
  );
});
