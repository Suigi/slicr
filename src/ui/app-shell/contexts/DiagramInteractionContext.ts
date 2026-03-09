import { createContext, createElement, type ReactNode, useContext } from 'react';
import type { ActionsSection, DiagramSection } from '../../../application/appViewModel';

export type DiagramInteractionContextValue = {
  diagram: Pick<
    DiagramSection,
    | 'DiagramRenderer'
    | 'rendererViewportKey'
    | 'sceneModel'
    | 'initialCamera'
    | 'dragTooltip'
    | 'dragAndDropEnabled'
    | 'isPanning'
    | 'canvasPanelRef'
    | 'beginCanvasPan'
    | 'beginNodeDrag'
    | 'beginEdgeSegmentDrag'
  >;
  docsOpen: boolean;
  actions: Pick<ActionsSection, 'onNodeHoverRange' | 'onNodeSelect' | 'onNodeOpenInEditor' | 'onEdgeHover'>;
};

const DiagramInteractionContext = createContext<DiagramInteractionContextValue | null>(null);

type DiagramInteractionProviderProps = {
  value: DiagramInteractionContextValue;
  children: ReactNode;
};

export function DiagramInteractionProvider({ value, children }: DiagramInteractionProviderProps) {
  return createElement(DiagramInteractionContext.Provider, { value }, children);
}

export function useDiagramInteractionContext(): DiagramInteractionContextValue {
  const context = useContext(DiagramInteractionContext);
  if (!context) {
    throw new Error('useDiagramInteractionContext must be used within DiagramInteractionProvider');
  }
  return context;
}
