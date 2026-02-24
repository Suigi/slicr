import { describe, expect, it, vi, expectTypeOf } from 'vitest';
import {
  createNoopDiagramRendererCallbacks,
  type DiagramRendererCallbacks,
  type DiagramRendererProps,
  type DiagramSceneModel
} from './rendererContract';

describe('rendererContract', () => {
  it('creates a full callback object with no-op defaults and respects overrides', () => {
    const onNodeSelect = vi.fn();
    const callbacks = createNoopDiagramRendererCallbacks({ onNodeSelect });

    callbacks.onNodeHoverRange(null);
    callbacks.onNodeSelect('node-a');
    callbacks.onEdgeHover(null);
    callbacks.onNodeMoveCommit('node-a', { x: 10, y: 20 });
    callbacks.onEdgePointsCommit('edge-a', [{ x: 0, y: 0 }, { x: 1, y: 1 }]);

    expect(onNodeSelect).toHaveBeenCalledTimes(1);
    expect(onNodeSelect).toHaveBeenCalledWith('node-a');
  });

  it('exposes strict renderer prop types', () => {
    expectTypeOf<DiagramRendererProps>().toMatchTypeOf<{
      scene: DiagramSceneModel;
      callbacks: DiagramRendererCallbacks;
      className?: string;
    }>();
  });
});
