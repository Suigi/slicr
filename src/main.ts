import "./style.css";
import { layout as computeLayout } from "./layout/layout";
import type {
  AnchorPoint,
  AnchorSide,
  EdgeLayout,
  LayoutApi,
  LayoutRequest,
  LayoutResponse,
  LayoutResult,
  NodeLayout,
  Point,
} from "./layout/types";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root");
}

const GRID_MAJOR = 160;
const GRID_MINOR = 40;
const GRID_DOT = 10;
const CAMERA_ZOOM_STEP = 1.15;
const HANDLE_RADIUS = 5;
const EPSILON = 0.5;
const EDGE_STUB = 20;
const STORAGE_KEY = "layout-lib.playground.v1";

type Selection =
  | { type: "node"; id: string }
  | { type: "group"; id: string }
  | { type: "edge"; id: string }
  | { type: "segment"; edgeId: string; segmentIndex: number };

type EdgeOverride = {
  sourceAnchor?: AnchorPoint;
  targetAnchor?: AnchorPoint;
  points?: Point[];
};

type Camera = {
  x: number;
  y: number;
  zoom: number;
};

type DragState =
  | {
      type: "pan";
      pointerId: number;
      startScreen: Point;
      startCamera: Camera;
    }
  | {
      type: "marquee";
      pointerId: number;
      startScreen: Point;
      currentScreen: Point;
    }
  | {
      type: "node";
      pointerId: number;
      nodeId: string;
      offset: Point;
    }
  | {
      type: "resize-node";
      pointerId: number;
      nodeId: string;
      startWorld: Point;
      startWidth: number;
      startHeight: number;
    }
  | {
      type: "segment";
      pointerId: number;
      edgeId: string;
      segmentIndex: number;
      startWorld: Point;
      startPoints: Point[];
    };

type EdgeCreateState = {
  sourceId: string;
  previewWorld: Point | null;
};

type PlaygroundState = {
  request: LayoutRequest;
  camera: Camera;
  selection: Selection | null;
  selectedNodeIds: string[];
  nodeOverrides: Record<string, Partial<Pick<NodeLayout, "x" | "y">>>;
  edgeOverrides: Record<string, EdgeOverride>;
  showOverlay: boolean;
  showCoordinates: boolean;
  showShortcuts: boolean;
  showTestBrowser: boolean;
  testCases: ImportedTestCaseSummary[];
  activeImportedTestCase: ImportedTestCaseSummary | null;
  testCaseQuery: string;
  testBrowserLoading: boolean;
  testBrowserError: string | null;
  importingTestCaseId: string | null;
  savingImportedTest: boolean;
  edgeCreate: EdgeCreateState | null;
  status: string;
  error: string | null;
};

type ImportedTestCaseSummary = {
  id: string;
  file: string;
  describe: string;
  title: string;
  status: "pass" | "fail" | "skip" | "todo" | "unknown";
};

type ImportedAssertedGeometry = {
  nodes: NodeGeometryAssertion[];
  edges: EdgeGeometryAssertion[];
};

type NodeGeometryAssertion = {
  id: string;
  x: number;
  y: number;
};

type EdgeGeometryAssertion = {
  id: string;
  sourceAnchor: AnchorPoint;
  targetAnchor: AnchorPoint;
  points: Point[];
};

type DerivedState = {
  autoResponse: LayoutResponse;
  autoLayout: LayoutResult | null;
  editableLayout: LayoutResult | null;
  hasLocalPositioningModifications: boolean;
};

type PersistedPlaygroundState = {
  version: 1;
  request: LayoutRequest;
  nodeOverrides: Record<string, Partial<Pick<NodeLayout, "x" | "y">>>;
  edgeOverrides: Record<string, EdgeOverride>;
  camera: Camera;
  selectedLaneId: string | null;
  showOverlay: boolean;
  showCoordinates: boolean;
  showTestBrowser: boolean;
};

type HitTarget =
  | { type: "group"; id: string }
  | { type: "resize-node"; id: string }
  | { type: "node"; id: string }
  | { type: "segment"; edgeId: string; segmentIndex: number }
  | { type: "edge"; id: string }
  | null;

type PlaygroundGroupLayout = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeIds: string[];
};

const baseRequest: LayoutRequest = {
  nodes: [
    { id: "A", laneId: "lane-0" },
    { id: "B", laneId: "lane-1" },
    { id: "C", laneId: "lane-0" },
  ],
  edges: [
    { id: "edge-a-b", sourceId: "A", targetId: "B" },
    { id: "edge-b-c", sourceId: "B", targetId: "C" },
  ],
  lanes: [
    { id: "lane-0", order: 0 },
    { id: "lane-1", order: 1 },
  ],
  defaults: { nodeWidth: 120, nodeHeight: 48 },
  spacing: { laneMargin: 24, laneGap: 44, minTargetShift: 20, minNodeGap: 40 },
};

const persistedState = loadPersistedState();

const state: PlaygroundState = {
  request: persistedState?.request ?? structuredClone(baseRequest),
  camera: persistedState?.camera ?? { x: -120, y: -80, zoom: 1 },
  selection: null,
  selectedNodeIds: [],
  nodeOverrides: persistedState?.nodeOverrides ?? {},
  edgeOverrides: persistedState?.edgeOverrides ?? {},
  showOverlay: persistedState?.showOverlay ?? false,
  showCoordinates: persistedState?.showCoordinates ?? true,
  showShortcuts: false,
  showTestBrowser: persistedState?.showTestBrowser ?? false,
  testCases: [],
  activeImportedTestCase: null,
  testCaseQuery: "",
  testBrowserLoading: false,
  testBrowserError: null,
  importingTestCaseId: null,
  savingImportedTest: false,
  edgeCreate: null,
  status: "Ready. Left-drag marquee-selects. Right-drag pans. G groups. Shift+G ungroups.",
  error: null,
};

const layout: LayoutApi = computeLayout;

app.innerHTML = `
  <div class="playground-shell">
    <aside class="sidebar">
      <div>
        <p class="eyebrow">Layout Playground</p>
        <h1> 🧪 🤖 🚀</h1>
        <p class="lede">
          Declare nodes and edges, compare manual overrides against the computed layout,
          and export a Vitest acceptance test.
        </p>
      </div>

      <section class="panel">
        <div class="panel-head">
          <h2>Selection</h2>
          <span id="selection-label" class="badge">Nothing selected</span>
        </div>
        <div id="inspector" class="inspector"></div>
      </section>

      <section class="panel data-panel">
        <div class="panel-head">
          <h2>Graph</h2>
          <span id="graph-summary" class="badge"></span>
        </div>
        <div id="graph-lists" class="graph-lists"></div>
      </section>

      <section class="panel status-panel">
        <h2>Status</h2>
        <p id="status-line" class="status-line"></p>
        <p id="error-line" class="error-line"></p>
      </section>
    </aside>

    <main class="canvas-stage">
      <div id="scene-root" class="scene-root">
        <div id="scene-grid" class="scene-grid"></div>
        <div id="scene-viewport" class="scene-viewport">
          <svg id="group-layer" class="group-layer"></svg>
          <svg id="edge-layer" class="edge-layer"></svg>
          <div id="node-layer" class="node-layer"></div>
          <svg id="overlay-layer" class="overlay-layer"></svg>
        </div>
      </div>
      <div id="marquee" class="marquee-selection" hidden></div>
      <div class="action-controls">
        <button id="shortcuts-button" class="hud-icon-button action-icon-button" type="button" aria-label="Show shortcuts">?</button>
        <button id="import-button" type="button">Import</button>
        <button id="layout-button" type="button">Reset</button>
        <button id="save-button" type="button" disabled>Save</button>
        <button id="export-button" class="primary-button" type="button">Vitest</button>
      </div>
      <div class="toggle-controls">
        <button id="overlay-button" class="toggle-button" type="button" aria-pressed="false">Overlay</button>
        <button id="coordinates-button" class="toggle-button" type="button" aria-pressed="true">Coords</button>
      </div>
      <div class="camera-controls">
        <div class="camera-row">
          <button id="zoom-out" type="button" aria-label="Zoom out">−</button>
          <button id="zoom-reset" type="button" aria-label="Fit view">Fit</button>
          <button id="zoom-in" type="button" aria-label="Zoom in">+</button>
        </div>
      </div>
      <div id="shortcuts-popup" class="shortcuts-popup" hidden>
        <div class="shortcuts-popup-card">
          <div class="panel-head">
            <h2>Shortcuts</h2>
            <button id="shortcuts-close" class="mini-button" type="button" aria-label="Close shortcuts">Close</button>
          </div>
          <ul class="shortcut-list">
            <li><kbd>?</kbd> show or hide this popup</li>
            <li><kbd>N</kbd> add node in the lane nearest the cursor and connect from the selected node</li>
            <li><kbd>E</kbd> start edge mode, then click source and target</li>
            <li><kbd>O</kbd> toggle computed-layout overlay</li>
            <li><kbd>G</kbd> group selected nodes, <kbd>Shift</kbd> + <kbd>G</kbd> ungroup</li>
            <li><kbd>Backspace</kbd> delete the selected node or edge</li>
            <li><kbd>Right mouse drag</kbd> pan, <kbd>Ctrl</kbd> + wheel or pinch to zoom</li>
          </ul>
        </div>
      </div>
      <div id="test-browser" class="test-browser-modal" hidden></div>
    </main>
  </div>
`;

const sceneRoot = requireElement<HTMLDivElement>("#scene-root");
const sceneGrid = requireElement<HTMLDivElement>("#scene-grid");
const groupLayer = requireElement<SVGSVGElement>("#group-layer");
const sceneViewport = requireElement<HTMLDivElement>("#scene-viewport");
const edgeLayer = requireElement<SVGSVGElement>("#edge-layer");
const nodeLayer = requireElement<HTMLDivElement>("#node-layer");
const overlayLayer = requireElement<SVGSVGElement>("#overlay-layer");
const marquee = requireElement<HTMLDivElement>("#marquee");
const inspector = requireElement<HTMLDivElement>("#inspector");
const graphLists = requireElement<HTMLDivElement>("#graph-lists");
const selectionLabel = requireElement<HTMLSpanElement>("#selection-label");
const graphSummary = requireElement<HTMLSpanElement>("#graph-summary");
const statusLine = requireElement<HTMLParagraphElement>("#status-line");
const errorLine = requireElement<HTMLParagraphElement>("#error-line");
const overlayButton = requireElement<HTMLButtonElement>("#overlay-button");
const coordinatesButton = requireElement<HTMLButtonElement>("#coordinates-button");
const shortcutsButton = requireElement<HTMLButtonElement>("#shortcuts-button");
const shortcutsCloseButton = requireElement<HTMLButtonElement>("#shortcuts-close");
const shortcutsPopup = requireElement<HTMLDivElement>("#shortcuts-popup");
const testBrowser = requireElement<HTMLDivElement>("#test-browser");
const importButton = requireElement<HTMLButtonElement>("#import-button");
const saveButton = requireElement<HTMLButtonElement>("#save-button");
const exportButton = requireElement<HTMLButtonElement>("#export-button");
const resetOverridesButton = requireElement<HTMLButtonElement>("#layout-button");
const zoomInButton = requireElement<HTMLButtonElement>("#zoom-in");
const zoomOutButton = requireElement<HTMLButtonElement>("#zoom-out");
const zoomResetButton = requireElement<HTMLButtonElement>("#zoom-reset");

let dragState: DragState | null = null;
let derived = computeDerivedState(state);
let selectedLaneId =
  persistedState?.selectedLaneId && state.request.lanes.some((lane) => lane.id === persistedState.selectedLaneId)
    ? persistedState.selectedLaneId
    : (state.request.lanes[0]?.id ?? "lane-0");
let lastPointerScreen: Point | null = null;
let testStatusEventSource: EventSource | null = null;

attachEventListeners();
connectTestStatusStream();
render();
if (state.showTestBrowser) {
  void openTestBrowser();
}

function attachEventListeners() {
  sceneRoot.addEventListener("pointerdown", handlePointerDown);
  sceneRoot.addEventListener("pointermove", handlePointerMove);
  sceneRoot.addEventListener("pointerup", handlePointerUp);
  sceneRoot.addEventListener("pointercancel", handlePointerUp);
  sceneRoot.addEventListener("contextmenu", (event) => event.preventDefault());
  sceneRoot.addEventListener("dblclick", handleDoubleClick);
  sceneRoot.addEventListener("wheel", handleWheel, { passive: false });

  document.addEventListener("keydown", handleKeyDown);
  importButton.addEventListener("click", () => void openTestBrowser());
  saveButton.addEventListener("click", () => void saveImportedTest());
  exportButton.addEventListener("click", () => void exportTest());
  resetOverridesButton.addEventListener("click", () => {
    if (!derived.autoLayout) {
      state.status = "No computed layout available.";
      render();
      return;
    }
    state.nodeOverrides = {};
    state.edgeOverrides = {};
    state.selection = null;
    state.selectedNodeIds = [];
    state.status = "Applied geometry from the layout library.";
    updateDerivedAndRender();
  });
  overlayButton.addEventListener("click", () => {
    state.showOverlay = !state.showOverlay;
    state.status = state.showOverlay ? "Computed-layout overlay enabled." : "Computed-layout overlay hidden.";
    render();
  });
  coordinatesButton.addEventListener("click", () => {
    state.showCoordinates = !state.showCoordinates;
    state.status = state.showCoordinates ? "Coordinate labels enabled." : "Coordinate labels hidden.";
    render();
  });

  zoomInButton.addEventListener("click", () => zoomAtScreenPoint(viewportCenterScreen(), CAMERA_ZOOM_STEP));
  zoomOutButton.addEventListener("click", () => zoomAtScreenPoint(viewportCenterScreen(), 1 / CAMERA_ZOOM_STEP));
  zoomResetButton.addEventListener("click", fitCameraToContent);
  shortcutsButton.addEventListener("click", toggleShortcutsPopup);
  shortcutsCloseButton.addEventListener("click", toggleShortcutsPopup);
}

