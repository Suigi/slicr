import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { PropertyGridEditableProperty, PropertyGridTableRow } from '../PropertyGrid';
import './PropertyEditor.css';

const propertyTypes = ['string', 'number', 'boolean', 'Object'] as const;

export type PropertyType = (typeof propertyTypes)[number];

export type PropertyExampleValue = string | PropertyGridTableRow;

export type EditableProperty = Omit<PropertyGridEditableProperty, 'type' | 'value' | 'properties' | 'exampleValues' | 'rows'> & {
  type: PropertyType;
  properties?: EditableProperty[];
  exampleValues?: PropertyExampleValue[];
  rows?: PropertyGridTableRow[];
};

type PropertyEditorProps = {
  properties: EditableProperty[];
  onChange: (properties: EditableProperty[]) => void;
  showPropertyToolbar?: boolean;
  showColumnHeaders?: boolean;
  disableExampleValues?: boolean;
};

const createPropertyId = () => crypto.randomUUID();

const emptyProperty = (): EditableProperty => ({
  id: createPropertyId(),
  name: '',
  type: 'string',
  example: '',
});

const ensurePropertyIds = (properties: EditableProperty[]): { properties: EditableProperty[]; changed: boolean } => {
  let changed = false;

  const propertiesWithIds = properties.map((property) => {
    const nestedResult = property.properties ? ensurePropertyIds(property.properties) : undefined;
    const nestedProperties = nestedResult?.properties ?? property.properties;
    const rows = property.rows?.map((row) => {
      if (property.type !== 'Object' || !nestedProperties) {
        return row;
      }

      let rowChanged = false;
      const rowWithPropertyIds = { ...row };

      nestedProperties.forEach((nestedProperty) => {
        if (nestedProperty.id && rowWithPropertyIds[nestedProperty.id] === undefined && rowWithPropertyIds[nestedProperty.name] !== undefined) {
          rowWithPropertyIds[nestedProperty.id] = rowWithPropertyIds[nestedProperty.name];
          rowChanged = true;
        }
      });

      changed ||= rowChanged;
      return rowChanged ? rowWithPropertyIds : row;
    });
    const propertyWithId: EditableProperty = {
      ...property,
      id: property.id ?? createPropertyId(),
      properties: nestedProperties,
      rows,
    };

    changed ||= !property.id || Boolean(nestedResult?.changed);
    return propertyWithId;
  });

  return { properties: propertiesWithIds, changed };
};

