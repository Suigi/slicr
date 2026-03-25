import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActionsSection, AuxPanelsSection, HeaderSection } from '../../application/appViewModel';

type CommandPaletteProps = {
  auxPanels: AuxPanelsSection;
  actions: ActionsSection;
  header: HeaderSection;
};

export function CommandPalette({ auxPanels, actions, header }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const paletteRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const shouldSelectOnFocusRef = useRef(false);

  const commands = useMemo(
    () => [
      header.diagramMode === 'slice'
        ? {
            id: 'show-project-overview',
            label: 'Show Project Overview',
            context: 'View | Project',
            run: actions.onShowProjectOverview
          }
        : {
            id: 'hide-project-overview',
            label: 'Hide Project Overview',
            context: 'View | Project',
            run: actions.onHideProjectOverview
          },
      {
        id: 'add-node',
        label: 'Add Node...',
        context: 'Slice | Modeling',
        run: actions.onOpenAddNodeDialog
      },
      {
        id: 'import-node',
        label: 'Import Node...',
        context: 'Slice | Modeling',
        run: actions.onOpenImportNodeDialog
      },
      {
        id: 'apply-slice-template',
        label: 'Apply Slice Template...',
        context: 'Slice | Modeling',
        run: actions.onOpenCreateSliceTemplateDialog
      },
      {
        id: 'create-project',
        label: 'Create Project...',
        context: 'Window | Projects',
        run: actions.onOpenCreateProjectDialog
      },
      {
        id: 'compact-event-streams',
        label: 'Compact Event Streams...',
        context: 'Storage | Maintenance',
        run: actions.onOpenCompactEventsDialog
      },
      ...header.projectIndex.projects
        .filter((project) => project.id !== header.selectedProjectId)
        .map((project) => ({
          id: project.id,
          label: `Switch Project: ${project.name}`,
          context: 'Switch Project',
          run: () => actions.onSwitchProject(project.id)
        }))
    ],
    [actions, header.diagramMode, header.projectIndex.projects, header.selectedProjectId]
  );

  const isFuzzyMatch = (queryText: string, targetText: string) => {
    const normalizedQuery = queryText.toLowerCase().replace(/\s+/g, '');
    if (!normalizedQuery) {
      return true;
    }
    const normalizedTarget = targetText.toLowerCase().replace(/\s+/g, '');
    let queryIndex = 0;
    for (const char of normalizedTarget) {
      if (char === normalizedQuery[queryIndex]) {
        queryIndex += 1;
        if (queryIndex >= normalizedQuery.length) {
          return true;
        }
      }
    }
    return false;
  };

  const filteredCommands = useMemo(() => {
    const trimmed = query.trim();
    const isSliceMode = trimmed.startsWith('.');
    if (isSliceMode) {
      const fuzzyQuery = trimmed.slice(1);
      const projectSlices = header.library.slices.map((slice) => ({
        id: `slice:${slice.id}`,
        label: header.getSliceNameFromDsl(slice.dsl),
        context: 'Switch Slice',
        run: () => actions.onSelectSlice(slice.id)
      }));
      return projectSlices.filter((command) => isFuzzyMatch(fuzzyQuery, command.label));
    }
    const normalized = trimmed.toLowerCase();
    if (!normalized) {
      return commands;
    }
    return commands.filter((command) => command.label.toLowerCase().includes(normalized));
  }, [actions, commands, header, query]);
  const activeIndex = filteredCommands.length === 0 ? 0 : Math.min(selectedIndex, filteredCommands.length - 1);

  useEffect(() => {
    if (!auxPanels.commandPaletteOpen) return;
    shouldSelectOnFocusRef.current = true;
    searchRef.current?.focus();
  }, [auxPanels.commandPaletteOpen]);

  if (!auxPanels.commandPaletteOpen) {
    return null;
  }

  const runSelected = () => {
    const selected = filteredCommands[activeIndex];
    if (selected) {
      selected.run();
      return;
    }
  };

  return (
    <div ref={paletteRef} className="command-palette" role="dialog" aria-label="Command palette">
      <div className="command-palette-search-wrap">
        <span className="command-palette-search-icon" aria-hidden="true">⌕</span>
        <input
          ref={searchRef}
          type="text"
          className="command-palette-search"
          placeholder="Type a command or project name"
          aria-label="Filter commands"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={(event) => {
            if (!shouldSelectOnFocusRef.current) {
              return;
            }
            shouldSelectOnFocusRef.current = false;
            event.currentTarget.setSelectionRange(0, event.currentTarget.value.length);
          }}
          onBlur={() => {
            requestAnimationFrame(() => {
              const active = document.activeElement;
              if (active instanceof Node && paletteRef.current?.contains(active)) {
                return;
              }
              actions.onCloseCommandPalette();
            });
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              if (filteredCommands.length > 0) {
                setSelectedIndex((current) => {
                  const base = Math.min(current, filteredCommands.length - 1);
                  return (base + 1) % filteredCommands.length;
                });
              }
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              if (filteredCommands.length > 0) {
                setSelectedIndex((current) => {
                  const base = Math.min(current, filteredCommands.length - 1);
                  return (base - 1 + filteredCommands.length) % filteredCommands.length;
                });
              }
              return;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              runSelected();
              actions.onCloseCommandPalette();
            }
          }}
        />
      </div>
      <div className="command-palette-list" role="listbox" aria-label="Commands">
        {filteredCommands.map((command, index) => (
          <button
            key={command.id}
            type="button"
            className={`command-palette-item ${index === activeIndex ? 'selected' : ''}`}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={command.run}
          >
            <span className="command-palette-item-title">{command.label}</span>
            <span className="command-palette-item-meta">{command.context}</span>
          </button>
        ))}
        {filteredCommands.length === 0 ? (
          <div className="command-palette-empty" role="status" aria-live="polite">
            No commands found
          </div>
        ) : null}
      </div>
    </div>
  );
}