function computeDerivedState(playgroundState: PlaygroundState): DerivedState {
  const autoResponse = layout(playgroundState.request);
  if (!autoResponse.ok) {
    return { autoResponse, autoLayout: null, editableLayout: null, hasLocalPositioningModifications: false };
  }
  pruneRedundantOverrides(playgroundState, autoResponse.result);
  const editableLayout = applyOverrides(playgroundState.request, autoResponse.result, playgroundState);
  return {
    autoResponse,
    autoLayout: autoResponse.result,
    editableLayout,
    hasLocalPositioningModifications:
      Object.keys(playgroundState.nodeOverrides).length > 0 || Object.keys(playgroundState.edgeOverrides).length > 0,
  };
}

function updateDerivedAndRender() {
  derived = computeDerivedState(state);
  persistPlaygroundState();
  render();
}

function render() {
  persistPlaygroundState();
  updateSceneTransform();

  if (derived.autoLayout && derived.editableLayout) {
    renderGroups(derived.editableLayout);
    renderNodes(derived.editableLayout);
    renderEdges(derived.editableLayout);
    renderOverlay(derived.autoLayout, derived.editableLayout);
  } else {
    groupLayer.innerHTML = "";
    nodeLayer.innerHTML = "";
    edgeLayer.innerHTML = "";
    overlayLayer.innerHTML = "";
  }

  selectionLabel.textContent = describeSelection();
  graphSummary.innerHTML = `${state.request.nodes.length}&nbsp;nodes / ${state.request.edges.length}&nbsp;edges / ${state.request.lanes.length}&nbsp;lanes`;
  if (countVisibleGroups() > 0) {
    graphSummary.innerHTML += ` / ${countVisibleGroups()}&nbsp;groups`;
  }
  statusLine.textContent = state.status;
  errorLine.textContent = derived.autoResponse.ok ? "" : derived.autoResponse.error.message;
  overlayButton.setAttribute("aria-pressed", String(state.showOverlay));
  coordinatesButton.setAttribute("aria-pressed", String(state.showCoordinates));
  resetOverridesButton.classList.toggle("has-local-modifications", derived.hasLocalPositioningModifications);
  saveButton.disabled = !state.activeImportedTestCase || state.savingImportedTest || !derived.editableLayout;
  saveButton.textContent = state.savingImportedTest ? "Saving…" : "Save";
  shortcutsPopup.hidden = !state.showShortcuts;
  shortcutsButton.setAttribute("aria-pressed", String(state.showShortcuts));
  testBrowser.hidden = !state.showTestBrowser;
  renderTestBrowser();
  renderInspector();
  renderGraphLists();
}

function updateSceneTransform() {
  const rect = sceneRoot.getBoundingClientRect();
  const width = Math.max(1, rect.width / state.camera.zoom);
  const height = Math.max(1, rect.height / state.camera.zoom);
  sceneViewport.style.width = `${width}px`;
  sceneViewport.style.height = `${height}px`;
  // Use an explicit affine matrix so the rendered transform matches screenToWorld exactly.
  sceneViewport.style.transform = `matrix(${state.camera.zoom}, 0, 0, ${state.camera.zoom}, ${-state.camera.x * state.camera.zoom}, ${-state.camera.y * state.camera.zoom})`;
  groupLayer.setAttribute("viewBox", `0 0 ${width} ${height}`);
  edgeLayer.setAttribute("viewBox", `0 0 ${width} ${height}`);
  overlayLayer.setAttribute("viewBox", `0 0 ${width} ${height}`);
  groupLayer.setAttribute("width", `${width}`);
  groupLayer.setAttribute("height", `${height}`);
  edgeLayer.setAttribute("width", `${width}`);
  edgeLayer.setAttribute("height", `${height}`);
  overlayLayer.setAttribute("width", `${width}`);
  overlayLayer.setAttribute("height", `${height}`);
  groupLayer.style.width = `${width}px`;
  groupLayer.style.height = `${height}px`;
  edgeLayer.style.width = `${width}px`;
  edgeLayer.style.height = `${height}px`;
  overlayLayer.style.width = `${width}px`;
  overlayLayer.style.height = `${height}px`;

  const dotOffsetX = mod(-state.camera.x * state.camera.zoom, GRID_DOT * state.camera.zoom);
  const dotOffsetY = mod(-state.camera.y * state.camera.zoom, GRID_DOT * state.camera.zoom);
  const minorOffsetX = mod(-state.camera.x * state.camera.zoom, GRID_MINOR * state.camera.zoom);
  const minorOffsetY = mod(-state.camera.y * state.camera.zoom, GRID_MINOR * state.camera.zoom);
  const majorOffsetX = mod(-state.camera.x * state.camera.zoom, GRID_MAJOR * state.camera.zoom);
  const majorOffsetY = mod(-state.camera.y * state.camera.zoom, GRID_MAJOR * state.camera.zoom);
  sceneGrid.style.backgroundSize = `${GRID_DOT * state.camera.zoom}px ${GRID_DOT * state.camera.zoom}px, ${GRID_MINOR * state.camera.zoom}px ${GRID_MINOR * state.camera.zoom}px, ${GRID_MAJOR * state.camera.zoom}px ${GRID_MAJOR * state.camera.zoom}px`;
  sceneGrid.style.backgroundPosition = `${dotOffsetX}px ${dotOffsetY}px, ${minorOffsetX}px ${minorOffsetY}px, ${majorOffsetX}px ${majorOffsetY}px`;
  updateMarquee();
}

function renderGroups(layoutResult: LayoutResult) {
  const groups = computePlaygroundGroupLayouts(layoutResult);
  const selectedGroupId = state.selection?.type === "group" ? state.selection.id : null;
  groupLayer.innerHTML = groups
    .map((group) => {
      const selected = selectedGroupId === group.id;
      return `
        <g class="playground-group ${selected ? "selected" : ""}" data-hit="group" data-group-id="${group.id}">
          <rect class="playground-group-frame" x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" rx="18" ry="18"></rect>
          <text class="playground-group-label" x="${group.x + 16}" y="${group.y + 20}">${escapeHtml(group.id)}</text>
        </g>
      `;
    })
    .join("");
}

