import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import { useEffect } from 'react';
import type { SliceLibrary } from '../../sliceLibrary';
import { saveSliceLibrary, saveSliceLayoutOverrides, selectSlice } from '../../sliceLibrary';
import type { ProjectIndex } from '../../projectLibrary';
import type { DiagramMode } from '../appViewModel';

export type UseUiEffectsArgs = {
  projectIndex: ProjectIndex;
  selectedProjectId: string;
  library: SliceLibrary;
  manualNodePositions: Record<string, { x: number; y: number }>;
  manualEdgePoints: Record<string, Array<{ x: number; y: number }>>;
  skipNextLayoutSaveRef: MutableRefObject<boolean>;
  editorOpen: boolean;
  editorRef: RefObject<HTMLDivElement | null>;
  toggleRef: RefObject<HTMLButtonElement | null>;
  sliceMenuOpen: boolean;
  mobileMenuOpen: boolean;
  createProjectDialogOpen: boolean;
  compactEventsDialogOpen: boolean;
  addNodeDialogOpen: boolean;
  importNodeDialogOpen: boolean;
  createSliceTemplateDialogOpen: boolean;
  sliceMenuRef: RefObject<HTMLDivElement | null>;
  mobileMenuRef: RefObject<HTMLDivElement | null>;
  currentSliceName: string;
  theme: string;
  themeStorageKey: string;
  selectedNode: { key: string } | null;
  showDataTraceTab: boolean;
  selectedNodeUsesKeys: string[];
  diagramMode: DiagramMode;
  setSelectedNodeKey: Dispatch<SetStateAction<string | null>>;
  setHighlightRange: Dispatch<SetStateAction<{ from: number; to: number } | null>>;
  setLibrary: Dispatch<SetStateAction<SliceLibrary>>;
  setEditorOpen: Dispatch<SetStateAction<boolean>>;
  setSliceMenuOpen: Dispatch<SetStateAction<boolean>>;
  setMobileMenuOpen: Dispatch<SetStateAction<boolean>>;
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>;
  setCreateProjectDialogOpen: Dispatch<SetStateAction<boolean>>;
  setCompactEventsDialogOpen: Dispatch<SetStateAction<boolean>>;
  setAddNodeDialogOpen: Dispatch<SetStateAction<boolean>>;
  setImportNodeDialogOpen: Dispatch<SetStateAction<boolean>>;
  setCreateSliceTemplateDialogOpen: Dispatch<SetStateAction<boolean>>;
  setCrossSliceTraceExpandedKeys: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSelectedNodePanelTab: Dispatch<SetStateAction<'usage' | 'crossSliceData' | 'trace'>>;
  applySelectedSliceOverrides: (sliceId: string) => void;
  onShowProjectOverview: () => void;
  onHideProjectOverview: () => void;
};

