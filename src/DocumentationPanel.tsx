import { Dispatch, SetStateAction, useMemo, useRef } from 'react';
import { DOCUMENTATION_GROUPS, DocumentationFeature } from './documentationCatalog';
import { buildRenderedEdges, computeClassicDiagramLayout } from './domain/diagramEngine';
import { parseDsl } from './domain/parseDsl';
import { DiagramRendererId } from './domain/runtimeFlags';
import { ReadOnlyDslEditor } from './ReadOnlyDslEditor';
import { DomSvgDiagramRenderer } from './diagram/domSvgRenderer';
import { DomSvgCameraDiagramRenderer } from './diagram/domSvgCameraRenderer';
import { buildSceneModel } from './diagram/sceneModel';
const DOC_PREVIEW_MARGIN = 64;
const DOC_PREVIEW_VIEWPORT_WIDTH = 560;
const DOC_PREVIEW_VIEWPORT_HEIGHT = 560;
const DOC_PREVIEW_ZOOM_BOOST = 1.2;

type PreviewData =
  | {
      error: string;
    }
  | {
      error: '';
      sceneModel: NonNullable<ReturnType<typeof buildSceneModel>>;
      initialCamera: { x: number; y: number; zoom: number };
    };

function computePreview(feature: DocumentationFeature): PreviewData {
  try {
    const parsed = parseDsl(feature.dsl);
    const layout = computeClassicDiagramLayout(parsed);
    if (!layout) {
      return { error: 'No nodes to render in this example.' };
    }

    const displayedPos = layout.layout.pos;
    const renderedEdges = buildRenderedEdges(parsed, displayedPos, 'elk', {});
    const sceneModel = buildSceneModel({
      parsed,
      activeLayout: layout.layout,
      displayedPos,
      renderedEdges,
      routeMode: 'classic',
      engineLayout: layout,
      activeNodeKeyFromEditor: null,
      selectedNodeKey: null,
      hoveredEdgeKey: null,
      hoveredTraceNodeKey: null,
      canvasMargin: DOC_PREVIEW_MARGIN
    });
    if (!sceneModel) {
      return { error: 'Unable to build preview scene.' };
    }
    const sourceViewport = sceneModel.viewport;
    if (!sourceViewport) {
      return { error: 'Unable to compute preview viewport.' };
    }
    const fitZoom = Math.min(
      1,
      DOC_PREVIEW_VIEWPORT_WIDTH / sourceViewport.width,
      DOC_PREVIEW_VIEWPORT_HEIGHT / sourceViewport.height
    );
    const boostedZoom = Math.min(1.2, fitZoom * DOC_PREVIEW_ZOOM_BOOST);
    const initialCamera = {
      x: (DOC_PREVIEW_VIEWPORT_WIDTH - sourceViewport.width * boostedZoom) / 2,
      y: (DOC_PREVIEW_VIEWPORT_HEIGHT - sourceViewport.height * boostedZoom) / 2,
      zoom: boostedZoom
    };

    return {
      error: '',
      sceneModel,
      initialCamera
    };
  } catch (error) {
    return { error: (error as Error).message || 'Unable to render example.' };
  }
}

function FeatureCard({ feature, diagramRendererId }: { feature: DocumentationFeature; diagramRendererId: DiagramRendererId }) {
  const preview = useMemo(() => computePreview(feature), [feature]);
  const canvasPanelRef = useRef<HTMLDivElement>(null);
  const DiagramRenderer = diagramRendererId === 'dom-svg-camera'
    ? DomSvgCameraDiagramRenderer
    : DomSvgDiagramRenderer;
  const noopEdgeHover: Dispatch<SetStateAction<string | null>> = () => {};

  return (
    <article className="doc-feature-card">
      <div className="doc-feature-header">
        <div>
          <h4>{feature.title}</h4>
          <p>{feature.description}</p>
        </div>
      </div>

      <div className="doc-feature-content">
        <ReadOnlyDslEditor className="doc-dsl" value={feature.dsl} copyAriaLabel={`Copy example for ${feature.title}`} />

        {'sceneModel' in preview && preview.error === '' ? (
          <div className="doc-diagram-shell">
            <div
              className="doc-diagram"
              style={{
                width: `${DOC_PREVIEW_VIEWPORT_WIDTH}px`,
                height: `${DOC_PREVIEW_VIEWPORT_HEIGHT}px`
              }}
            >
              <DiagramRenderer
                sceneModel={preview.sceneModel}
                canvasPanelRef={canvasPanelRef}
                isPanning={false}
                docsOpen={false}
                dragTooltip={null}
                dragAndDropEnabled={false}
                routeMode="classic"
                beginCanvasPan={() => {}}
                beginNodeDrag={() => {}}
                beginEdgeSegmentDrag={() => {}}
                onNodeHoverRange={() => {}}
                onNodeSelect={() => {}}
                onNodeOpenInEditor={() => {}}
                onEdgeHover={noopEdgeHover}
                rendererId={diagramRendererId}
                cameraControlsEnabled={false}
                initialCamera={preview.initialCamera}
              />
            </div>
          </div>
        ) : (
          <div className="doc-render-error">⚠ {preview.error}</div>
        )}
      </div>
    </article>
  );
}

export function DocumentationPanel({ diagramRendererId }: { diagramRendererId: DiagramRendererId }) {
  return (
    <div className="docs-panel">
      <div className="docs-panel-inner">
        <section className="docs-intro">
          <h2>Syntax Documentation</h2>
          <p>Use these examples as a quick reference for writing valid diagram syntax.</p>
        </section>

        {DOCUMENTATION_GROUPS.map((group) => (
          <section key={group.id} className="doc-group">
            <div className="doc-group-header">
              <h3>{group.title}</h3>
              <p>{group.description}</p>
            </div>
            <div className="doc-feature-list">
              {group.features.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} diagramRendererId={diagramRendererId} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