function renderNodes(layoutResult: LayoutResult) {
  const selectedNodeIds = new Set(getSelectedNodeIds());
  nodeLayer.innerHTML = layoutResult.nodes
    .map((node) => {
      const selected = selectedNodeIds.has(node.id);
      const coordinates = state.showCoordinates ? `<div class="node-coordinates">${formatPointLabel({ x: node.x, y: node.y })}</div>` : "";
      return `
        <div class="node-shell" style="left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px;">
          ${coordinates}
          <div class="node-card ${selected ? "selected" : ""}" data-hit="node" data-node-id="${node.id}" style="width:${node.width}px;height:${node.height}px;">
            <div class="node-center-line horizontal"></div>
            <div class="node-center-line vertical"></div>
            <div class="node-title">${escapeHtml(node.id)}</div>
            <div class="node-resize" data-hit="resize-node" data-node-id="${node.id}"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderEdges(layoutResult: LayoutResult) {
  const selectedEdgeId = state.selection?.type === "edge" ? state.selection.id : state.selection?.type === "segment" ? state.selection.edgeId : null;
  const anchorMarkers = getSelectedAnchorMarkers(layoutResult);
  const preview = state.edgeCreate?.previewWorld ? buildEdgePreviewMarkup(state.edgeCreate.previewWorld, layoutResult) : "";

  edgeLayer.innerHTML = `
    ${layoutResult.lanes.map((lane) => buildLaneMarkup(lane)).join("")}
    ${layoutResult.edges.map((edge) => buildEdgeMarkup(edge, selectedEdgeId === edge.id)).join("")}
    ${anchorMarkers}
    ${preview}
  `;
}

function renderOverlay(autoLayout: LayoutResult, editableLayout: LayoutResult) {
  if (!state.showOverlay) {
    overlayLayer.innerHTML = "";
    return;
  }

  const nodeMarkup = autoLayout.nodes
    .map((node) => {
      const matchingNode = editableLayout.nodes.find((candidate) => candidate.id === node.id);
      if (!matchingNode) {
        return "";
      }
      const matches =
        nearlyEqual(node.x, matchingNode.x) &&
        nearlyEqual(node.y, matchingNode.y) &&
        nearlyEqual(node.width, matchingNode.width) &&
        nearlyEqual(node.height, matchingNode.height);
      return `<rect class="overlay-node ${matches ? "match" : "mismatch"}" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="14" ry="14"></rect>`;
    })
    .join("");

  const edgeMarkup = autoLayout.edges
    .map((edge) => {
      const matchingEdge = editableLayout.edges.find((candidate) => candidate.id === edge.id);
      if (!matchingEdge) {
        return "";
      }
      return `<path class="overlay-edge ${edgeGeometriesMatch(edge, matchingEdge) ? "match" : "mismatch"}" d="${buildRoundedOrthogonalPath(edge.points, 5)}"></path>`;
    })
    .join("");

  overlayLayer.innerHTML = `${nodeMarkup}${edgeMarkup}`;
}

function buildLaneMarkup(lane: LayoutResult["lanes"][number]) {
  const bounds = getVisibleWorldBounds();
  const laneLeft = bounds.left - 240;
  const laneWidth = bounds.right - bounds.left + 480;
  return `
    <g class="lane-band">
      <rect x="${laneLeft}" y="${lane.top}" width="${laneWidth}" height="${lane.bottom - lane.top}" rx="18" ry="18"></rect>
      <line class="lane-band-border" x1="${laneLeft + 18}" y1="${lane.top}" x2="${laneLeft + laneWidth - 18}" y2="${lane.top}"></line>
      <line class="lane-band-border" x1="${laneLeft + 18}" y1="${lane.bottom}" x2="${laneLeft + laneWidth - 18}" y2="${lane.bottom}"></line>
      <text x="${bounds.left - 220}" y="${lane.top + 20}">${escapeHtml(lane.id)}</text>
    </g>
  `;
}

function buildEdgeMarkup(edge: EdgeLayout, selected: boolean) {
  const segments = edge.points
    .slice(0, -1)
    .map((point, index) => {
      const next = edge.points[index + 1];
      if (!next) {
        return "";
      }
      return `<line class="edge-segment-hit" data-hit="segment" data-edge-id="${edge.id}" data-segment-index="${index}" x1="${point.x}" y1="${point.y}" x2="${next.x}" y2="${next.y}"></line>`;
    })
    .join("");

  const arrow = buildArrowHead(edge, selected ? "selected" : "default");
  const segmentLabels = state.showCoordinates
    ? edge.points
    .slice(0, -1)
    .map((point, index) => {
      const next = edge.points[index + 1];
      if (!next) {
        return "";
      }
      const horizontal = nearlyEqual(point.y, next.y);
      const vertical = nearlyEqual(point.x, next.x);
      if (!horizontal && !vertical) {
        return "";
      }
      const center = {
        x: (point.x + next.x) / 2,
        y: (point.y + next.y) / 2,
      };
      const label = horizontal ? `y:${Math.round(point.y)}` : `x:${Math.round(point.x)}`;
      const labelX = horizontal ? center.x : center.x + 12;
      const labelY = horizontal ? center.y - 8 : center.y;
      return `<text class="edge-coordinate-label" x="${labelX}" y="${labelY}">${label}</text>`;
    })
    .join("")
    : "";
  const pathData = buildRoundedOrthogonalPath(edge.points, 5);
  return `
    <g class="edge-group ${selected ? "selected" : ""}" data-hit="edge" data-edge-id="${edge.id}">
      <path class="edge-path" d="${pathData}"></path>
      ${segments}
      ${segmentLabels}
      ${arrow}
    </g>
  `;
}

function buildArrowHead(edge: EdgeLayout, mode: "selected" | "default") {
  const lastPoint = edge.points[edge.points.length - 1];
  const previousPoint = edge.points[edge.points.length - 2];
  if (!lastPoint || !previousPoint) {
    return "";
  }
  const angle = Math.atan2(lastPoint.y - previousPoint.y, lastPoint.x - previousPoint.x);
  const length = 10;
  const spread = Math.PI / 6;
  const left = {
    x: lastPoint.x - Math.cos(angle - spread) * length,
    y: lastPoint.y - Math.sin(angle - spread) * length,
  };
  const right = {
    x: lastPoint.x - Math.cos(angle + spread) * length,
    y: lastPoint.y - Math.sin(angle + spread) * length,
  };
  return `<polygon class="edge-arrow ${mode}" points="${lastPoint.x},${lastPoint.y} ${left.x},${left.y} ${right.x},${right.y}"></polygon>`;
}

function getSelectedAnchorMarkers(layoutResult: LayoutResult) {
  if (!state.selection || state.selection.type === "node" || state.selection.type === "group") {
    return "";
  }
  const edgeId = state.selection.type === "edge" ? state.selection.id : state.selection.edgeId;
  const edge = layoutResult.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) {
    return "";
  }
  return [edge.sourceAnchor, edge.targetAnchor]
    .map((anchor) => {
      const offset = anchorSideVector(anchor.side);
      const point = { x: anchor.x + offset.x * HANDLE_RADIUS, y: anchor.y + offset.y * HANDLE_RADIUS };
      return `<circle class="anchor-marker" cx="${point.x}" cy="${point.y}" r="${HANDLE_RADIUS}"></circle>`;
    })
    .join("");
}

function buildEdgePreviewMarkup(target: Point, layoutResult: LayoutResult) {
  if (!state.edgeCreate) {
    return "";
  }
  const sourceNode = layoutResult.nodes.find((node) => node.id === state.edgeCreate?.sourceId);
  if (!sourceNode) {
    return "";
  }
  const sourceAnchor = createAnchor(sourceNode, "right", 0);
  return `<line class="edge-preview" x1="${sourceAnchor.x}" y1="${sourceAnchor.y}" x2="${target.x}" y2="${target.y}"></line>`;
}

function renderInspector() {
  const inspectorError = derived.autoResponse.ok ? null : escapeHtml(derived.autoResponse.error.message);

  if (!state.selection && state.selectedNodeIds.length > 1) {
    const groupIds = [...new Set(state.selectedNodeIds.map((nodeId) => state.request.nodes.find((node) => node.id === nodeId)?.groupId).filter(Boolean))];
    inspector.innerHTML = `
      ${inspectorError ? `<p class="helper-text">${inspectorError}</p>` : ""}
      <p class="helper-text">${state.selectedNodeIds.length} nodes selected.</p>
      <p class="helper-text">${groupIds.length === 1 ? `Shared group: ${escapeHtml(groupIds[0] ?? "")}` : "Press G to create a group."}</p>
      <button id="group-selected" type="button">Group selection</button>
      <button id="ungroup-selected" type="button">Ungroup selection</button>
    `;
    inspector.querySelector<HTMLButtonElement>("#group-selected")?.addEventListener("click", groupSelection);
    inspector.querySelector<HTMLButtonElement>("#ungroup-selected")?.addEventListener("click", ungroupSelection);
    return;
  }

  if (!state.selection) {
    inspector.innerHTML = `
      <p class="empty-state">${inspectorError ?? "Select a node or edge to edit its details."}</p>
    `;
    return;
  }

  if (state.selection.type === "group") {
    const nodeIds = getNodeIdsForGroup(state.selection.id);
    inspector.innerHTML = `
      ${inspectorError ? `<p class="helper-text">${inspectorError}</p>` : ""}
      <p class="helper-text">Group ${escapeHtml(state.selection.id)} contains ${nodeIds.length} nodes.</p>
      <button id="ungroup-selected" type="button">Ungroup</button>
    `;
    inspector.querySelector<HTMLButtonElement>("#ungroup-selected")?.addEventListener("click", ungroupSelection);
    return;
  }

  if (state.selection.type === "node") {
    const nodeId = state.selection.id;
    const nodeInput = state.request.nodes.find((node) => node.id === nodeId);
    if (!nodeInput) {
      inspector.innerHTML = `<p class="empty-state">Selected node no longer exists.</p>`;
      return;
    }

    inspector.innerHTML = `
      ${inspectorError ? `<p class="helper-text">${inspectorError}</p>` : ""}
      <div class="form-row">
        <label for="node-id">Node id</label>
        <input id="node-id" value="${escapeHtml(nodeInput.id)}" />
      </div>
      <div class="form-row">
        <label for="node-lane">Lane</label>
        <select id="node-lane">${state.request.lanes.map((lane) => `<option value="${lane.id}">${lane.id}</option>`).join("")}</select>
      </div>
      <div class="form-row">
        <label for="node-group">Group</label>
        <select id="node-group">${renderGroupOptions(nodeInput.groupId ?? "")}</select>
      </div>
      <div class="form-row split-row">
        <div>
          <label for="node-width">Width</label>
          <input id="node-width" type="number" min="20" value="${nodeInput.width ?? state.request.defaults.nodeWidth}" />
        </div>
        <div>
          <label for="node-height">Height</label>
          <input id="node-height" type="number" min="20" value="${nodeInput.height ?? state.request.defaults.nodeHeight}" />
        </div>
      </div>
      <button id="delete-node" class="danger-button" type="button">Delete node</button>
    `;

    const laneSelect = inspector.querySelector<HTMLSelectElement>("#node-lane");
    const groupSelect = inspector.querySelector<HTMLSelectElement>("#node-group");
    const idInput = inspector.querySelector<HTMLInputElement>("#node-id");
    const widthInput = inspector.querySelector<HTMLInputElement>("#node-width");
    const heightInput = inspector.querySelector<HTMLInputElement>("#node-height");
    if (laneSelect) {
      laneSelect.value = nodeInput.laneId;
      laneSelect.addEventListener("change", () => {
        nodeInput.laneId = laneSelect.value;
        selectedLaneId = laneSelect.value;
        state.status = `Lane for ${nodeInput.id} updated to ${laneSelect.value}.`;
        updateDerivedAndRender();
      });
    }
    if (groupSelect) {
      groupSelect.value = nodeInput.groupId ?? "";
      groupSelect.addEventListener("change", () => {
        setNodeGroup(nodeInput.id, groupSelect.value || null);
      });
    }
    idInput?.addEventListener("change", () => renameNode(nodeInput.id, idInput.value.trim()));
    widthInput?.addEventListener("change", () => {
      nodeInput.width = normalizeOptionalNumber(widthInput.value, state.request.defaults.nodeWidth);
      updateDerivedAndRender();
    });
    heightInput?.addEventListener("change", () => {
      nodeInput.height = normalizeOptionalNumber(heightInput.value, state.request.defaults.nodeHeight);
      updateDerivedAndRender();
    });
    inspector.querySelector<HTMLButtonElement>("#delete-node")?.addEventListener("click", deleteSelection);
    return;
  }

  if (state.selection.type === "edge") {
    const edgeId = state.selection.id;
    const edgeInput = state.request.edges.find((edge) => edge.id === edgeId);
    if (!edgeInput) {
      inspector.innerHTML = `<p class="empty-state">Selected edge no longer exists.</p>`;
      return;
    }

    inspector.innerHTML = `
      ${inspectorError ? `<p class="helper-text">${inspectorError}</p>` : ""}
      <div class="form-row">
        <label for="edge-id">Edge id</label>
        <input id="edge-id" value="${escapeHtml(edgeInput.id)}" />
      </div>
      <div class="form-row split-row">
        <div>
          <label for="edge-source">Source</label>
          <select id="edge-source">${renderNodeOptions(edgeInput.sourceId)}</select>
        </div>
        <div>
          <label for="edge-target">Target</label>
          <select id="edge-target">${renderNodeOptions(edgeInput.targetId)}</select>
        </div>
      </div>
      <p class="helper-text">Double-click a segment to add a bend point. Drag segments to keep orthogonal edges.</p>
      <button id="delete-edge" class="danger-button" type="button">Delete edge</button>
    `;
    inspector.querySelector<HTMLInputElement>("#edge-id")?.addEventListener("change", (event) => {
      renameEdge(edgeInput.id, (event.currentTarget as HTMLInputElement).value.trim());
    });
    inspector.querySelector<HTMLSelectElement>("#edge-source")?.addEventListener("change", (event) => {
      edgeInput.sourceId = (event.currentTarget as HTMLSelectElement).value;
      clearEdgeOverride(edgeInput.id);
      updateDerivedAndRender();
    });
    inspector.querySelector<HTMLSelectElement>("#edge-target")?.addEventListener("change", (event) => {
      edgeInput.targetId = (event.currentTarget as HTMLSelectElement).value;
      clearEdgeOverride(edgeInput.id);
      updateDerivedAndRender();
    });
    inspector.querySelector<HTMLButtonElement>("#delete-edge")?.addEventListener("click", deleteSelection);
    return;
  }

  const segmentSelection = state.selection;
  const edge = state.request.edges.find((candidate) => candidate.id === segmentSelection.edgeId);
  inspector.innerHTML = edge
    ? `${inspectorError ? `<p class="helper-text">${inspectorError}</p>` : ""}<p class="helper-text">Editing segment ${segmentSelection.segmentIndex} on ${escapeHtml(edge.id)}. Drag it to move the orthogonal path.</p>`
    : `<p class="empty-state">${inspectorError ?? "Selected segment no longer exists."}</p>`;
}

function renderGraphLists() {
  const laneItems = [...state.request.lanes]
    .sort((left, right) => left.order - right.order)
    .map((lane) => {
      const nodeCount = state.request.nodes.filter((node) => node.laneId === lane.id).length;
      const selectedClass = selectedLaneId === lane.id ? "selected" : "";
      const disabled = state.request.lanes.length <= 1 || nodeCount > 0;
      return `
        <div class="lane-row ${selectedClass}">
          <button class="list-item lane-select ${selectedClass}" data-kind="lane" data-id="${lane.id}" type="button">
            ${escapeHtml(lane.id)} <span>order ${lane.order}${nodeCount > 0 ? ` / ${nodeCount} nodes` : ""}</span>
          </button>
          <button class="lane-remove" data-kind="remove-lane" data-id="${lane.id}" type="button" ${disabled ? "disabled" : ""}>−</button>
        </div>
      `;
    })
    .join("");
  const nodeItems = state.request.nodes
    .map((node) => `<button class="list-item ${state.selectedNodeIds.includes(node.id) ? "selected" : ""}" data-kind="node" data-id="${node.id}" type="button">${escapeHtml(node.id)} <span>${escapeHtml(node.laneId)}${formatVisibleGroupSuffix(node.id)}</span></button>`)
    .join("");
  const edgeItems = state.request.edges
    .map((edge) => `<button class="list-item ${state.selection?.type === "edge" && state.selection.id === edge.id ? "selected" : ""}" data-kind="edge" data-id="${edge.id}" type="button">${escapeHtml(edge.id)} <span>${escapeHtml(edge.sourceId)} → ${escapeHtml(edge.targetId)}</span></button>`)
    .join("");

  graphLists.innerHTML = `
    <div>
      <div class="subsection-head">
        <h3>Lanes</h3>
        <button id="add-lane" class="mini-button" type="button">Add lane</button>
      </div>
      <div class="list-grid">${laneItems || `<p class="empty-state">No lanes.</p>`}</div>
    </div>
    <div>
      <h3>Nodes</h3>
      <div class="list-grid">${nodeItems || `<p class="empty-state">No nodes.</p>`}</div>
    </div>
    <div>
      <h3>Edges</h3>
      <div class="list-grid">${edgeItems || `<p class="empty-state">No edges.</p>`}</div>
    </div>
  `;

  graphLists.querySelector<HTMLButtonElement>("#add-lane")?.addEventListener("click", addLane);
  graphLists.querySelectorAll<HTMLButtonElement>(".list-item").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      const kind = button.dataset.kind;
      if (!id || !kind) {
        return;
      }
      if (kind === "lane") {
        selectedLaneId = id;
        state.status = `Lane ${id} selected as default.`;
        render();
        return;
      }
      if (kind === "node") {
        selectNodeFromList(id);
      } else {
        state.selection = { type: "edge", id };
        state.selectedNodeIds = [];
      }
      state.status = `${kind} ${id} selected.`;
      render();
    });
  });

  graphLists.querySelectorAll<HTMLButtonElement>(".lane-remove").forEach((button) => {
    button.addEventListener("click", () => {
      const laneId = button.dataset.id;
      if (laneId) {
        removeLane(laneId);
      }
    });
  });
}

function selectNodeFromList(nodeId: string) {
  const node = state.request.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    state.status = `Node ${nodeId} no longer exists.`;
    return;
  }
  selectedLaneId = node.laneId;
  selectSingleNode(nodeId);
}

function addLane() {
  const nextOrder = state.request.lanes.reduce((max, lane) => Math.max(max, lane.order), -1) + 1;
  const nextId = createUniqueId("lane", state.request.lanes.map((lane) => lane.id));
  state.request.lanes.push({ id: nextId, order: nextOrder });
  selectedLaneId = nextId;
  state.status = `Added lane ${nextId}.`;
  updateDerivedAndRender();
}

function removeLane(laneId: string) {
  if (state.request.lanes.length <= 1) {
    state.status = "Cannot remove the last lane.";
    render();
    return;
  }
  if (state.request.nodes.some((node) => node.laneId === laneId)) {
    state.status = `Cannot remove ${laneId} while nodes are assigned to it.`;
    render();
    return;
  }
  state.request.lanes = state.request.lanes.filter((lane) => lane.id !== laneId);
  if (selectedLaneId === laneId) {
    selectedLaneId = state.request.lanes.sort((left, right) => left.order - right.order)[0]?.id ?? "lane-0";
  }
  state.status = `Removed lane ${laneId}.`;
  updateDerivedAndRender();
}

function handlePointerDown(event: PointerEvent) {
  lastPointerScreen = getScreenPoint(event);
  if (!derived.editableLayout) {
    return;
  }
  if (event.button === 2) {
    dragState = {
      type: "pan",
      pointerId: event.pointerId,
      startScreen: getScreenPoint(event),
      startCamera: { ...state.camera },
    };
    sceneRoot.setPointerCapture(event.pointerId);
    render();
    return;
  }
  if (event.button !== 0) {
    return;
  }
  const target = event.target as HTMLElement | SVGElement;
  const screenPoint = getScreenPoint(event);
  const worldPoint = screenToWorld(screenPoint);
  const hit = resolveHitTarget(target, worldPoint, derived.editableLayout);

  if (state.edgeCreate) {
    if (hit?.type === "node") {
      completeEdgeCreation(hit.id);
    } else {
      state.edgeCreate.previewWorld = worldPoint;
      state.status = "Click a target node to create the edge.";
      render();
    }
    return;
  }

  if (hit?.type === "resize-node") {
    selectSingleNode(hit.id);
    const node = derived.editableLayout.nodes.find((candidate) => candidate.id === hit.id);
    if (!node) {
      return;
    }
    dragState = {
      type: "resize-node",
      pointerId: event.pointerId,
      nodeId: hit.id,
      startWorld: worldPoint,
      startWidth: node.width,
      startHeight: node.height,
    };
    sceneRoot.setPointerCapture(event.pointerId);
    render();
    return;
  }

  if (hit?.type === "segment") {
    const edge = derived.editableLayout.edges.find((candidate) => candidate.id === hit.edgeId);
    if (!edge) {
      return;
    }
    state.selection = { type: "edge", id: hit.edgeId };
    state.selectedNodeIds = [];
    dragState = {
      type: "segment",
      pointerId: event.pointerId,
      edgeId: hit.edgeId,
      segmentIndex: hit.segmentIndex,
      startWorld: worldPoint,
      startPoints: edge.points.map((point) => ({ ...point })),
    };
    sceneRoot.setPointerCapture(event.pointerId);
    render();
    return;
  }

  if (hit?.type === "group") {
    state.selection = { type: "group", id: hit.id };
    state.selectedNodeIds = getNodeIdsForGroup(hit.id);
    render();
    return;
  }

  if (hit?.type === "node") {
    selectSingleNode(hit.id);
    const node = derived.editableLayout.nodes.find((candidate) => candidate.id === hit.id);
    if (!node) {
      return;
    }
    dragState = {
      type: "node",
      pointerId: event.pointerId,
      nodeId: hit.id,
      offset: { x: worldPoint.x - node.x, y: worldPoint.y - node.y },
    };
    sceneRoot.setPointerCapture(event.pointerId);
    render();
    return;
  }

  if (hit?.type === "edge") {
    state.selection = { type: "edge", id: hit.id };
    state.selectedNodeIds = [];
    render();
    return;
  }

  state.selection = null;
  state.selectedNodeIds = [];
  dragState = {
    type: "marquee",
    pointerId: event.pointerId,
    startScreen: screenPoint,
    currentScreen: screenPoint,
  };
  sceneRoot.setPointerCapture(event.pointerId);
  render();
}

function handlePointerMove(event: PointerEvent) {
  lastPointerScreen = getScreenPoint(event);
  const worldPoint = screenToWorld(lastPointerScreen);

  if (state.edgeCreate) {
    state.edgeCreate.previewWorld = worldPoint;
    render();
  }

  if (!dragState || dragState.pointerId !== event.pointerId || !derived.editableLayout) {
    return;
  }

  if (dragState.type === "pan") {
    const current = getScreenPoint(event);
    const deltaX = (current.x - dragState.startScreen.x) / state.camera.zoom;
    const deltaY = (current.y - dragState.startScreen.y) / state.camera.zoom;
    state.camera.x = dragState.startCamera.x - deltaX;
    state.camera.y = dragState.startCamera.y - deltaY;
    render();
    return;
  }

  if (dragState.type === "marquee") {
    dragState.currentScreen = getScreenPoint(event);
    updateMarqueeSelection(dragState, derived.editableLayout);
    render();
    return;
  }

  if (dragState.type === "node") {
    const nodeDrag = dragState;
    const nodeInput = state.request.nodes.find((candidate) => candidate.id === nodeDrag.nodeId);
    const targetY = worldPoint.y - nodeDrag.offset.y;
    const nearestLaneId = getNearestLaneId(targetY);
    if (nodeInput && nearestLaneId && nodeInput.laneId !== nearestLaneId) {
      nodeInput.laneId = nearestLaneId;
      selectedLaneId = nearestLaneId;
    }
    state.nodeOverrides[nodeDrag.nodeId] = { x: snap(worldPoint.x - nodeDrag.offset.x) };
    state.status = nodeInput ? `Moved node ${nodeDrag.nodeId} to ${nodeInput.laneId}.` : `Moved node ${nodeDrag.nodeId}.`;
    updateDerivedAndRender();
    return;
  }

  if (dragState.type === "resize-node") {
    const resizeDrag = dragState;
    const nodeInput = state.request.nodes.find((candidate) => candidate.id === resizeDrag.nodeId);
    if (!nodeInput) {
      return;
    }
    nodeInput.width = Math.max(40, snap(resizeDrag.startWidth + (worldPoint.x - resizeDrag.startWorld.x)));
    nodeInput.height = Math.max(30, snap(resizeDrag.startHeight + (worldPoint.y - resizeDrag.startWorld.y)));
    state.status = `Resized node ${resizeDrag.nodeId}.`;
    updateDerivedAndRender();
    return;
  }

  const segmentDrag = dragState;
  ensureEdgeOverrideExists(segmentDrag.edgeId, derived.editableLayout);
  const override = state.edgeOverrides[segmentDrag.edgeId];
  const edge = derived.editableLayout.edges.find((candidate) => candidate.id === segmentDrag.edgeId);
  if (!override || !edge) {
    return;
  }

  const nextPoints = moveOrthogonalSegment(
    segmentDrag.startPoints,
    segmentDrag.segmentIndex,
    {
      x: snap(worldPoint.x - segmentDrag.startWorld.x),
      y: snap(worldPoint.y - segmentDrag.startWorld.y),
    },
  );
  const sourceAnchorBase = override.sourceAnchor ?? edge.sourceAnchor;
  const targetAnchorBase = override.targetAnchor ?? edge.targetAnchor;

  if (segmentDrag.segmentIndex === 0 && nextPoints[0]) {
    override.sourceAnchor = { ...sourceAnchorBase, x: nextPoints[0].x, y: nextPoints[0].y };
  }
  if (segmentDrag.segmentIndex === edge.points.length - 2 && nextPoints[nextPoints.length - 1]) {
    override.targetAnchor = { ...targetAnchorBase, x: nextPoints[nextPoints.length - 1].x, y: nextPoints[nextPoints.length - 1].y };
  }
  if (nextPoints[0]) {
    const pinnedSource = segmentDrag.segmentIndex === 0 ? (override.sourceAnchor ?? sourceAnchorBase) : sourceAnchorBase;
    nextPoints[0] = { x: pinnedSource.x, y: pinnedSource.y };
  }
  if (nextPoints[nextPoints.length - 1]) {
    const pinnedTarget =
      segmentDrag.segmentIndex === edge.points.length - 2 ? (override.targetAnchor ?? targetAnchorBase) : targetAnchorBase;
    nextPoints[nextPoints.length - 1] = { x: pinnedTarget.x, y: pinnedTarget.y };
  }

  override.points = nextPoints;
  state.status = `Adjusted geometry for ${segmentDrag.edgeId}.`;
  updateDerivedAndRender();
}

function handlePointerUp(event: PointerEvent) {
  if (dragState?.pointerId === event.pointerId) {
    if (dragState.type === "marquee") {
      finalizeMarqueeSelection();
    }
    dragState = null;
    sceneRoot.releasePointerCapture(event.pointerId);
    render();
  }
}

function handleDoubleClick(event: MouseEvent) {
  if (!derived.editableLayout) {
    return;
  }
  const target = event.target as HTMLElement | SVGElement;
  const hit = resolveHitTarget(target, screenToWorld(getScreenPoint(event)), derived.editableLayout);
  if (!hit || hit.type !== "segment") {
    return;
  }
  const edge = derived.editableLayout.edges.find((candidate) => candidate.id === hit.edgeId);
  if (!edge) {
    return;
  }

  ensureEdgeOverrideExists(edge.id, derived.editableLayout);
  const override = state.edgeOverrides[edge.id];
  if (!override) {
    return;
  }

  const nextPoints = edge.points.map((point) => ({ ...point }));
  const insertionIndex = hit.segmentIndex + 1;
  const screenPoint = screenToWorld(getScreenPoint(event));
  const start = nextPoints[hit.segmentIndex];
  const end = nextPoints[insertionIndex];
  if (!start || !end) {
    return;
  }
  const inserted = nearlyEqual(start.y, end.y)
    ? { x: snap(screenPoint.x), y: start.y }
    : { x: start.x, y: snap(screenPoint.y) };
  nextPoints.splice(insertionIndex, 0, inserted);
  override.points = nextPoints;
  state.selection = { type: "segment", edgeId: edge.id, segmentIndex: hit.segmentIndex };
  state.selectedNodeIds = [];
  state.status = `Added bend point to ${edge.id}.`;
  updateDerivedAndRender();
}

function handleWheel(event: WheelEvent) {
  event.preventDefault();
  if (event.ctrlKey || event.metaKey) {
    const zoomMultiplier = Math.exp(-event.deltaY * 0.0015);
    zoomAtScreenPoint(getScreenPoint(event), zoomMultiplier);
    return;
  }

  state.camera.x += event.deltaX / state.camera.zoom;
  state.camera.y += event.deltaY / state.camera.zoom;
  render();
}

function handleKeyDown(event: KeyboardEvent) {
  const isDeleteKey = event.key === "Backspace" || event.key === "Delete";
  if (isEditingElement(event.target)) {
    return;
  }
  if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
    event.preventDefault();
    toggleShortcutsPopup();
    return;
  }
  if ((event.key === "g" || event.key === "G") && event.shiftKey) {
    event.preventDefault();
    ungroupSelection();
    return;
  }
  if (event.key === "g" || event.key === "G") {
    event.preventDefault();
    groupSelection();
    return;
  }
  if (event.key === "n" || event.key === "N") {
    event.preventDefault();
    addNodeAtViewportCenter();
    return;
  }
  if (event.key === "e" || event.key === "E") {
    event.preventDefault();
    startEdgeMode();
    return;
  }
  if (event.key === "o" || event.key === "O") {
    event.preventDefault();
    state.showOverlay = !state.showOverlay;
    render();
    return;
  }
  if (event.key === "Escape" && state.edgeCreate) {
    state.edgeCreate = null;
    state.status = "Edge creation canceled.";
    render();
    return;
  }
  if (event.key === "Escape" && state.showTestBrowser) {
    closeTestBrowser();
    return;
  }
  if (event.key === "Escape" && state.showShortcuts) {
    state.showShortcuts = false;
    render();
    return;
  }
  if (isDeleteKey && state.selection) {
    event.preventDefault();
    deleteSelection();
    return;
  }
  if (isDeleteKey && state.selectedNodeIds.length > 0) {
    event.preventDefault();
    deleteSelection();
  }
}

function resolveHitTarget(target: HTMLElement | SVGElement, worldPoint: Point, layoutResult: LayoutResult): HitTarget {
  const element = target.closest<HTMLElement | SVGElement>("[data-hit]");
  const hitType = element?.getAttribute("data-hit");
  if (hitType === "group") {
    const id = element?.getAttribute("data-group-id");
    return id ? { type: "group", id } : null;
  }
  if (hitType === "resize-node") {
    const id = element?.getAttribute("data-node-id");
    return id ? { type: "resize-node", id } : null;
  }
  if (hitType === "node") {
    const id = element?.getAttribute("data-node-id");
    return id ? { type: "node", id } : null;
  }
  if (hitType === "segment") {
    const edgeId = element?.getAttribute("data-edge-id");
    const rawIndex = element?.getAttribute("data-segment-index");
    if (edgeId && rawIndex) {
      return { type: "segment", edgeId, segmentIndex: Number(rawIndex) };
    }
  }
  if (hitType === "edge") {
    const id = element?.getAttribute("data-edge-id");
    return id ? { type: "edge", id } : null;
  }

  const node = [...layoutResult.nodes].reverse().find((candidate) => pointInsideNode(worldPoint, candidate));
  if (node) {
    return { type: "node", id: node.id };
  }
  return null;
}

function addNodeAtViewportCenter() {
  const nextId = createUniqueId("node", state.request.nodes.map((node) => node.id));
  const anchorScreen = lastPointerScreen ?? viewportCenterScreen();
  const anchorWorld = screenToWorld(anchorScreen);
  const laneId =
    getNearestLaneId(anchorWorld.y) ??
    (state.request.lanes.some((lane) => lane.id === selectedLaneId) ? selectedLaneId : state.request.lanes[0]?.id);
  if (!laneId) {
    state.status = "Cannot add a node without at least one lane.";
    render();
    return;
  }

  const selectedNodeIds = getSelectedNodeIds();
  const sourceId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
  const groupId = getNearestGroupId(anchorWorld);
  state.request.nodes.push({ id: nextId, laneId, groupId: groupId ?? undefined });
  if (sourceId) {
    const nextEdgeId = createUniqueId("edge", state.request.edges.map((edge) => edge.id));
    state.request.edges.push({ id: nextEdgeId, sourceId, targetId: nextId });
    state.status = groupId
      ? `Added ${nextId} on ${laneId} in ${groupId} and connected ${sourceId} -> ${nextId}.`
      : `Added ${nextId} on ${laneId} and connected ${sourceId} -> ${nextId}.`;
  } else {
    state.status = groupId ? `Added ${nextId} on ${laneId} in ${groupId}.` : `Added ${nextId} on ${laneId}.`;
  }
  selectedLaneId = laneId;
  selectSingleNode(nextId);
  updateDerivedAndRender();
}

function startEdgeMode() {
  const selectedNodeId = getSelectedNodeIds()[0] ?? state.request.nodes[0]?.id;
  if (!selectedNodeId) {
    state.status = "Add a node before creating edges.";
    render();
    return;
  }
  state.edgeCreate = { sourceId: selectedNodeId, previewWorld: null };
  state.status = `Edge mode active. Click the target for ${selectedNodeId}.`;
  render();
}

function completeEdgeCreation(targetId: string) {
  const sourceId = state.edgeCreate?.sourceId;
  if (!sourceId) {
    return;
  }
  if (sourceId === targetId) {
    state.status = "Self-referential edges are not supported.";
    state.edgeCreate = null;
    render();
    return;
  }
  const nextId = createUniqueId("edge", state.request.edges.map((edge) => edge.id));
  state.request.edges.push({ id: nextId, sourceId, targetId });
  state.selection = { type: "edge", id: nextId };
  state.selectedNodeIds = [];
  state.edgeCreate = null;
  state.status = `Created ${nextId}: ${sourceId} -> ${targetId}.`;
  updateDerivedAndRender();
}

function deleteSelection() {
  const selectedNodeIds = getSelectedNodeIds();
  if (!state.selection && selectedNodeIds.length === 0) {
    return;
  }
  if (state.selection?.type === "group") {
    state.status = "Press Shift+G to ungroup the selected group.";
    render();
    return;
  }
  if (selectedNodeIds.length > 0) {
    const selectedNodeIdSet = new Set(selectedNodeIds);
    state.request.nodes = state.request.nodes.filter((node) => !selectedNodeIdSet.has(node.id));
    state.request.edges = state.request.edges.filter((edge) => !selectedNodeIdSet.has(edge.sourceId) && !selectedNodeIdSet.has(edge.targetId));
    selectedNodeIds.forEach((nodeId) => {
      delete state.nodeOverrides[nodeId];
    });
    Object.keys(state.edgeOverrides).forEach((edgeId) => {
      if (!state.request.edges.some((edge) => edge.id === edgeId)) {
        delete state.edgeOverrides[edgeId];
      }
    });
    cleanupGroupsAfterNodeChanges();
    state.status = selectedNodeIds.length === 1 ? `Deleted node ${selectedNodeIds[0]} and its connected edges.` : `Deleted ${selectedNodeIds.length} selected nodes.`;
  } else if (state.selection?.type === "edge") {
    const edgeId = state.selection.id;
    state.request.edges = state.request.edges.filter((edge) => edge.id !== edgeId);
    delete state.edgeOverrides[edgeId];
    state.status = `Deleted edge ${edgeId}.`;
  } else {
    state.status = "Select the edge to delete it. Segment selection is for dragging only.";
  }
  state.selection = null;
  state.selectedNodeIds = [];
  updateDerivedAndRender();
}

function renameNode(currentId: string, nextId: string) {
  if (!nextId || nextId === currentId) {
    render();
    return;
  }
  if (state.request.nodes.some((node) => node.id === nextId)) {
    state.status = `Node id ${nextId} already exists.`;
    render();
    return;
  }
  const node = state.request.nodes.find((candidate) => candidate.id === currentId);
  if (!node) {
    return;
  }
  node.id = nextId;
  state.request.edges.forEach((edge) => {
    if (edge.sourceId === currentId) {
      edge.sourceId = nextId;
    }
    if (edge.targetId === currentId) {
      edge.targetId = nextId;
    }
  });
  if (state.nodeOverrides[currentId]) {
    state.nodeOverrides[nextId] = state.nodeOverrides[currentId];
    delete state.nodeOverrides[currentId];
  }
  state.selectedNodeIds = state.selectedNodeIds.map((nodeId) => (nodeId === currentId ? nextId : nodeId));
  state.selection = { type: "node", id: nextId };
  state.status = `Renamed node ${currentId} to ${nextId}.`;
  updateDerivedAndRender();
}

function renameEdge(currentId: string, nextId: string) {
  if (!nextId || nextId === currentId) {
    render();
    return;
  }
  if (state.request.edges.some((edge) => edge.id === nextId)) {
    state.status = `Edge id ${nextId} already exists.`;
    render();
    return;
  }
  const edge = state.request.edges.find((candidate) => candidate.id === currentId);
  if (!edge) {
    return;
  }
  edge.id = nextId;
  if (state.edgeOverrides[currentId]) {
    state.edgeOverrides[nextId] = state.edgeOverrides[currentId];
    delete state.edgeOverrides[currentId];
  }
  state.selection = { type: "edge", id: nextId };
  state.selectedNodeIds = [];
  state.status = `Renamed edge ${currentId} to ${nextId}.`;
  updateDerivedAndRender();
}

function clearEdgeOverride(edgeId: string) {
  delete state.edgeOverrides[edgeId];
}

function ensureEdgeOverrideExists(edgeId: string, layoutResult: LayoutResult) {
  if (state.edgeOverrides[edgeId]) {
    return;
  }
  const edge = layoutResult.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) {
    return;
  }
  state.edgeOverrides[edgeId] = {
    sourceAnchor: { ...edge.sourceAnchor },
    targetAnchor: { ...edge.targetAnchor },
    points: edge.points.map((point) => ({ ...point })),
  };
}

function selectSingleNode(nodeId: string) {
  state.selection = { type: "node", id: nodeId };
  state.selectedNodeIds = [nodeId];
}

function toggleShortcutsPopup() {
  state.showShortcuts = !state.showShortcuts;
  render();
}

function getSelectedNodeIds() {
  if (state.selectedNodeIds.length > 0) {
    return state.selectedNodeIds.filter((nodeId) => state.request.nodes.some((node) => node.id === nodeId));
  }
  if (state.selection?.type === "node") {
    return [state.selection.id];
  }
  if (state.selection?.type === "group") {
    return getNodeIdsForGroup(state.selection.id);
  }
  return [];
}

function getNodeIdsForGroup(groupId: string) {
  return state.request.nodes.filter((node) => node.groupId === groupId).map((node) => node.id);
}

function computePlaygroundGroupLayouts(layoutResult: LayoutResult): PlaygroundGroupLayout[] {
  if (!state.request.groups?.length) {
    return [];
  }
  const nodeLayoutById = new Map(layoutResult.nodes.map((node) => [node.id, node]));
  return [...state.request.groups]
    .sort((left, right) => left.order - right.order)
    .flatMap((group) => {
      const members = state.request.nodes
        .filter((node) => node.groupId === group.id)
        .map((node) => nodeLayoutById.get(node.id))
        .filter((node): node is NodeLayout => Boolean(node));
      if (members.length === 0) {
        return [];
      }
      if (members.length <= 1) {
        return [];
      }
      const paddingX = 20;
      const paddingTop = 28;
      const paddingBottom = 16;
      const left = Math.min(...members.map((node) => node.x)) - paddingX;
      const top = Math.min(...members.map((node) => node.y)) - paddingTop;
      const right = Math.max(...members.map((node) => node.x + node.width)) + paddingX;
      const bottom = Math.max(...members.map((node) => node.y + node.height)) + paddingBottom;
      return [{
        id: group.id,
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        nodeIds: members.map((node) => node.id),
      }];
    });
}

function groupSelection() {
  const selectedNodeIds = [...new Set(getSelectedNodeIds())];
  if (selectedNodeIds.length < 2) {
    state.status = "Select at least two nodes to create a group.";
    render();
    return;
  }
  ensureAllNodesHaveGroups();
  const nextGroupId = createUniqueId("group", state.request.groups?.map((group) => group.id) ?? []);
  state.request.groups = [...(state.request.groups ?? []), { id: nextGroupId, order: state.request.groups?.length ?? 0 }];
  state.request.nodes.forEach((node) => {
    if (selectedNodeIds.includes(node.id)) {
      node.groupId = nextGroupId;
    }
  });
  normalizeGroupState();
  state.selection = { type: "group", id: nextGroupId };
  state.selectedNodeIds = selectedNodeIds;
  state.status = `Grouped ${selectedNodeIds.length} nodes into ${nextGroupId}.`;
  updateDerivedAndRender();
}

function ungroupSelection() {
  const groupId = state.selection?.type === "group"
    ? state.selection.id
    : (() => {
        const groupIds = [...new Set(getSelectedNodeIds().map((nodeId) => state.request.nodes.find((node) => node.id === nodeId)?.groupId).filter(Boolean))];
        return groupIds.length === 1 ? (groupIds[0] ?? null) : null;
      })();
  if (!groupId) {
    state.status = "Select nodes from a single group, or select the group frame, to ungroup.";
    render();
    return;
  }
  if (!state.request.groups?.some((group) => group.id === groupId)) {
    state.status = `Group ${groupId} no longer exists.`;
    render();
    return;
  }
  const nodeIds = getNodeIdsForGroup(groupId);
  const remainingGroupIds = new Set((state.request.groups ?? []).map((group) => group.id));
  remainingGroupIds.delete(groupId);
  if (remainingGroupIds.size === 0) {
    state.request.groups = undefined;
    state.request.nodes.forEach((node) => {
      node.groupId = undefined;
    });
  } else {
    state.request.groups = (state.request.groups ?? []).filter((group) => group.id !== groupId);
    nodeIds.forEach((nodeId) => {
      const replacementId = createUniqueId("group", state.request.groups?.map((group) => group.id) ?? []);
      state.request.groups = [...(state.request.groups ?? []), { id: replacementId, order: state.request.groups?.length ?? 0 }];
      const node = state.request.nodes.find((candidate) => candidate.id === nodeId);
      if (node) {
        node.groupId = replacementId;
      }
    });
    normalizeGroupState(true);
  }
  state.selection = null;
  state.selectedNodeIds = nodeIds;
  state.status = `Ungrouped ${groupId}.`;
  updateDerivedAndRender();
}

function ensureAllNodesHaveGroups() {
  const groups = [...(state.request.groups ?? [])];
  state.request.nodes.forEach((node) => {
    if (node.groupId) {
      return;
    }
    const groupId = createUniqueId("group", groups.map((group) => group.id));
    groups.push({ id: groupId, order: groups.length });
    node.groupId = groupId;
  });
  state.request.groups = groups;
}

function normalizeGroupState(collapseAllSingletons = false) {
  if (!state.request.groups?.length) {
    state.request.groups = undefined;
    state.request.nodes.forEach((node) => {
      node.groupId = undefined;
    });
    return;
  }
  const membership = new Map<string, string[]>();
  state.request.nodes.forEach((node) => {
    if (!node.groupId) {
      return;
    }
    const bucket = membership.get(node.groupId) ?? [];
    bucket.push(node.id);
    membership.set(node.groupId, bucket);
  });
  if (collapseAllSingletons && [...membership.values()].every((nodeIds) => nodeIds.length <= 1)) {
    state.request.groups = undefined;
    state.request.nodes.forEach((node) => {
      node.groupId = undefined;
    });
    return;
  }
  const positionByNodeId = new Map((derived.editableLayout?.nodes ?? []).map((node) => [node.id, node.x]));
  state.request.groups = (state.request.groups ?? [])
    .filter((group) => membership.has(group.id))
    .sort((left, right) => {
      const leftX = Math.min(...(membership.get(left.id) ?? []).map((nodeId) => positionByNodeId.get(nodeId) ?? 0));
      const rightX = Math.min(...(membership.get(right.id) ?? []).map((nodeId) => positionByNodeId.get(nodeId) ?? 0));
      return leftX - rightX;
    })
    .map((group, order) => ({ ...group, order }));
}

function cleanupGroupsAfterNodeChanges() {
  if (!state.request.groups?.length) {
    return;
  }
  state.request.groups = state.request.groups.filter((group) => state.request.nodes.some((node) => node.groupId === group.id));
  if (state.request.groups.length === 0) {
    state.request.groups = undefined;
    return;
  }
  normalizeGroupState(true);
}

function setNodeGroup(nodeId: string, nextGroupId: string | null) {
  const node = state.request.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    state.status = `Node ${nodeId} no longer exists.`;
    render();
    return;
  }
  if (nextGroupId && !state.request.groups?.some((group) => group.id === nextGroupId)) {
    state.status = `Group ${nextGroupId} no longer exists.`;
    render();
    return;
  }
  node.groupId = nextGroupId ?? undefined;
  cleanupGroupsAfterNodeChanges();
  state.status = nextGroupId ? `Moved ${nodeId} to ${nextGroupId}.` : `Removed ${nodeId} from its group.`;
  updateDerivedAndRender();
}

function countVisibleGroups() {
  if (!state.request.groups?.length) {
    return 0;
  }
  const memberCounts = new Map<string, number>();
  state.request.nodes.forEach((node) => {
    if (!node.groupId) {
      return;
    }
    memberCounts.set(node.groupId, (memberCounts.get(node.groupId) ?? 0) + 1);
  });
  return (state.request.groups ?? []).filter((group) => (memberCounts.get(group.id) ?? 0) > 1).length;
}

function formatVisibleGroupSuffix(nodeId: string) {
  const node = state.request.nodes.find((candidate) => candidate.id === nodeId);
  if (!node?.groupId) {
    return "";
  }
  const memberCount = state.request.nodes.filter((candidate) => candidate.groupId === node.groupId).length;
  return memberCount > 1 ? ` / ${escapeHtml(node.groupId)}` : "";
}

function updateMarqueeSelection(marqueeState: Extract<DragState, { type: "marquee" }>, layoutResult: LayoutResult) {
  const marqueeRect = normalizeRect(marqueeState.startScreen, marqueeState.currentScreen);
  const selectedNodeIds = layoutResult.nodes
    .filter((node) => rectsIntersect(marqueeRect, worldRectToScreenRect(node)))
    .map((node) => node.id);
  state.selectedNodeIds = selectedNodeIds;
  if (selectedNodeIds.length === 1) {
    state.selection = { type: "node", id: selectedNodeIds[0] };
  } else {
    state.selection = null;
  }
}

function finalizeMarqueeSelection() {
  if (state.selectedNodeIds.length > 1) {
    state.status = `${state.selectedNodeIds.length} nodes selected.`;
  } else if (state.selectedNodeIds.length === 1) {
    state.status = `Node ${state.selectedNodeIds[0]} selected.`;
  }
}

function updateMarquee() {
  if (!dragState || dragState.type !== "marquee") {
    marquee.hidden = true;
    return;
  }
  const rect = normalizeRect(dragState.startScreen, dragState.currentScreen);
  marquee.hidden = false;
  marquee.style.left = `${rect.left}px`;
  marquee.style.top = `${rect.top}px`;
  marquee.style.width = `${rect.width}px`;
  marquee.style.height = `${rect.height}px`;
}

function fitCameraToContent() {
  if (!derived.editableLayout || derived.editableLayout.nodes.length === 0) {
    return;
  }
  const rect = sceneRoot.getBoundingClientRect();
  const padding = 120;
  const bounds = getLayoutBounds(derived.editableLayout);
  const width = Math.max(1, bounds.right - bounds.left + padding * 2);
  const height = Math.max(1, bounds.bottom - bounds.top + padding * 2);
  const zoom = Math.min(rect.width / width, rect.height / height);
  state.camera.zoom = clamp(zoom, 0.25, 2);
  state.camera.x = bounds.left - padding;
  state.camera.y = bounds.top - padding;
  state.status = "Camera fit to graph.";
  render();
}

async function exportTest() {
  if (!derived.editableLayout) {
    state.status = "No layout to export.";
    render();
    return;
  }
  const content = buildVitestExport(state.request, derived.editableLayout);
  try {
    await navigator.clipboard.writeText(content);
    state.status = "Acceptance test copied to the clipboard.";
  } catch {
    state.status = "Clipboard write failed. The generated test is in the console.";
    console.log(content);
  }
  render();
}

async function importTestFromClipboard() {
  let content = "";
  try {
    content = await navigator.clipboard.readText();
  } catch {
    state.status = "Clipboard read failed.";
    render();
    return;
  }

  try {
    const nextRequest = parseVitestRequestFromClipboard(content);
    applyImportedRequest(nextRequest, "Imported request from clipboard.");
  } catch (error) {
    state.status = error instanceof Error ? error.message : "Clipboard import failed.";
    render();
  }
}

async function openTestBrowser() {
  state.showTestBrowser = true;
  state.showShortcuts = false;
  render();

  if (state.testCases.length > 0 || state.testBrowserLoading) {
    return;
  }

  state.testBrowserLoading = true;
  state.testBrowserError = null;
  render();

  try {
    const response = await fetch("/__test-import/cases");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(readApiError(payload, "Failed to load test cases."));
    }
    if (!Array.isArray(payload)) {
      throw new Error("Test list response is invalid.");
    }
    const importedCases = payload.filter(isImportedTestCaseSummary);
    state.testCases = [...importedCases].sort((left, right) =>
      `${left.describe} ${left.title}`.localeCompare(`${right.describe} ${right.title}`),
    );
    if (state.testCases.length === 0) {
      state.testBrowserError = "No importable tests found.";
    }
  } catch (error) {
    state.testBrowserError =
      error instanceof Error ? error.message : "Failed to load test cases. Start the app with the local Vite dev server.";
  } finally {
    state.testBrowserLoading = false;
    render();
  }
}

function closeTestBrowser() {
  state.showTestBrowser = false;
  state.testBrowserError = null;
  state.importingTestCaseId = null;
  render();
}

async function importTestCase(caseId: string) {
  state.importingTestCaseId = caseId;
  state.testBrowserError = null;
  render();

  try {
    const response = await fetch(`/__test-import/cases/${encodeURIComponent(caseId)}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(readApiError(payload, "Failed to load test case."));
    }
    if (!isImportedTestCasePayload(payload)) {
      throw new Error("Test case response is invalid.");
    }
    applyImportedRequest(
      payload.request,
      `Imported ${payload.title}.`,
      {
        id: payload.id,
        file: payload.file,
        describe: payload.describe,
        title: payload.title,
        status: payload.status,
      },
      payload.assertedGeometry,
    );
  } catch (error) {
    state.testBrowserError = error instanceof Error ? error.message : "Failed to import test case.";
    render();
  } finally {
    state.importingTestCaseId = null;
  }
}