export function PropertyEditor({
  properties,
  onChange,
  showPropertyToolbar = true,
  showColumnHeaders = true,
  disableExampleValues = false,
}: PropertyEditorProps) {
  const normalizedProperties = useMemo(() => ensurePropertyIds(properties), [properties]);
  const editorProperties = normalizedProperties.properties;
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedExample, setDraggedExample] = useState<{ propertyIndex: number; exampleIndex: number } | null>(null);
  const [settingsIndex, setSettingsIndex] = useState<number | null>(null);
  const [templatePropertyType, setTemplatePropertyType] = useState<PropertyType>('string');
  const templateNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (normalizedProperties.changed) {
      onChange(editorProperties);
    }
  }, [editorProperties, normalizedProperties.changed, onChange]);

  const updateProperty = (index: number, property: EditableProperty) => {
    onChange(editorProperties.map((currentProperty, currentIndex) => (currentIndex === index ? property : currentProperty)));
  };

  const removeProperty = (index: number) => {
    onChange(editorProperties.filter((_, currentIndex) => currentIndex !== index));
    setSettingsIndex((currentIndex) => {
      if (currentIndex === null || currentIndex === index) {
        return null;
      }

      return currentIndex > index ? currentIndex - 1 : currentIndex;
    });
  };

  const updatePropertyType = (index: number, property: EditableProperty, type: PropertyType) => {
    updateProperty(index, {
      ...property,
      type,
      properties: type === 'Object' ? property.properties ?? [] : undefined,
    });
  };

  const updateNestedProperties = (index: number, nestedProperties: EditableProperty[]) => {
    const property = editorProperties[index];

    if (!property) {
      return;
    }

    updateProperty(index, { ...property, properties: nestedProperties });
  };

  const addPropertyFromTemplate = (propertyUpdate: Partial<EditableProperty>) => {
    const property = {
      ...emptyProperty(),
      type: templatePropertyType,
      properties: templatePropertyType === 'Object' ? [] : undefined,
      ...propertyUpdate,
    };

    onChange([...editorProperties, property]);
    setTemplatePropertyType('string');
  };

  const addPropertyFromTemplateInput = (input: HTMLInputElement) => {
    const name = input.value.trim();

    if (!name) {
      return false;
    }

    addPropertyFromTemplate({ name });
    input.value = '';
    return true;
  };

  const getInitialExampleValues = (property: EditableProperty): PropertyExampleValue[] => {
    if (property.exampleValues) {
      return property.exampleValues;
    }

    if (!property.example) {
      return [];
    }

    return [property.example];
  };

  const getInitialRows = (property: EditableProperty): PropertyGridTableRow[] => {
    if (property.rows) {
      return property.rows;
    }

    if ((property.properties ?? []).length > 0) {
      return [Object.fromEntries((property.properties ?? []).map((nestedProperty) => [nestedProperty.id ?? nestedProperty.name, nestedProperty.example ?? '']))];
    }

    return [];
  };

  const updateListMode = (index: number, property: EditableProperty, list: boolean) => {
    updateProperty(index, {
      ...property,
      list,
      rows: property.type === 'Object' ? (list ? getInitialRows(property) : undefined) : property.rows,
      exampleValues: property.type === 'Object' ? property.exampleValues : list ? getInitialExampleValues(property) : undefined,
    });
  };

  const addPrimitiveExampleValueFromTemplate = (index: number, property: EditableProperty, value: string) => {
    updateProperty(index, {
      ...property,
      exampleValues: [...(property.exampleValues ?? []), value],
    });
  };

  const addPrimitiveExampleValueFromTemplateInput = (index: number, property: EditableProperty, input: HTMLInputElement) => {
    const value = input.value.trim();

    if (!value) {
      return;
    }

    addPrimitiveExampleValueFromTemplate(index, property, value);
    input.value = '';
  };

  const addObjectExampleValueFromTemplate = (
    index: number,
    property: EditableProperty,
    fieldKey: string,
    value: string,
  ) => {
    updateProperty(index, {
      ...property,
      rows: [...(property.rows ?? []), { [fieldKey]: value }],
    });
  };

  const addObjectExampleValueFromTemplateInput = (
    index: number,
    property: EditableProperty,
    fieldKey: string,
    input: HTMLInputElement,
  ) => {
    const value = input.value.trim();

    if (!value) {
      return;
    }

    addObjectExampleValueFromTemplate(index, property, fieldKey, value);
    input.value = '';
  };

  const removeExampleValue = (propertyIndex: number, property: EditableProperty, exampleIndex: number) => {
    updateProperty(
      propertyIndex,
      property.type === 'Object'
        ? { ...property, rows: (property.rows ?? []).filter((_, currentIndex) => currentIndex !== exampleIndex) }
        : { ...property, exampleValues: (property.exampleValues ?? []).filter((_, currentIndex) => currentIndex !== exampleIndex) },
    );
  };

  const reorderExampleValue = (
    propertyIndex: number,
    property: EditableProperty,
    fromIndex: number,
    toIndex: number,
  ) => {
    if (fromIndex === toIndex) {
      return;
    }

    const values = property.type === 'Object' ? [...(property.rows ?? [])] : [...(property.exampleValues ?? [])];

    if (fromIndex < 0 || fromIndex >= values.length || toIndex < 0 || toIndex >= values.length) {
      return;
    }

    const [value] = values.splice(fromIndex, 1);
    values.splice(toIndex, 0, value);
    updateProperty(propertyIndex, property.type === 'Object' ? { ...property, rows: values as PropertyGridTableRow[] } : { ...property, exampleValues: values });
  };

  const updatePrimitiveExampleValue = (
    propertyIndex: number,
    property: EditableProperty,
    exampleIndex: number,
    value: string,
  ) => {
    updateProperty(propertyIndex, {
      ...property,
      exampleValues: (property.exampleValues ?? []).map((exampleValue, currentIndex) =>
        currentIndex === exampleIndex ? value : exampleValue,
      ),
    });
  };

  const updateObjectExampleValue = (
    propertyIndex: number,
    property: EditableProperty,
    exampleIndex: number,
    fieldKey: string,
    value: string,
  ) => {
    updateProperty(propertyIndex, {
      ...property,
      rows: (property.rows ?? []).map((row, currentIndex) => (currentIndex === exampleIndex ? { ...row, [fieldKey]: value } : row)),
    });
  };

  const reorderProperty = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= editorProperties.length || toIndex < 0 || toIndex >= editorProperties.length) {
      return;
    }

    const reorderedProperties = [...editorProperties];
    const [property] = reorderedProperties.splice(fromIndex, 1);
    reorderedProperties.splice(toIndex, 0, property);
    onChange(reorderedProperties);
    setSettingsIndex((currentIndex) => (currentIndex === fromIndex ? toIndex : currentIndex));
  };

  const isReorderShortcut = (event: KeyboardEvent) =>
    event.shiftKey && (event.ctrlKey || event.metaKey) && (event.key === 'ArrowUp' || event.key === 'ArrowDown');

  const selectFocusedCellText = (target: EventTarget) => {
    if (target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'search')) {
      target.select();
    }
  };

  const getFocusableElements = (element: Element) =>
    Array.from(
      element.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]'),
    ).filter((focusableElement) => focusableElement.tabIndex >= 0 && !focusableElement.closest('[aria-hidden="true"]'));

  const getCellElements = (element: Element) =>
    Array.from(element.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), [tabindex]'))
      .filter((focusableElement) => focusableElement.tabIndex >= 0 && !focusableElement.closest('[aria-hidden="true"]'));

  const getOutermostPropertyEditor = (element: HTMLElement) => {
    let editor = element.closest<HTMLElement>('.property-editor');

    while (editor?.parentElement?.closest('.property-editor')) {
      editor = editor.parentElement.closest<HTMLElement>('.property-editor');
    }

    return editor;
  };

  const getNavigableRows = (row: HTMLElement) =>
    Array.from(
      getOutermostPropertyEditor(row)?.querySelectorAll<HTMLElement>(
        '.property-editor-row, .property-editor-list-value-row, .property-editor-list-table tbody tr',
      ) ?? [],
    );

  const focusRowControl = (row: HTMLElement | undefined, controlIndex: number) => {
    if (!row) {
      return false;
    }

    const controls = getFocusableElements(row);
    const control = controls[Math.min(controlIndex, controls.length - 1)];

    if (!control) {
      return false;
    }

    control.focus();
    return true;
  };

  const focusAdjacentRowControl = (event: KeyboardEvent) => {
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return false;
    }

    const row = event.currentTarget as HTMLElement;
    const rows = getNavigableRows(row);
    const rowIndex = rows.indexOf(row);
    const currentControlIndex = Math.max(getFocusableElements(row).indexOf(event.target as HTMLElement), 0);

    if (!focusRowControl(rows[rowIndex + (event.key === 'ArrowUp' ? -1 : 1)], currentControlIndex)) {
      return false;
    }

    event.preventDefault();
    return true;
  };

  const focusNextCell = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }

    const row = event.currentTarget as HTMLElement;
    const rows = getNavigableRows(row);
    const rowIndex = rows.indexOf(row);
    const controls = getCellElements(row);
    const controlIndex = controls.indexOf(event.target as HTMLElement);

    if (controlIndex === -1) {
      return false;
    }

    const direction = event.shiftKey ? -1 : 1;
    const nextControl = controls[controlIndex + direction];

    event.preventDefault();

    if (nextControl) {
      nextControl.focus();
      return true;
    }

    const nextRow = rows[rowIndex + direction];
    const nextRowControls = nextRow ? getCellElements(nextRow) : [];
    const wrappedControl = event.shiftKey ? nextRowControls[nextRowControls.length - 1] : nextRowControls[0];

    if (!wrappedControl) {
      return false;
    }

    wrappedControl.focus();
    return true;
  };

  const focusRelevantTemplateRow = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) {
      return false;
    }

    const row = event.currentTarget as HTMLElement;
    const templateRow = row.closest('.property-editor-list-editor')?.querySelector<HTMLElement>('.property-editor-template-row')
      ?? row.closest('.property-editor')?.querySelector<HTMLElement>(':scope > .property-editor-grid > .property-editor-template-row');

    if (!templateRow) {
      return false;
    }

    event.preventDefault();
    focusRowControl(templateRow, 0);
    return true;
  };

  const focusAfterRemovedRow = (row: HTMLElement, controlIndex: number) => {
    const editor = getOutermostPropertyEditor(row);
    const rows = getNavigableRows(row);
    const rowIndex = rows.indexOf(row);

    setTimeout(() => {
      const nextRows = Array.from(
        editor?.querySelectorAll<HTMLElement>(
          '.property-editor-row, .property-editor-list-value-row, .property-editor-list-table tbody tr',
        ) ?? [],
      );
      if (!focusRowControl(nextRows[Math.min(rowIndex, nextRows.length - 1)], controlIndex)) {
        focusRowControl(nextRows[rowIndex - 1], controlIndex);
      }
    });
  };

  const handlePropertyShortcut = (event: KeyboardEvent, index: number) => {
    if (focusAdjacentRowControl(event) || focusRelevantTemplateRow(event) || focusNextCell(event)) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Backspace') {
      event.preventDefault();
      focusAfterRemovedRow(event.currentTarget as HTMLElement, Math.max(getFocusableElements(event.currentTarget as HTMLElement).indexOf(event.target as HTMLElement), 0));
      removeProperty(index);
      return;
    }

    if (!isReorderShortcut(event)) {
      return;
    }

    event.preventDefault();
    reorderProperty(index, event.key === 'ArrowUp' ? index - 1 : index + 1);
  };

  const handleExampleShortcut = (event: KeyboardEvent, propertyIndex: number, property: EditableProperty, exampleIndex: number) => {
    if (focusAdjacentRowControl(event) || focusRelevantTemplateRow(event) || focusNextCell(event)) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Backspace') {
      event.preventDefault();
      focusAfterRemovedRow(event.currentTarget as HTMLElement, Math.max(getFocusableElements(event.currentTarget as HTMLElement).indexOf(event.target as HTMLElement), 0));
      removeExampleValue(propertyIndex, property, exampleIndex);
      return;
    }

    if (!isReorderShortcut(event)) {
      return;
    }

    event.preventDefault();
    reorderExampleValue(propertyIndex, property, exampleIndex, event.key === 'ArrowUp' ? exampleIndex - 1 : exampleIndex + 1);
  };

  const handleTemplateShortcut = (event: KeyboardEvent) => {
    if (focusAdjacentRowControl(event) || focusRelevantTemplateRow(event) || focusNextCell(event)) {
      return;
    }
  };

  const refocusInput = (input: HTMLInputElement) => {
    setTimeout(() => {
      input.focus();
      input.select();
    });
  };

  const focusAddedPropertyTypeCell = (templateInput: HTMLInputElement) => {
    const editor = templateInput.closest<HTMLElement>('.property-editor');
    const newPropertyIndex = editorProperties.length;

    setTimeout(() => {
      const newPropertyRow = editor?.querySelectorAll<HTMLElement>(':scope > .property-editor-grid > .property-editor-row:not(.property-editor-template-row)')[newPropertyIndex];
      const typeCell = newPropertyRow?.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled)')[1];
      typeCell?.focus();
    });
  };

  return (
    <div className="property-editor" onFocusCapture={(event) => selectFocusedCellText(event.target)}>
      <div className="property-editor-grid" role="table" aria-label="Object schema properties">
        {showColumnHeaders ? (
          <div className="property-editor-grid-heading" role="row">
            <span role="columnheader" aria-label="Reorder" />
            <span role="columnheader">Name</span>
            <span role="columnheader">Type</span>
            <span role="columnheader">Example</span>
            <span role="columnheader" className="property-editor-actions-heading" aria-label="Actions" />
          </div>
        ) : null}

        {editorProperties.length === 0 ? (
          <div className="property-editor-empty">No properties yet.</div>
        ) : (
          editorProperties.map((property, index) => (
            <Fragment key={property.id}>
              <div
                className="property-editor-row"
                role="row"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedIndex !== null) {
                    reorderProperty(draggedIndex, index);
                    setDraggedIndex(null);
                  }
                }}
                onKeyDown={(event) => handlePropertyShortcut(event, index)}
              >
                <button
                  type="button"
                  className="property-editor-drag-handle"
                  draggable
                  tabIndex={-1}
                  aria-label="Drag to reorder property, or press Control Shift Arrow Up or Control Shift Arrow Down on this row"
                  onDragStart={(event) => {
                    setDraggedIndex(index);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(index));
                  }}
                  onDragEnd={() => setDraggedIndex(null)}
                >
                  ⋮⋮
                </button>

                <label className="property-editor-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={property.name}
                    placeholder="propertyName"
                    onChange={(event) => updateProperty(index, { ...property, name: event.target.value })}
                  />
                </label>

                <label className="property-editor-field">
                  <span>Type</span>
                  <select
                    value={property.type}
                    onChange={(event) => updatePropertyType(index, property, event.target.value as PropertyType)}
                  >
                    {propertyTypes.map((type) => (
                      <option value={type} key={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="property-editor-field">
                  <span>Example</span>
                  {property.type === 'Object' ? (
                    <div className="property-editor-example-hidden">{"{...}"}</div>
                  ) : property.list || disableExampleValues ? (
                    <div className="property-editor-example-hidden">{"[...]"}</div>
                  ) : (
                    <input
                      type="text"
                      value={property.example ?? ''}
                      placeholder="optional"
                      onChange={(event) => updateProperty(index, { ...property, example: event.target.value })}
                    />
                  )}
                </label>

                <div className="property-editor-row-actions">
                  {showPropertyToolbar ? (
                    <button
                      type="button"
                      className="property-editor-settings-button"
                      aria-label="Property settings"
                      aria-expanded={settingsIndex === index}
                      onClick={() => setSettingsIndex((currentIndex) => (currentIndex === index ? null : index))}
                    >
                      <svg aria-hidden="true" viewBox="0 0 512 512" className="property-editor-action-icon">
                        <path d="M495.9 166.6c3.2 8.7.5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4l-55.6 17.8c-8.8 2.8-18.6.3-24.5-6.8-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4l-43.3-39.4c-6.9-6.2-9.6-15.9-6.4-24.6 4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2 5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8 8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z" />
                      </svg>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="property-editor-remove-button"
                    onClick={(event) => {
                      const row = event.currentTarget.closest<HTMLElement>('.property-editor-row');
                      if (row) {
                        focusAfterRemovedRow(row, Math.max(getFocusableElements(row).indexOf(event.currentTarget), 0));
                      }
                      removeProperty(index);
                    }}
                    aria-label="Remove property"
                  >
                    <svg aria-hidden="true" viewBox="0 0 448 512" className="property-editor-action-icon">
                      <path d="M296 64l-16-32H168l-16 32h144zm-184 0l19.2-38.4C139.3 9.4 155.9 0 173.9 0h100.2c18 0 34.6 9.4 42.7 25.6L336 64h80c17.7 0 32 14.3 32 32s-14.3 32-32 32h-16v304c0 44.2-35.8 80-80 80H128c-44.2 0-80-35.8-80-80V128H32C14.3 128 0 113.7 0 96s14.3-32 32-32h80zm0 64v304c0 8.8 7.2 16 16 16h192c8.8 0 16-7.2 16-16V128H112zm48 64c8.8 0 16 7.2 16 16v160c0 8.8-7.2 16-16 16s-16-7.2-16-16V208c0-8.8 7.2-16 16-16zm64 0c8.8 0 16 7.2 16 16v160c0 8.8-7.2 16-16 16s-16-7.2-16-16V208c0-8.8 7.2-16 16-16zm64 0c8.8 0 16 7.2 16 16v160c0 8.8-7.2 16-16 16s-16-7.2-16-16V208c0-8.8 7.2-16 16-16z" />
                    </svg>
                  </button>
                </div>
              </div>

              {showPropertyToolbar && settingsIndex === index ? (
                <div className="property-editor-toolbar">
                  <label>
                    <input
                      type="checkbox"
                      checked={property.list ?? false}
                      onChange={(event) => updateListMode(index, property, event.target.checked)}
                    />
                    List
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={property.optional ?? false}
                      onChange={(event) => updateProperty(index, { ...property, optional: event.target.checked })}
                    />
                    Optional
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={property.generated ?? false}
                      onChange={(event) => updateProperty(index, { ...property, generated: event.target.checked })}
                    />
                    Generated
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(property.tag)}
                      onChange={(event) =>
                        updateProperty(index, { ...property, tag: event.target.checked ? { name: property.tag?.name ?? '' } : undefined })
                      }
                    />
                    Tag
                  </label>
                  <input
                    type="text"
                    className="property-editor-tag-name-input"
                    value={property.tag?.name ?? ''}
                    placeholder="tag name"
                    disabled={!property.tag}
                    aria-label="Tag name"
                    onChange={(event) => updateProperty(index, { ...property, tag: { name: event.target.value } })}
                  />
                </div>
              ) : null}

              {property.type === 'Object' ? (
                <div className="property-editor-nested">
                  <PropertyEditor
                    properties={property.properties ?? []}
                    onChange={(nestedProperties) => updateNestedProperties(index, nestedProperties)}
                    showPropertyToolbar={false}
                    showColumnHeaders={false}
                    disableExampleValues={property.list}
                  />
                </div>
              ) : null}

              {property.list ? (
                <div className="property-editor-list-editor">
                  {property.type === 'Object' ? (
                    <div className="property-editor-list-table-wrap">
                      <table className="property-editor-list-table">
                        <thead>
                          <tr>
                            <th aria-label="Reorder" />
                            {(property.properties ?? []).map((nestedProperty) => (
                              <th key={nestedProperty.id}>{nestedProperty.name || 'Unnamed'}</th>
                            ))}
                            <th aria-label="Actions" />
                          </tr>
                        </thead>
                        <tbody>
                          {(property.rows ?? []).map((objectValue, exampleIndex) => {
                            return (
                              <tr
                                key={exampleIndex}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  if (draggedExample?.propertyIndex === index) {
                                    reorderExampleValue(index, property, draggedExample.exampleIndex, exampleIndex);
                                    setDraggedExample(null);
                                  }
                                }}
                                onKeyDown={(event) => handleExampleShortcut(event, index, property, exampleIndex)}
                              >
                                <td className="property-editor-list-reorder-cell">
                                  <button
                                    type="button"
                                    className="property-editor-list-drag-handle"
                                    draggable
                                    tabIndex={-1}
                                    aria-label="Drag to reorder example value, or press Control Shift Arrow Up or Control Shift Arrow Down on this row"
                                    onDragStart={(event) => {
                                      setDraggedExample({ propertyIndex: index, exampleIndex });
                                      event.dataTransfer.effectAllowed = 'move';
                                      event.dataTransfer.setData('text/plain', String(exampleIndex));
                                    }}
                                    onDragEnd={() => setDraggedExample(null)}
                                  >
                                    ⋮⋮
                                  </button>
                                </td>
                                {(property.properties ?? []).map((nestedProperty) => {
                                  const fieldKey = nestedProperty.id ?? nestedProperty.name;
                                  const fieldValue = objectValue[fieldKey] ?? objectValue[nestedProperty.name] ?? '';

                                  return (
                                    <td key={fieldKey}>
                                      <input
                                        type="text"
                                        value={String(fieldValue)}
                                        aria-label={`${nestedProperty.name} example value`}
                                        onChange={(event) => updateObjectExampleValue(index, property, exampleIndex, fieldKey, event.target.value)}
                                      />
                                    </td>
                                  );
                                })}
                                <td>
                                  <div className="property-editor-row-actions">
                                    <button
                                      type="button"
                                      className="property-editor-list-remove-button"
                                      onClick={(event) => {
                                        const row = event.currentTarget.closest<HTMLElement>('tr');
                                        if (row) {
                                          focusAfterRemovedRow(row, Math.max(getFocusableElements(row).indexOf(event.currentTarget), 0));
                                        }
                                        removeExampleValue(index, property, exampleIndex);
                                      }}
                                      aria-label="Remove example value"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {(property.properties ?? []).length > 0 ? (
                            <tr className="property-editor-template-row" onKeyDown={(event) => handleTemplateShortcut(event)}>
                              <td className="property-editor-list-reorder-cell" aria-hidden="true" />
                              {(property.properties ?? []).map((nestedProperty) => {
                                const fieldKey = nestedProperty.id ?? nestedProperty.name;

                                return (
                                  <td key={fieldKey}>
                                    <input
                                      type="text"
                                      defaultValue=""
                                      placeholder="..."
                                      aria-label={`Add ${nestedProperty.name || 'property'} example value`}
                                      onBlur={(event) => addObjectExampleValueFromTemplateInput(index, property, fieldKey, event.currentTarget)}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && event.currentTarget.value.trim()) {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          addObjectExampleValueFromTemplateInput(index, property, fieldKey, event.currentTarget);
                                          refocusInput(event.currentTarget);
                                        }
                                      }}
                                    />
                                  </td>
                                );
                              })}
                              <td />
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="property-editor-list-values">
                      {(property.exampleValues ?? []).map((exampleValue, exampleIndex) => (
                        <div
                          className="property-editor-list-value-row"
                          key={exampleIndex}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (draggedExample?.propertyIndex === index) {
                              reorderExampleValue(index, property, draggedExample.exampleIndex, exampleIndex);
                              setDraggedExample(null);
                            }
                          }}
                          onKeyDown={(event) => handleExampleShortcut(event, index, property, exampleIndex)}
                        >
                          <div className="property-editor-list-reorder-cell">
                            <button
                              type="button"
                              className="property-editor-list-drag-handle"
                              draggable
                              tabIndex={-1}
                              aria-label="Drag to reorder example value, or press Control Shift Arrow Up or Control Shift Arrow Down on this row"
                              onDragStart={(event) => {
                                setDraggedExample({ propertyIndex: index, exampleIndex });
                                event.dataTransfer.effectAllowed = 'move';
                                event.dataTransfer.setData('text/plain', String(exampleIndex));
                              }}
                              onDragEnd={() => setDraggedExample(null)}
                            >
                              ⋮⋮
                            </button>
                          </div>
                          <input
                            type="text"
                            value={typeof exampleValue === 'string' ? exampleValue : ''}
                            placeholder="example value"
                            onChange={(event) => updatePrimitiveExampleValue(index, property, exampleIndex, event.target.value)}
                          />
                          <div className="property-editor-row-actions">
                            <button
                              type="button"
                              className="property-editor-list-remove-button"
                              onClick={(event) => {
                                const row = event.currentTarget.closest<HTMLElement>('.property-editor-list-value-row');
                                if (row) {
                                  focusAfterRemovedRow(row, Math.max(getFocusableElements(row).indexOf(event.currentTarget), 0));
                                }
                                removeExampleValue(index, property, exampleIndex);
                              }}
                              aria-label="Remove example value"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                      <div
                        className="property-editor-list-value-row property-editor-template-row"
                        onKeyDown={(event) => handleTemplateShortcut(event)}
                      >
                        <div className="property-editor-list-reorder-cell" aria-hidden="true" />
                        <input
                          type="text"
                          defaultValue=""
                          placeholder="Add example value"
                          aria-label="Add example value"
                          onBlur={(event) => addPrimitiveExampleValueFromTemplateInput(index, property, event.currentTarget)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && event.currentTarget.value.trim()) {
                              event.preventDefault();
                              event.stopPropagation();
                              addPrimitiveExampleValueFromTemplateInput(index, property, event.currentTarget);
                              refocusInput(event.currentTarget);
                            }
                          }}
                        />
                        <div className="property-editor-row-actions" aria-hidden="true" />
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </Fragment>
          ))
        )}
        <div
          className="property-editor-row property-editor-template-row"
          role="row"
          aria-label="Add property"
          onKeyDown={(event) => handleTemplateShortcut(event)}
        >
          <div className="property-editor-template-cell" aria-hidden="true" />

          <label className="property-editor-field">
            <span>Name</span>
            <input
              ref={templateNameInputRef}
              type="text"
              defaultValue=""
              placeholder="Add property"
              onBlur={(event) => addPropertyFromTemplateInput(event.currentTarget)}
              onKeyDown={(event) => {
                if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.metaKey && event.currentTarget.value.trim()) {
                  event.preventDefault();
                  event.stopPropagation();
                  if (addPropertyFromTemplateInput(event.currentTarget)) {
                    focusAddedPropertyTypeCell(event.currentTarget);
                  }
                  return;
                }

                if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && event.currentTarget.value.trim()) {
                  event.preventDefault();
                  event.stopPropagation();
                  addPropertyFromTemplateInput(event.currentTarget);
                  refocusInput(event.currentTarget);
                }
              }}
            />
          </label>

          <label className="property-editor-field">
            <span>Type</span>
            <select
              value={templatePropertyType}
              aria-label="Add property type"
              onChange={(event) => {
                setTemplatePropertyType(event.target.value as PropertyType);
                templateNameInputRef.current?.focus();
              }}
            >
              {propertyTypes.map((type) => (
                <option value={type} key={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="property-editor-field">
            <span>Example</span>
            <input
              type="text"
              value=""
              readOnly
              tabIndex={-1}
              aria-label="Example is available after adding the property"
            />
          </label>

          <div className="property-editor-row-actions" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
