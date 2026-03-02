import { createContext, createElement, type ReactNode, useContext } from 'react';
import type {
  ActionsSection,
  AnalysisPanelSection,
  ConstantsSection,
  DiagramSection
} from '../../../application/appViewModel';

export type AnalysisContextValue = {
  analysisPanel: AnalysisPanelSection;
  diagram: Pick<DiagramSection, 'parsed' | 'currentDsl'>;
  constants: Pick<ConstantsSection, 'TYPE_LABEL' | 'formatTraceSource' | 'getAmbiguousSourceCandidates'>;
  actions: Pick<
    ActionsSection,
    | 'onSelectedNodePanelTabChange'
    | 'onToggleCrossSliceDataExpanded'
    | 'onToggleCrossSliceTraceExpanded'
    | 'onTraceNodeHover'
    | 'onSetSourceOverride'
    | 'onJumpToUsage'
  >;
};

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

type AnalysisProviderProps = {
  value: AnalysisContextValue;
  children: ReactNode;
};

export function AnalysisProvider({ value, children }: AnalysisProviderProps) {
  return createElement(AnalysisContext.Provider, { value }, children);
}

export function useAnalysisContext(): AnalysisContextValue {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error('useAnalysisContext must be used within AnalysisProvider');
  }
  return context;
}