async function saveImportedTest() {
  if (!state.activeImportedTestCase) {
    state.status = "Import a test case before saving.";
    render();
    return;
  }
  if (!derived.editableLayout) {
    state.status = "No layout to save.";
    render();
    return;
  }

  state.savingImportedTest = true;
  render();

  try {
    const content = buildVitestExport(state.request, derived.editableLayout, state.activeImportedTestCase.title);
    const response = await fetch(`/__test-import/cases/${encodeURIComponent(state.activeImportedTestCase.id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(readApiError(payload, "Failed to save test case."));
    }
    applyTestStatusUpdates([{ id: state.activeImportedTestCase.id, status: "unknown" }]);
    state.status = `Saved ${state.activeImportedTestCase.title} to ${state.activeImportedTestCase.file}.`;
    render();
  } catch (error) {
    state.status = error instanceof Error ? error.message : "Failed to save test case.";
    render();
  } finally {
    state.savingImportedTest = false;
    render();
  }
}

function renderTestBrowser() {
  if (!state.showTestBrowser) {
    testBrowser.innerHTML = "";
    return;
  }

  const normalizedQuery = state.testCaseQuery.trim().toLowerCase();
  const visibleCases = state.testCases.filter((testCase) => {
    if (!normalizedQuery) {
      return true;
    }
    return `${testCase.file} ${testCase.describe} ${testCase.title}`.toLowerCase().includes(normalizedQuery);
  });
  const body = state.testBrowserLoading
    ? `<p class="helper-text">Loading importable tests…</p>`
    : visibleCases.length > 0
      ? visibleCases
          .map((testCase) => {
            const importing = state.importingTestCaseId === testCase.id;
            return `
              <article class="test-case-card ${escapeHtml(testCase.status)}">
                <div class="test-case-head">
                  <div class="test-case-copy">
                    <p class="test-case-suite">${escapeHtml(testCase.describe)}</p>
                    <h3>${escapeHtml(testCase.title)}</h3>
                  </div>
                  <button class="mini-button" data-action="import-test-case" data-id="${escapeHtml(testCase.id)}" type="button" ${importing ? "disabled" : ""}>
                    ${importing ? "Importing…" : "Import"}
                  </button>
                </div>
                <p class="test-case-file">${escapeHtml(testCase.file)}</p>
              </article>
            `;
          })
          .join("")
      : `<p class="empty-state">No tests match the current filter.</p>`;

  testBrowser.innerHTML = `
    <div class="test-browser-backdrop" data-action="close-test-browser"></div>
    <div class="test-browser-card" role="dialog" aria-modal="true" aria-labelledby="test-browser-title">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Local Tests</p>
          <h2 id="test-browser-title">Import from current test cases</h2>
        </div>
        <button id="test-browser-close" class="mini-button" type="button">Close</button>
      </div>
      <div class="form-row">
        <label for="test-browser-search">Filter</label>
        <input id="test-browser-search" value="${escapeHtml(state.testCaseQuery)}" placeholder="Search by file, suite, or test title" />
      </div>
      ${state.testBrowserError ? `<p class="error-line">${escapeHtml(state.testBrowserError)}</p>` : ""}
      <div class="test-case-list">${body}</div>
      <div class="test-browser-footer">
        <button id="clipboard-import-button" type="button">Import from clipboard</button>
      </div>
    </div>
  `;

  testBrowser.querySelector<HTMLButtonElement>("#test-browser-close")?.addEventListener("click", closeTestBrowser);
  testBrowser.querySelector<HTMLDivElement>(".test-browser-backdrop")?.addEventListener("click", closeTestBrowser);
  testBrowser.querySelector<HTMLInputElement>("#test-browser-search")?.addEventListener("input", (event) => {
    state.testCaseQuery = (event.currentTarget as HTMLInputElement).value;
    render();
  });
  testBrowser.querySelector<HTMLButtonElement>("#clipboard-import-button")?.addEventListener("click", () => void importTestFromClipboard());
  testBrowser.querySelectorAll<HTMLButtonElement>("[data-action='import-test-case']").forEach((button) => {
    button.addEventListener("click", () => {
      const caseId = button.dataset.id;
      if (caseId) {
        void importTestCase(caseId);
      }
    });
  });
}

function applyImportedRequest(
  nextRequest: LayoutRequest,
  status: string,
  importedTestCase: ImportedTestCaseSummary | null = null,
  assertedGeometry: ImportedAssertedGeometry | null = null,
) {
  state.request = nextRequest;
  const importedOverrides =
    importedTestCase?.status === "fail" ? buildImportedOverrides(nextRequest, assertedGeometry) : null;
  state.nodeOverrides = importedOverrides?.nodeOverrides ?? {};
  state.edgeOverrides = importedOverrides?.edgeOverrides ?? {};
  state.selection = null;
  state.selectedNodeIds = [];
  state.activeImportedTestCase = importedTestCase;
  state.showTestBrowser = false;
  state.testBrowserError = null;
  state.edgeCreate = null;
  selectedLaneId = nextRequest.lanes[0]?.id ?? "lane-0";
  state.status = status;
  updateDerivedAndRender();
  fitCameraToContent();
}

function buildImportedOverrides(request: LayoutRequest, assertedGeometry: ImportedAssertedGeometry | null) {
  if (!assertedGeometry) {
    return null;
  }

  const autoResponse = layout(request);
  if (!autoResponse.ok) {
    return null;
  }

  const autoLayout = autoResponse.result;
  const assertedNodeById = new Map(assertedGeometry.nodes.map((node) => [node.id, node]));

  const nodeOverrides = Object.fromEntries(
    assertedGeometry.nodes.flatMap((node) => {
      const autoNode = autoLayout.nodes.find((candidate) => candidate.id === node.id);
      if (!autoNode) {
        return [];
      }
      const override: Partial<Pick<NodeLayout, "x" | "y">> = {};
      if (!nearlyEqual(node.x, autoNode.x)) {
        override.x = node.x;
      }
      if (!nearlyEqual(node.y, autoNode.y)) {
        override.y = node.y;
      }
      return Object.keys(override).length > 0 ? [[node.id, override]] : [];
    }),
  );

  const nodeDeltaById = new Map(
    autoLayout.nodes.map((autoNode) => {
      const assertedNode = assertedNodeById.get(autoNode.id);
      return [
        autoNode.id,
        {
          x: (assertedNode?.x ?? autoNode.x) - autoNode.x,
          y: (assertedNode?.y ?? autoNode.y) - autoNode.y,
        },
      ] satisfies [string, Point];
    }),
  );

  const edgeOverrides = Object.fromEntries(
    assertedGeometry.edges.flatMap((edge) => {
      const autoEdge = autoLayout.edges.find((candidate) => candidate.id === edge.id);
      if (!autoEdge) {
        return [];
      }

      const sourceDelta = nodeDeltaById.get(autoEdge.sourceId) ?? { x: 0, y: 0 };
      const targetDelta = nodeDeltaById.get(autoEdge.targetId) ?? { x: 0, y: 0 };
      const override: EdgeOverride = {};
      const sourceAnchor = translatePoint(edge.sourceAnchor, { x: -sourceDelta.x, y: -sourceDelta.y });
      const targetAnchor = translatePoint(edge.targetAnchor, { x: -targetDelta.x, y: -targetDelta.y });
      const points = edge.points.map((point, index, allPoints) => {
        if (index <= 1) {
          return translatePoint(point, { x: -sourceDelta.x, y: -sourceDelta.y });
        }
        if (index >= allPoints.length - 2) {
          return translatePoint(point, { x: -targetDelta.x, y: -targetDelta.y });
        }
        return { ...point };
      });

      if (!anchorMatches(sourceAnchor, autoEdge.sourceAnchor)) {
        override.sourceAnchor = sourceAnchor;
      }
      if (!anchorMatches(targetAnchor, autoEdge.targetAnchor)) {
        override.targetAnchor = targetAnchor;
      }
      if (!pointsMatch(points, autoEdge.points)) {
        override.points = points;
      }

      return Object.keys(override).length > 0 ? [[edge.id, override]] : [];
    }),
  );

  return { nodeOverrides, edgeOverrides };
}

function connectTestStatusStream() {
  if (typeof EventSource === "undefined") {
    return;
  }

  testStatusEventSource?.close();
  const eventSource = new EventSource("/__test-import/status-stream");
  eventSource.addEventListener("test-statuses", (event) => {
    if (!(event instanceof MessageEvent)) {
      return;
    }
    try {
      const payload = JSON.parse(event.data) as unknown;
      if (!isStatusUpdatePayload(payload)) {
        return;
      }
      applyTestStatusUpdates(payload.statuses);
    } catch {
      // Ignore malformed events and keep the stream alive.
    }
  });
  eventSource.onerror = () => {
    if (testStatusEventSource === eventSource && eventSource.readyState === EventSource.CLOSED) {
      window.setTimeout(connectTestStatusStream, 1000);
    }
  };
  testStatusEventSource = eventSource;
}

function applyTestStatusUpdates(updates: Array<{ id: string; status: ImportedTestCaseSummary["status"] }>) {
  if (updates.length === 0) {
    return;
  }

  const statusById = new Map(updates.map((entry) => [entry.id, entry.status]));
  let changed = false;
  state.testCases = state.testCases.map((testCase) => {
    const nextStatus = statusById.get(testCase.id);
    if (!nextStatus || nextStatus === testCase.status) {
      return testCase;
    }
    changed = true;
    return { ...testCase, status: nextStatus };
  });

  if (state.activeImportedTestCase) {
    const nextStatus = statusById.get(state.activeImportedTestCase.id);
    if (nextStatus && nextStatus !== state.activeImportedTestCase.status) {
      state.activeImportedTestCase = { ...state.activeImportedTestCase, status: nextStatus };
      changed = true;
    }
  }

  if (changed) {
    render();
  }
}

function readApiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || !("error" in payload)) {
    return fallback;
  }
  return typeof payload.error === "string" ? payload.error : fallback;
}

function isImportedTestCaseSummary(value: unknown): value is ImportedTestCaseSummary {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "file" in value &&
      "describe" in value &&
      "title" in value &&
      "status" in value &&
      typeof value.id === "string" &&
      typeof value.file === "string" &&
      typeof value.describe === "string" &&
      typeof value.title === "string" &&
      typeof value.status === "string",
  );
}

function isStatusUpdatePayload(
  value: unknown,
): value is { statuses: Array<{ id: string; status: ImportedTestCaseSummary["status"] }> } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "statuses" in value &&
      Array.isArray(value.statuses) &&
      value.statuses.every(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          "id" in entry &&
          "status" in entry &&
          typeof entry.id === "string" &&
          typeof entry.status === "string",
      ),
  );
}

function isImportedTestCasePayload(
  value: unknown,
): value is ImportedTestCaseSummary & { request: LayoutRequest; assertedGeometry: ImportedAssertedGeometry | null } {
  return (
    isImportedTestCaseSummary(value) &&
    "request" in value &&
    (!("assertedGeometry" in value) || value.assertedGeometry === null || isImportedAssertedGeometry(value.assertedGeometry))
  );
}

function isImportedAssertedGeometry(value: unknown): value is ImportedAssertedGeometry {
  return Boolean(
    value &&
      typeof value === "object" &&
      "nodes" in value &&
      "edges" in value &&
      Array.isArray(value.nodes) &&
      Array.isArray(value.edges) &&
      value.nodes.every(isNodeGeometryAssertion) &&
      value.edges.every(isEdgeGeometryAssertion),
  );
}

function isNodeGeometryAssertion(value: unknown): value is NodeGeometryAssertion {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "x" in value &&
      "y" in value &&
      typeof value.id === "string" &&
      typeof value.x === "number" &&
      typeof value.y === "number",
  );
}

function isEdgeGeometryAssertion(value: unknown): value is EdgeGeometryAssertion {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "sourceAnchor" in value &&
      "targetAnchor" in value &&
      "points" in value &&
      typeof value.id === "string" &&
      isAnchorPoint(value.sourceAnchor) &&
      isAnchorPoint(value.targetAnchor) &&
      Array.isArray(value.points) &&
      value.points.every(isPoint),
  );
}

function isAnchorPoint(value: unknown): value is AnchorPoint {
  return Boolean(
    isPoint(value) &&
      "side" in value &&
      "ordinal" in value &&
      (value.side === "top" || value.side === "right" || value.side === "bottom" || value.side === "left") &&
      typeof value.ordinal === "number",
  );
}

function isPoint(value: unknown): value is Point {
  return Boolean(
    value &&
      typeof value === "object" &&
      "x" in value &&
      "y" in value &&
      typeof value.x === "number" &&
      typeof value.y === "number",
  );
}

function persistPlaygroundState() {
  const snapshot: PersistedPlaygroundState = {
    version: 1,
    request: state.request,
    nodeOverrides: state.nodeOverrides,
    edgeOverrides: state.edgeOverrides,
    camera: state.camera,
    selectedLaneId,
    showOverlay: state.showOverlay,
    showCoordinates: state.showCoordinates,
    showTestBrowser: state.showTestBrowser,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    state.status = "Failed to save the playground state locally.";
  }
}

function loadPersistedState(): PersistedPlaygroundState | null {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return null;
    }
    const parsed = JSON.parse(rawValue) as Partial<PersistedPlaygroundState>;
    if (parsed.version !== 1 || !parsed.request) {
      return null;
    }
    return {
      version: 1,
      request: parsed.request,
      nodeOverrides: parsed.nodeOverrides ?? {},
      edgeOverrides: parsed.edgeOverrides ?? {},
      camera: parsed.camera ?? { x: -120, y: -80, zoom: 1 },
      selectedLaneId: parsed.selectedLaneId ?? null,
      showOverlay: parsed.showOverlay ?? false,
      showCoordinates: parsed.showCoordinates ?? true,
      showTestBrowser: parsed.showTestBrowser ?? false,
    };
  } catch {
    return null;
  }
}

function buildVitestExport(request: LayoutRequest, result: LayoutResult, caseTitle = `lays out ${request.nodes.length} nodes across ${request.lanes.map((lane) => lane.id).join(", ")}`) {
  return `it(${JSON.stringify(caseTitle)}, () => {\n    const request: LayoutRequest = ${indentBlock(formatRequestValue(request), 4).trimStart()};\n\n    const result = layout(request);\n\n    expect(result.ok).toBe(true);\n    if (!result.ok) {\n      return;\n    }\n\n    expect(result.result.lanes).toEqual(${formatInlineObjectArray(result.lanes, 4)});\n    expect(result.result.nodes).toEqual(${formatInlineObjectArray(result.nodes, 4)});\n    expect(result.result.edges).toEqual(${formatExpandedEdgeArray(result.edges, 4)});\n  })`;
}

function parseVitestRequestFromClipboard(content: string): LayoutRequest {
  const marker = "const request: LayoutRequest =";
  const markerIndex = content.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("Clipboard does not contain a Vitest request declaration.");
  }

  const objectStart = content.indexOf("{", markerIndex + marker.length);
  if (objectStart === -1) {
    throw new Error("Clipboard request is missing an object literal.");
  }

  const objectEnd = findMatchingBraceIndex(content, objectStart);
  if (objectEnd === -1) {
    throw new Error("Clipboard request object is incomplete.");
  }

  let parsed: unknown;
  try {
    parsed = Function(`"use strict"; return (${content.slice(objectStart, objectEnd + 1)});`)();
  } catch {
    throw new Error("Clipboard request could not be parsed.");
  }

  return validateLayoutRequest(parsed);
}

function findMatchingBraceIndex(value: string, startIndex: number) {
  let depth = 0;
  let inString = false;
  let stringQuote = "";
  let escaped = false;

  for (let index = startIndex; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === stringQuote) {
        inString = false;
        stringQuote = "";
      }
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      inString = true;
      stringQuote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function validateLayoutRequest(value: unknown): LayoutRequest {
  if (!value || typeof value !== "object") {
    throw new Error("Clipboard request must be an object.");
  }

  const candidate = value as Partial<LayoutRequest>;
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges) || !Array.isArray(candidate.lanes)) {
    throw new Error("Clipboard request is missing nodes, edges, or lanes.");
  }
  if (!candidate.defaults || typeof candidate.defaults !== "object") {
    throw new Error("Clipboard request is missing defaults.");
  }

  if (!Number.isFinite(candidate.defaults.nodeWidth) || !Number.isFinite(candidate.defaults.nodeHeight)) {
    throw new Error("Clipboard request defaults are invalid.");
  }

  return structuredClone(candidate as LayoutRequest);
}

function pruneRedundantOverrides(playgroundState: PlaygroundState, autoLayout: LayoutResult) {
  const nodeLayoutById = new Map(autoLayout.nodes.map((node) => [node.id, node]));
  playgroundState.nodeOverrides = Object.fromEntries(
    Object.entries(playgroundState.nodeOverrides).flatMap(([nodeId, override]) => {
      const node = nodeLayoutById.get(nodeId);
      if (!node) {
        return [];
      }
      const nextOverride: Partial<Pick<NodeLayout, "x" | "y">> = {};
      if (override.x !== undefined && !nearlyEqual(override.x, node.x)) {
        nextOverride.x = override.x;
      }
      if (override.y !== undefined && !nearlyEqual(override.y, node.y)) {
        nextOverride.y = override.y;
      }
      return Object.keys(nextOverride).length > 0 ? [[nodeId, nextOverride]] : [];
    }),
  );

  const edgeLayoutById = new Map(autoLayout.edges.map((edge) => [edge.id, edge]));
  playgroundState.edgeOverrides = Object.fromEntries(
    Object.entries(playgroundState.edgeOverrides).flatMap(([edgeId, override]) => {
      const edge = edgeLayoutById.get(edgeId);
      if (!edge) {
        return [];
      }
      const nextOverride: EdgeOverride = {};
      if (override.sourceAnchor && !anchorMatches(override.sourceAnchor, edge.sourceAnchor)) {
        nextOverride.sourceAnchor = { ...override.sourceAnchor };
      }
      if (override.targetAnchor && !anchorMatches(override.targetAnchor, edge.targetAnchor)) {
        nextOverride.targetAnchor = { ...override.targetAnchor };
      }
      if (override.points && !pointsMatch(override.points, edge.points)) {
        nextOverride.points = override.points.map((point) => ({ ...point }));
      }
      return Object.keys(nextOverride).length > 0 ? [[edgeId, nextOverride]] : [];
    }),
  );
}

function applyOverrides(request: LayoutRequest, autoLayout: LayoutResult, playgroundState: PlaygroundState): LayoutResult {
  const nodes = autoLayout.nodes.map((node) => {
    const override = playgroundState.nodeOverrides[node.id];
    return override ? { ...node, x: override.x ?? node.x, y: override.y ?? node.y } : { ...node };
  });

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const autoNodeMap = new Map(autoLayout.nodes.map((node) => [node.id, node]));
  const autoEdgeMap = new Map(autoLayout.edges.map((edge) => [edge.id, edge]));
  const laneOrder = new Map(request.lanes.map((lane) => [lane.id, lane.order]));
  const requestNodeMap = new Map(request.nodes.map((node) => [node.id, node]));

  const edges = request.edges.map((edgeInput) => {
    const sourceNode = nodeMap.get(edgeInput.sourceId);
    const targetNode = nodeMap.get(edgeInput.targetId);
    if (!sourceNode || !targetNode) {
      throw new Error(`Edge ${edgeInput.id} references a missing node after overrides.`);
    }
    const sourceLaneId = requestNodeMap.get(edgeInput.sourceId)?.laneId;
    const targetLaneId = requestNodeMap.get(edgeInput.targetId)?.laneId;
    const orientation = deriveOrientation(laneOrder.get(sourceLaneId ?? "") ?? 0, laneOrder.get(targetLaneId ?? "") ?? 0);
    const autoEdge = autoEdgeMap.get(edgeInput.id);
    const override = playgroundState.edgeOverrides[edgeInput.id];
    const sourceDelta = getNodeDelta(edgeInput.sourceId, autoNodeMap, nodeMap);
    const targetDelta = getNodeDelta(edgeInput.targetId, autoNodeMap, nodeMap);

    if (
      !override &&
      autoEdge &&
      nearlyEqual(sourceDelta.x, 0) &&
      nearlyEqual(sourceDelta.y, 0) &&
      nearlyEqual(targetDelta.x, 0) &&
      nearlyEqual(targetDelta.y, 0)
    ) {
      return {
        id: autoEdge.id,
        sourceId: autoEdge.sourceId,
        targetId: autoEdge.targetId,
        sourceAnchor: { ...autoEdge.sourceAnchor },
        targetAnchor: { ...autoEdge.targetAnchor },
        points: autoEdge.points.map((point) => ({ ...point })),
      } satisfies EdgeLayout;
    }

    const sourceAnchor = override?.sourceAnchor
      ? projectAnchorToNodeBorder(translatePoint(override.sourceAnchor, sourceDelta), sourceNode)
      : autoEdge
        ? translatePoint(autoEdge.sourceAnchor, sourceDelta)
        : defaultSourceAnchor(sourceNode, orientation);

    const targetAnchor = override?.targetAnchor
      ? projectAnchorToNodeBorder(translatePoint(override.targetAnchor, targetDelta), targetNode)
      : autoEdge
        ? translatePoint(autoEdge.targetAnchor, targetDelta)
        : defaultTargetAnchor(targetNode, orientation);

    const points = override?.points
      ? translateEdgePointsWithNodeMotion(override.points, sourceDelta, targetDelta)
      : autoEdge
        ? translateEdgePointsWithNodeMotion(autoEdge.points, sourceDelta, targetDelta)
        : routeOrthogonalEdge(sourceAnchor, targetAnchor);

    if (override) {
      normalizeTerminalEdgeGeometry(points, sourceAnchor, targetAnchor);
    }

    return { id: edgeInput.id, sourceId: edgeInput.sourceId, targetId: edgeInput.targetId, sourceAnchor, targetAnchor, points } satisfies EdgeLayout;
  });

  return {
    lanes: autoLayout.lanes.map((lane) => ({ ...lane })),
    groups: autoLayout.groups?.map((group) => ({ ...group })),
    nodes,
    edges,
  };
}

function projectAnchorToNodeBorder(anchor: AnchorPoint, node: NodeLayout): AnchorPoint {
  if (anchor.side === "top") {
    return { ...anchor, x: clamp(anchor.x, node.x, node.x + node.width), y: node.y };
  }
  if (anchor.side === "right") {
    return { ...anchor, x: node.x + node.width, y: clamp(anchor.y, node.y, node.y + node.height) };
  }
  if (anchor.side === "bottom") {
    return { ...anchor, x: clamp(anchor.x, node.x, node.x + node.width), y: node.y + node.height };
  }
  return { ...anchor, x: node.x, y: clamp(anchor.y, node.y, node.y + node.height) };
}

function getNodeDelta(nodeId: string, previousNodes: Map<string, NodeLayout>, nextNodes: Map<string, NodeLayout>) {
  const previousNode = previousNodes.get(nodeId);
  const nextNode = nextNodes.get(nodeId);
  if (!previousNode || !nextNode) {
    return { x: 0, y: 0 };
  }
  return { x: nextNode.x - previousNode.x, y: nextNode.y - previousNode.y };
}

function translatePoint<T extends Point>(point: T, delta: Point): T {
  return { ...point, x: point.x + delta.x, y: point.y + delta.y };
}

function translateEdgePointsWithNodeMotion(points: Point[], sourceDelta: Point, targetDelta: Point) {
  const original = points.map((point) => ({ ...point }));
  const next = points.map((point) => ({ ...point }));
  if (next[0]) {
    next[0] = translatePoint(next[0], sourceDelta);
  }
  if (next[1]) {
    next[1] = translatePoint(next[1], sourceDelta);
  }
  if (next.length > 2 && next[next.length - 2]) {
    next[next.length - 2] = translatePoint(next[next.length - 2], targetDelta);
  }
  if (next.length > 1 && next[next.length - 1]) {
    next[next.length - 1] = translatePoint(next[next.length - 1], targetDelta);
  }
  alignAdjacentBend(next, original, 1, 2);
  alignAdjacentBend(next, original, next.length - 2, next.length - 3);
  return next;
}

function alignAdjacentBend(points: Point[], originalPoints: Point[], movedIndex: number, bendIndex: number) {
  const moved = points[movedIndex];
  const bend = points[bendIndex];
  const originalMoved = originalPoints[movedIndex];
  const originalBend = originalPoints[bendIndex];
  if (!moved || !bend || !originalMoved || !originalBend) {
    return;
  }
  if (nearlyEqual(originalMoved.y, originalBend.y)) {
    bend.y = moved.y;
    return;
  }
  bend.x = moved.x;
}

function deriveOrientation(sourceLaneOrder: number, targetLaneOrder: number) {
  if (targetLaneOrder === sourceLaneOrder) {
    return "side" as const;
  }
  return targetLaneOrder < sourceLaneOrder ? ("up" as const) : ("down" as const);
}

function defaultSourceAnchor(node: NodeLayout, orientation: ReturnType<typeof deriveOrientation>) {
  if (orientation === "up") {
    return createAnchor(node, "top", 0);
  }
  if (orientation === "down") {
    return createAnchor(node, "bottom", 0);
  }
  return createAnchor(node, "right", 0);
}

function defaultTargetAnchor(node: NodeLayout, orientation: ReturnType<typeof deriveOrientation>) {
  if (orientation === "down") {
    return createAnchor(node, "top", 0);
  }
  return createAnchor(node, "left", 0);
}

function createAnchor(node: NodeLayout, side: AnchorSide, ordinal: number): AnchorPoint {
  if (side === "top") {
    return { x: node.x + node.width / 2, y: node.y, side, ordinal };
  }
  if (side === "right") {
    return { x: node.x + node.width, y: node.y + node.height / 2, side, ordinal };
  }
  if (side === "bottom") {
    return { x: node.x + node.width / 2, y: node.y + node.height, side, ordinal };
  }
  return { x: node.x, y: node.y + node.height / 2, side, ordinal };
}

function routeOrthogonalEdge(sourceAnchor: AnchorPoint, targetAnchor: AnchorPoint) {
  const sourceStub = offsetFromAnchor(sourceAnchor, EDGE_STUB);
  const targetApproach = getTargetApproachPoint(sourceStub, targetAnchor);
  return [
    { x: sourceAnchor.x, y: sourceAnchor.y },
    sourceStub,
    targetApproach,
    { x: targetAnchor.x, y: targetAnchor.y },
  ];
}

function moveOrthogonalSegment(points: Point[], segmentIndex: number, delta: Point) {
  const next = points.map((point) => ({ ...point }));
  const start = next[segmentIndex];
  const end = next[segmentIndex + 1];
  if (!start || !end) {
    return next;
  }
  const horizontal = nearlyEqual(start.y, end.y);
  if (horizontal) {
    const nextY = snap(start.y + delta.y);
    start.y = nextY;
    end.y = nextY;
  } else {
    const nextX = snap(start.x + delta.x);
    start.x = nextX;
    end.x = nextX;
  }
  return next;
}

function normalizeTerminalEdgeGeometry(points: Point[], sourceAnchor: AnchorPoint, targetAnchor: AnchorPoint) {
  if (points.length === 0) {
    return;
  }

  points[0] = { x: sourceAnchor.x, y: sourceAnchor.y };
  points[points.length - 1] = { x: targetAnchor.x, y: targetAnchor.y };

  if (points[1]) {
    if (sourceAnchor.side === "left" || sourceAnchor.side === "right") {
      points[1].y = sourceAnchor.y;
      if (nearlyEqual(points[1].x, sourceAnchor.x)) {
        points[1].x = offsetFromAnchor(sourceAnchor, EDGE_STUB).x;
      }
    } else {
      points[1].x = sourceAnchor.x;
      if (nearlyEqual(points[1].y, sourceAnchor.y)) {
        points[1].y = offsetFromAnchor(sourceAnchor, EDGE_STUB).y;
      }
    }
  }

  if (points.length >= 2 && points[points.length - 2]) {
    const approachPoint = points[points.length - 2];
    if (targetAnchor.side === "left" || targetAnchor.side === "right") {
      approachPoint.y = targetAnchor.y;
      if (nearlyEqual(approachPoint.x, targetAnchor.x)) {
        approachPoint.x = offsetFromAnchor(targetAnchor, EDGE_STUB).x;
      }
    } else {
      approachPoint.x = targetAnchor.x;
      if (nearlyEqual(approachPoint.y, targetAnchor.y)) {
        approachPoint.y = offsetFromAnchor(targetAnchor, EDGE_STUB).y;
      }
    }

    points[points.length - 2] = approachPoint;
  }
}

function getTargetApproachPoint(referencePoint: Point, targetAnchor: AnchorPoint): Point {
  if (targetAnchor.side === "left" || targetAnchor.side === "right") {
    return { x: referencePoint.x, y: targetAnchor.y };
  }
  return { x: targetAnchor.x, y: referencePoint.y };
}

function offsetFromAnchor(anchor: AnchorPoint, distance: number) {
  const vector = anchorSideVector(anchor.side);
  return { x: anchor.x + vector.x * distance, y: anchor.y + vector.y * distance };
}

function anchorSideVector(side: AnchorSide) {
  if (side === "top") {
    return { x: 0, y: -1 };
  }
  if (side === "right") {
    return { x: 1, y: 0 };
  }
  if (side === "bottom") {
    return { x: 0, y: 1 };
  }
  return { x: -1, y: 0 };
}

function pointInsideNode(point: Point, node: NodeLayout) {
  return point.x >= node.x && point.x <= node.x + node.width && point.y >= node.y && point.y <= node.y + node.height;
}

function zoomAtScreenPoint(screenPoint: Point, multiplier: number) {
  const before = screenToWorld(screenPoint);
  state.camera.zoom = clamp(state.camera.zoom * multiplier, 0.2, 3);
  const after = screenToWorld(screenPoint);
  state.camera.x += before.x - after.x;
  state.camera.y += before.y - after.y;
  render();
}

function getVisibleWorldBounds() {
  const rect = sceneRoot.getBoundingClientRect();
  const topLeft = screenToWorld({ x: 0, y: 0 });
  const bottomRight = screenToWorld({ x: rect.width, y: rect.height });
  return { left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y };
}

function getLayoutBounds(layoutResult: LayoutResult) {
  const nodeBounds = layoutResult.nodes.flatMap((node) => [
    { x: node.x, y: node.y },
    { x: node.x + node.width, y: node.y + node.height },
  ]);
  const edgePoints = layoutResult.edges.flatMap((edge) => edge.points);
  const allPoints = [...nodeBounds, ...edgePoints];
  const xs = allPoints.map((point) => point.x);
  const ys = allPoints.map((point) => point.y);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

function edgeGeometriesMatch(left: EdgeLayout, right: EdgeLayout) {
  if (!anchorMatches(left.sourceAnchor, right.sourceAnchor) || !anchorMatches(left.targetAnchor, right.targetAnchor)) {
    return false;
  }
  return pointsMatch(left.points, right.points);
}

function anchorMatches(left: AnchorPoint, right: AnchorPoint) {
  return left.side === right.side && left.ordinal === right.ordinal && nearlyEqual(left.x, right.x) && nearlyEqual(left.y, right.y);
}

function pointsMatch(left: Point[], right: Point[]) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((point, index) => nearlyEqual(point.x, right[index]?.x ?? 0) && nearlyEqual(point.y, right[index]?.y ?? 0));
}

function getScreenPoint(event: MouseEvent | PointerEvent | WheelEvent): Point {
  const rect = sceneRoot.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function worldToScreen(point: Point) {
  return { x: (point.x - state.camera.x) * state.camera.zoom, y: (point.y - state.camera.y) * state.camera.zoom };
}

function worldRectToScreenRect(node: NodeLayout) {
  const topLeft = worldToScreen({ x: node.x, y: node.y });
  return {
    left: topLeft.x,
    top: topLeft.y,
    width: node.width * state.camera.zoom,
    height: node.height * state.camera.zoom,
  };
}

function normalizeRect(start: Point, end: Point) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);
  return { left, top, width: right - left, height: bottom - top, right, bottom };
}

function rectsIntersect(
  left: { left: number; top: number; width: number; height: number; right?: number; bottom?: number },
  right: { left: number; top: number; width: number; height: number; right?: number; bottom?: number },
) {
  const leftRight = left.right ?? left.left + left.width;
  const leftBottom = left.bottom ?? left.top + left.height;
  const rightRight = right.right ?? right.left + right.width;
  const rightBottom = right.bottom ?? right.top + right.height;
  return left.left <= rightRight && leftRight >= right.left && left.top <= rightBottom && leftBottom >= right.top;
}

function viewportCenterScreen() {
  const rect = sceneRoot.getBoundingClientRect();
  return { x: rect.width / 2, y: rect.height / 2 };
}

function screenToWorld(point: Point) {
  return { x: point.x / state.camera.zoom + state.camera.x, y: point.y / state.camera.zoom + state.camera.y };
}

function getNearestLaneId(targetY: number) {
  if (derived.autoLayout?.lanes.length) {
    let nearestLane = derived.autoLayout.lanes[0];
    let bestDistance = distanceToLane(targetY, nearestLane);
    for (const lane of derived.autoLayout.lanes) {
      const nextDistance = distanceToLane(targetY, lane);
      if (nextDistance < bestDistance) {
        nearestLane = lane;
        bestDistance = nextDistance;
      }
    }
    return nearestLane.id;
  }
  const ordered = [...state.request.lanes].sort((left, right) => left.order - right.order);
  if (ordered.length === 0) {
    return null;
  }
  const laneMargin = state.request.spacing?.laneMargin ?? 24;
  const laneGap = state.request.spacing?.laneGap ?? 44;
  const laneHeight = state.request.defaults.nodeHeight + laneMargin * 2;
  const lanePitch = laneHeight + laneGap;
  const laneIndex = clamp(Math.round((targetY + laneMargin) / lanePitch), 0, ordered.length - 1);
  return ordered[laneIndex]?.id ?? null;
}

function getNearestGroupId(target: Point) {
  const groups = derived.editableLayout ? computePlaygroundGroupLayouts(derived.editableLayout) : [];
  if (groups.length === 0) {
    return null;
  }
  let nearestGroup = groups[0];
  let bestDistance = distanceToRect(target, nearestGroup);
  for (const group of groups) {
    const nextDistance = distanceToRect(target, group);
    if (nextDistance < bestDistance) {
      nearestGroup = group;
      bestDistance = nextDistance;
    }
  }
  return nearestGroup.id;
}

function distanceToLane(targetY: number, lane: LayoutResult["lanes"][number]) {
  if (targetY < lane.top) {
    return lane.top - targetY;
  }
  if (targetY > lane.bottom) {
    return targetY - lane.bottom;
  }
  return 0;
}

function distanceToRect(target: Point, rect: { x: number; y: number; width: number; height: number }) {
  const dx = target.x < rect.x ? rect.x - target.x : target.x > rect.x + rect.width ? target.x - (rect.x + rect.width) : 0;
  const dy = target.y < rect.y ? rect.y - target.y : target.y > rect.y + rect.height ? target.y - (rect.y + rect.height) : 0;
  return Math.hypot(dx, dy);
}

function describeSelection() {
  if (state.selectedNodeIds.length > 1) {
    return `${state.selectedNodeIds.length} nodes selected`;
  }
  if (!state.selection) {
    return "Nothing selected";
  }
  if (state.selection.type === "node") {
    return `Node ${state.selection.id}`;
  }
  if (state.selection.type === "group") {
    return `Group ${state.selection.id}`;
  }
  if (state.selection.type === "edge") {
    return `Edge ${state.selection.id}`;
  }
  return `Segment ${state.selection.segmentIndex} on ${state.selection.edgeId}`;
}

function renderNodeOptions(selectedId: string) {
  return state.request.nodes.map((node) => `<option value="${node.id}" ${node.id === selectedId ? "selected" : ""}>${node.id}</option>`).join("");
}

function renderGroupOptions(selectedId: string) {
  const noneOption = `<option value="" ${selectedId === "" ? "selected" : ""}>None</option>`;
  const groupOptions = (state.request.groups ?? [])
    .map((group) => {
      const memberCount = state.request.nodes.filter((node) => node.groupId === group.id).length;
      return `<option value="${group.id}" ${group.id === selectedId ? "selected" : ""}>${escapeHtml(group.id)} (${memberCount})</option>`;
    })
    .join("");
  return `${noneOption}${groupOptions}`;
}

function normalizeOptionalNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildRoundedOrthogonalPath(points: Point[], radius: number) {
  if (points.length === 0) {
    return "";
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    if (!previous || !current || !next) {
      continue;
    }

    const incomingLength = Math.hypot(current.x - previous.x, current.y - previous.y);
    const outgoingLength = Math.hypot(next.x - current.x, next.y - current.y);
    const cornerRadius = Math.min(radius, incomingLength / 2, outgoingLength / 2);

    if (
      cornerRadius <= 0 ||
      (nearlyEqual(previous.x, current.x) && nearlyEqual(current.x, next.x)) ||
      (nearlyEqual(previous.y, current.y) && nearlyEqual(current.y, next.y))
    ) {
      path += ` L ${current.x} ${current.y}`;
      continue;
    }

    const entry = {
      x: current.x - Math.sign(current.x - previous.x) * cornerRadius,
      y: current.y - Math.sign(current.y - previous.y) * cornerRadius,
    };
    const exit = {
      x: current.x + Math.sign(next.x - current.x) * cornerRadius,
      y: current.y + Math.sign(next.y - current.y) * cornerRadius,
    };

    path += ` L ${entry.x} ${entry.y} Q ${current.x} ${current.y} ${exit.x} ${exit.y}`;
  }

  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
}

function snap(value: number) {
  return Math.round(value / 10) * 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mod(value: number, base: number) {
  return ((value % base) + base) % base;
}

function nearlyEqual(left: number, right: number) {
  return Math.abs(left - right) <= EPSILON;
}

function createUniqueId(prefix: string, existingIds: string[]) {
  let index = 1;
  while (existingIds.includes(`${prefix}-${index}`)) {
    index += 1;
  }
  return `${prefix}-${index}`;
}

function formatRequestValue(request: LayoutRequest) {
  const nodes = request.nodes.map((node) => `    ${formatInlineObject(node)},`).join("\n");
  const edges = request.edges.map((edge) => `    ${formatInlineObject(edge)},`).join("\n");
  const lanes = request.lanes.map((lane) => `    ${formatInlineObject(lane)},`).join("\n");
  const groups = request.groups
    ? `\n  groups: [\n${request.groups.map((group) => `    ${formatInlineObject(group)},`).join("\n")}\n  ],`
    : "";

  return `{\n  nodes: [\n${nodes}\n  ],\n  edges: [\n${edges}\n  ],\n  lanes: [\n${lanes}\n  ],${groups}\n  defaults: ${formatInlineObject(request.defaults)},\n  spacing: ${formatInlineObject(request.spacing ?? {})},\n}`;
}

function formatInlineObjectArray(values: unknown[], baseIndent: number) {
  const indent = " ".repeat(baseIndent);
  const itemIndent = " ".repeat(baseIndent + 2);
  if (values.length === 0) {
    return "[]";
  }
  return `[\n${values.map((value) => `${itemIndent}${formatInlineObject(value)},`).join("\n")}\n${indent}]`;
}

function formatExpandedEdgeArray(edges: EdgeLayout[], baseIndent: number) {
  const indent = " ".repeat(baseIndent);
  const itemIndent = " ".repeat(baseIndent + 2);
  const nestedIndent = " ".repeat(baseIndent + 4);
  const pointIndent = " ".repeat(baseIndent + 6);
  if (edges.length === 0) {
    return "[]";
  }
  return `[\n${edges
    .map((edge) => {
      const points = edge.points.map((point) => `${pointIndent}${formatInlineObject(point)},`).join("\n");
      return `${itemIndent}{\n${nestedIndent}id: ${formatInlineValue(edge.id)},\n${nestedIndent}sourceId: ${formatInlineValue(edge.sourceId)},\n${nestedIndent}targetId: ${formatInlineValue(edge.targetId)},\n${nestedIndent}sourceAnchor: ${formatInlineObject(edge.sourceAnchor)},\n${nestedIndent}targetAnchor: ${formatInlineObject(edge.targetAnchor)},\n${nestedIndent}points: [\n${points}\n${nestedIndent}],\n${itemIndent}},`;
    })
    .join("\n")}\n${indent}]`;
}

function indentBlock(value: string, spaces: number) {
  const indent = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line.length > 0 ? `${indent}${line}` : line))
    .join("\n");
}

function formatInlineObject(value: unknown) {
  const entries = Object.entries(value as Record<string, unknown>).filter(([, entryValue]) => entryValue !== undefined);
  return `{ ${entries.map(([key, entryValue]) => `${key}: ${formatInlineValue(entryValue)}`).join(", ")} }`;
}

function formatInlineValue(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatInlineValue(item)).join(", ")}]`;
  }
  if (value && typeof value === "object") {
    return formatInlineObject(value);
  }
  return "undefined";
}

function formatPointLabel(point: Point) {
  return `${Math.round(point.x)}, ${Math.round(point.y)}`;
}

function isEditingElement(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function requireElement<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
