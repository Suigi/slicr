import { createContext, createElement, type ReactNode, useContext } from 'react';
import type { ActionsSection, HeaderSection } from '../../../application/appViewModel';

export type HeaderUiContextValue = {
  header: HeaderSection;
  actions: ActionsSection;
  editorOpen: boolean;
};

const HeaderUiContext = createContext<HeaderUiContextValue | null>(null);

type HeaderUiProviderProps = {
  value: HeaderUiContextValue;
  children: ReactNode;
};

export function HeaderUiProvider({ value, children }: HeaderUiProviderProps) {
  return createElement(HeaderUiContext.Provider, { value }, children);
}

export function useHeaderUiContext(): HeaderUiContextValue {
  const context = useContext(HeaderUiContext);
  if (!context) {
    throw new Error('useHeaderUiContext must be used within HeaderUiProvider');
  }
  return context;
}