export function useUiEffects(args: UseUiEffectsArgs) {
  const {
    projectIndex,
    selectedProjectId,
    library,
    manualNodePositions,
    manualEdgePoints,
    skipNextLayoutSaveRef,
    editorOpen,
    editorRef,
    toggleRef,
    sliceMenuOpen,
    mobileMenuOpen,
    createProjectDialogOpen,
    compactEventsDialogOpen,
    addNodeDialogOpen,
    importNodeDialogOpen,
    createSliceTemplateDialogOpen,
    sliceMenuRef,
    mobileMenuRef,
    currentSliceName,
    theme,
    themeStorageKey,
    selectedNode,
    showDataTraceTab,
    selectedNodeUsesKeys,
    diagramMode,
    setSelectedNodeKey,
    setHighlightRange,
    setLibrary,
    setEditorOpen,
    setSliceMenuOpen,
    setMobileMenuOpen,
    setCommandPaletteOpen,
    setCreateProjectDialogOpen,
    setCompactEventsDialogOpen,
    setAddNodeDialogOpen,
    setImportNodeDialogOpen,
    setCreateSliceTemplateDialogOpen,
    setCrossSliceTraceExpandedKeys,
    setSelectedNodePanelTab,
    applySelectedSliceOverrides,
    onShowProjectOverview,
    onHideProjectOverview
  } = args;

  useEffect(() => {
    try {
      saveSliceLibrary(library, selectedProjectId);
    } catch {
      // Ignore storage failures.
    }
  }, [library, selectedProjectId]);

  void projectIndex;

  useEffect(() => {
    if (skipNextLayoutSaveRef.current) {
      skipNextLayoutSaveRef.current = false;
      return;
    }
    try {
      saveSliceLayoutOverrides(
        library.selectedSliceId,
        {
          nodes: manualNodePositions,
          edges: manualEdgePoints
        },
        { emitEvents: false },
        selectedProjectId
      );
    } catch {
      // Ignore storage failures.
    }
  }, [library.selectedSliceId, manualNodePositions, manualEdgePoints, skipNextLayoutSaveRef, selectedProjectId]);

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (!editorOpen) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const clickedEditor = editorRef.current?.contains(target) ?? false;
      const clickedToggle = toggleRef.current?.contains(target) ?? false;
      if (!clickedEditor && !clickedToggle) {
        setEditorOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [editorOpen, editorRef, toggleRef, setEditorOpen]);

  useEffect(() => {
    const deselectOnCanvasClick = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const canvas = document.getElementById('canvas');
      const targetElement = target as HTMLElement;
      const isCanvasClick = canvas?.contains(target) ?? false;
      const isNodeClick = targetElement.closest('.node');
      const isEdgeHandleClick = targetElement.closest('.edge-segment-handle');

      if (isCanvasClick && !isNodeClick && !isEdgeHandleClick) {
        const pointerId = event.pointerId;
        const startX = event.clientX;
        const startY = event.clientY;
        let moved = false;
        const DRAG_THRESHOLD_PX = 4;

        const cleanup = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onCancel);
        };

        const onMove = (moveEvent: PointerEvent) => {
          if (moveEvent.pointerId !== pointerId) {
            return;
          }
          if (
            Math.abs(moveEvent.clientX - startX) > DRAG_THRESHOLD_PX
            || Math.abs(moveEvent.clientY - startY) > DRAG_THRESHOLD_PX
          ) {
            moved = true;
          }
        };

        const onUp = (upEvent: PointerEvent) => {
          if (upEvent.pointerId !== pointerId) {
            return;
          }
          cleanup();
          if (!moved) {
            setSelectedNodeKey(null);
          }
        };

        const onCancel = (cancelEvent: PointerEvent) => {
          if (cancelEvent.pointerId !== pointerId) {
            return;
          }
          cleanup();
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
      }
    };

    document.addEventListener('pointerdown', deselectOnCanvasClick);
    return () => document.removeEventListener('pointerdown', deselectOnCanvasClick);
  }, [setSelectedNodeKey]);

  useEffect(() => {
    const localPrefix = window.location.hostname === 'localhost' ? '[local] ' : '';
    document.title = `${localPrefix}Slicer - ${currentSliceName}`;
  }, [currentSliceName]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // Ignore storage failures.
    }
  }, [theme, themeStorageKey]);

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (!sliceMenuOpen) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const clickedMenu = sliceMenuRef.current?.contains(target) ?? false;
      if (!clickedMenu) {
        setSliceMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [sliceMenuOpen, sliceMenuRef, setSliceMenuOpen]);

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (!mobileMenuOpen) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const clickedMenu = mobileMenuRef.current?.contains(target) ?? false;
      if (!clickedMenu) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [mobileMenuOpen, mobileMenuRef, setMobileMenuOpen]);

  useEffect(() => {
    const isEscapeKey = (key: string) => key === 'Escape' || key === 'Esc';

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEscapeKey(event.key)) {
        event.preventDefault();
        setCommandPaletteOpen(false);
        if (createProjectDialogOpen) {
          setCreateProjectDialogOpen(false);
        }
        if (compactEventsDialogOpen) {
          setCompactEventsDialogOpen(false);
        }
        if (addNodeDialogOpen) {
          setAddNodeDialogOpen(false);
        }
        if (importNodeDialogOpen) {
          setImportNodeDialogOpen(false);
        }
        if (createSliceTemplateDialogOpen) {
          setCreateSliceTemplateDialogOpen(false);
        }
        return;
      }

      const isCommandPalette = (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'k';
      if (isCommandPalette) {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }

      const isTraceShortcut = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 't';
      if (isTraceShortcut && selectedNode && showDataTraceTab) {
        event.preventDefault();
        const firstKey = selectedNodeUsesKeys[0] ?? null;
        if (firstKey) {
          setCrossSliceTraceExpandedKeys({ [firstKey]: true });
        }
        setSelectedNodePanelTab('trace');
        return;
      }

      const isProjectOverviewShortcut = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'o';
      if (isProjectOverviewShortcut) {
        event.preventDefault();
        if (diagramMode === 'overview') {
          onHideProjectOverview();
          return;
        }
        onShowProjectOverview();
        return;
      }

      const isNextSliceShortcut = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'j';
      const isPreviousSliceShortcut = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'k';
      if (isNextSliceShortcut || isPreviousSliceShortcut) {
        event.preventDefault();
        const delta = isNextSliceShortcut ? 1 : -1;
        setSelectedNodeKey(null);
        setHighlightRange(null);
        setLibrary((currentLibrary) => {
          const currentIndex = currentLibrary.slices.findIndex((slice) => slice.id === currentLibrary.selectedSliceId);
          if (currentIndex < 0) {
            return currentLibrary;
          }
          const nextSlice = currentLibrary.slices[currentIndex + delta];
          if (!nextSlice) {
            return currentLibrary;
          }
          const nextLibrary = selectSlice(currentLibrary, nextSlice.id);
          if (nextLibrary.selectedSliceId !== currentLibrary.selectedSliceId) {
            applySelectedSliceOverrides(nextLibrary.selectedSliceId);
          }
          return nextLibrary;
        });
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!isEscapeKey(event.key)) {
        return;
      }
      event.preventDefault();
      setCommandPaletteOpen(false);
      if (createProjectDialogOpen) {
        setCreateProjectDialogOpen(false);
      }
      if (compactEventsDialogOpen) {
        setCompactEventsDialogOpen(false);
      }
      if (addNodeDialogOpen) {
        setAddNodeDialogOpen(false);
      }
      if (importNodeDialogOpen) {
        setImportNodeDialogOpen(false);
      }
      if (createSliceTemplateDialogOpen) {
        setCreateSliceTemplateDialogOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    selectedNode,
    showDataTraceTab,
    selectedNodeUsesKeys,
    diagramMode,
    createProjectDialogOpen,
    compactEventsDialogOpen,
    addNodeDialogOpen,
    importNodeDialogOpen,
    createSliceTemplateDialogOpen,
    setCommandPaletteOpen,
    setCreateProjectDialogOpen,
    setCompactEventsDialogOpen,
    setAddNodeDialogOpen,
    setImportNodeDialogOpen,
    setCreateSliceTemplateDialogOpen,
    setCrossSliceTraceExpandedKeys,
    setSelectedNodePanelTab,
    setSelectedNodeKey,
    setHighlightRange,
    setLibrary,
    applySelectedSliceOverrides,
    onShowProjectOverview,
    onHideProjectOverview
  ]);
}
