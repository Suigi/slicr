import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { DOCUMENTATION_GROUPS, DocumentationFeature } from './documentationCatalog';
import { buildRenderedEdges, computeDiagramLayout, computeProvisionalDiagramLayout } from './domain/diagramEngine';
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

type PreviewState = {
  featureDsl: string;
  preview: PreviewData;
  ready: boolean;
};

function initialPreview(): PreviewData {
  return { error: 'Preview not yet computed.' };
}

function computeInitialCamera(viewport: { width: number; height: number }) {
  const fitZoom = Math.min(
    1,
    DOC_PREVIEW_VIEWPORT_WIDTH / viewport.width,
    DOC_PREVIEW_VIEWPORT_HEIGHT / viewport.height
  );
  const boostedZoom = Math.min(1.2, fitZoom * DOC_PREVIEW_ZOOM_BOOST);

  return {
    x: (DOC_PREVIEW_VIEWPORT_WIDTH - viewport.width * boostedZoom) / 2,
    y: (DOC_PREVIEW_VIEWPORT_HEIGHT - viewport.height * boostedZoom) / 2,
    zoom: boostedZoom
  };
}

function buildPreviewData(feature: DocumentationFeature, preferAsync = false): PreviewData {
  try {
    const parsed = parseDsl(feature.dsl);
    const layout = preferAsync ? null : computeProvisionalDiagramLayout(parsed);
    if (!layout) {
      return initialPreview();
    }
    const displayedPos = layout.layout.pos;
    const renderedEdges = buildRenderedEdges(parsed, displayedPos, {});
    const sceneModel = buildSceneModel({
      parsed,
      activeLayout: layout.layout,
      displayedPos,
      renderedEdges,
      engineLayout: layout,
      activeNodeKeyFromEditor: null,
      selectedNodeKey: null,
      hoveredEdgeKey: null,
      hoveredTraceNodeKey: null,
      canvasMargin: DOC_PREVIEW_MARGIN
    });
    if (!sceneModel?.viewport) {
      return { error: 'Unable to compute preview viewport.' };
    }

    return {
      error: '',
      sceneModel,
      initialCamera: computeInitialCamera(sceneModel.viewport)
    };
  } catch (error) {
    return { error: (error as Error).message || 'Unable to render example.' };
  }
}

function FeatureCard({ feature, diagramRendererId }: { feature: DocumentationFeature; diagramRendererId: DiagramRendererId }) {
  const [previewState, setPreviewState] = useState<PreviewState>(() => ({
    featureDsl: feature.dsl,
    preview: buildPreviewData(feature),
    ready: false
  }));
  const canvasPanelRef = useRef<HTMLDivElement>(null);
  const DiagramRenderer = diagramRendererId === 'dom-svg-camera'
    ? DomSvgCameraDiagramRenderer
    : DomSvgDiagramRenderer;
  const noopEdgeHover: Dispatch<SetStateAction<string | null>> = () => {};
  const preview = previewState.featureDsl === feature.dsl ? previewState.preview : buildPreviewData(feature);
  const previewReady = previewState.featureDsl === feature.dsl ? previewState.ready : false;

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const parsed = parseDsl(feature.dsl);
        const layout = await computeDiagramLayout(parsed);
        if (!active) {
          return;
        }

        const displayedPos = layout.layout.pos;
        const renderedEdges = buildRenderedEdges(parsed, displayedPos, {});
        const sceneModel = buildSceneModel({
          parsed,
          activeLayout: layout.layout,
          displayedPos,
          renderedEdges,
          engineLayout: layout,
          activeNodeKeyFromEditor: null,
          selectedNodeKey: null,
          hoveredEdgeKey: null,
          hoveredTraceNodeKey: null,
          canvasMargin: DOC_PREVIEW_MARGIN
        });
        if (!sceneModel?.viewport) {
          setPreviewState({
            featureDsl: feature.dsl,
            preview: { error: 'Unable to compute preview viewport.' },
            ready: true
          });
          return;
        }

        setPreviewState({
          featureDsl: feature.dsl,
          preview: {
            error: '',
            sceneModel,
            initialCamera: computeInitialCamera(sceneModel.viewport)
          },
          ready: true
        });
      } catch (error) {
        if (!active) {
          return;
        }
        setPreviewState({
          featureDsl: feature.dsl,
          preview: { error: (error as Error).message || 'Unable to render example.' },
          ready: true
        });
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [feature]);

  return (
    <article className="doc-feature-card" data-doc-preview-ready={previewReady ? 'true' : 'false'}>
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
