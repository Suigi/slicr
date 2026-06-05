import { Fragment, useState } from 'react';
import './PropertyEditor.css';

export const propertyTypes = ['string', 'number', 'boolean', 'Object'] as const;

export type PropertyType = (typeof propertyTypes)[number];

export type PropertyExampleValue = string | Record<string, string>;

export type EditableProperty = {
  name: string;
  type: PropertyType;
  example?: string;
  properties?: EditableProperty[];
  list?: boolean;
  exampleValues?: PropertyExampleValue[];
  optional?: boolean;
  generated?: boolean;
  tag?: {
    name: string;
  };
};

type PropertyEditorProps = {
  properties: EditableProperty[];
  onChange: (properties: EditableProperty[]) => void;
  showPropertyToolbar?: boolean;
  showColumnHeaders?: boolean;
  disableExampleValues?: boolean;
};

const emptyProperty = (): EditableProperty => ({
  name: '',
  type: 'string',
  example: '',
});

export function PropertyEditor({
  properties,
  onChange,
  showPropertyToolbar = true,
  showColumnHeaders = true,
  disableExampleValues = false,
}: PropertyEditorProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedExample, setDraggedExample] = useState<{ propertyIndex: number; exampleIndex: number } | null>(null);
  const [settingsIndex, setSettingsIndex] = useState<number | null>(null);

  const updateProperty = (index: number, property: EditableProperty) => {
    onChange(properties.map((currentProperty, currentIndex) => (currentIndex === index ? property : currentProperty)));
  };

  const removeProperty = (index: number) => {
    onChange(properties.filter((_, currentIndex) => currentIndex !== index));
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
    const property = properties[index];

    if (!property) {
      return;
    }

    updateProperty(index, { ...property, properties: nestedProperties });
  };

  const getInitialExampleValues = (property: EditableProperty): PropertyExampleValue[] => {
    if (property.exampleValues) {
      return property.exampleValues;
    }

    if (property.type === 'Object') {
      if ((property.properties ?? []).length > 0) {
        return [Object.fromEntries((property.properties ?? []).map((nestedProperty) => [nestedProperty.name, nestedProperty.example ?? '']))];
      }

      return [];
    }

    if (!property.example) {
      return [];
    }

    return [property.example];
  };

  const updateListMode = (index: number, property: EditableProperty, list: boolean) => {
    updateProperty(index, {
      ...property,
      list,
      exampleValues: list ? getInitialExampleValues(property) : undefined,
    });
  };

  const addExampleValue = (index: number, property: EditableProperty) => {
    updateProperty(index, {
      ...property,
      exampleValues: [...(property.exampleValues ?? []), property.type === 'Object' ? {} : ''],
    });
  };

  const removeExampleValue = (propertyIndex: number, property: EditableProperty, exampleIndex: number) => {
    updateProperty(propertyIndex, {
      ...property,
      exampleValues: (property.exampleValues ?? []).filter((_, currentIndex) => currentIndex !== exampleIndex),
    });
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

    const exampleValues = [...(property.exampleValues ?? [])];

    if (fromIndex < 0 || fromIndex >= exampleValues.length || toIndex < 0 || toIndex >= exampleValues.length) {
      return;
    }

    const [exampleValue] = exampleValues.splice(fromIndex, 1);
    exampleValues.splice(toIndex, 0, exampleValue);
    updateProperty(propertyIndex, { ...property, exampleValues });
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
    fieldName: string,
    value: string,
  ) => {
    updateProperty(propertyIndex, {
      ...property,
      exampleValues: (property.exampleValues ?? []).map((exampleValue, currentIndex) => {
        if (currentIndex !== exampleIndex || typeof exampleValue === 'string') {
          return exampleValue;
        }

        return { ...exampleValue, [fieldName]: value };
      }),
    });
  };

  const reorderProperty = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return;
    }

    const reorderedProperties = [...properties];
    const [property] = reorderedProperties.splice(fromIndex, 1);
    reorderedProperties.splice(toIndex, 0, property);
    onChange(reorderedProperties);
    setSettingsIndex((currentIndex) => (currentIndex === fromIndex ? toIndex : currentIndex));
  };

  return (
    <div className="property-editor">
      <div className="property-editor-grid" role="table" aria-label="Object schema properties">
        {showColumnHeaders ? (
          <div className="property-editor-grid-heading" role="row">
            <span role="columnheader" aria-label="Reorder" />
            <span role="columnheader">Name</span>
            <span role="columnheader">Type</span>
            <span role="columnheader">Example</span>
            <span role="columnheader" className="property-editor-actions-heading">
              Actions
            </span>
          </div>
        ) : null}

        {properties.length === 0 ? (
          <div className="property-editor-empty">No properties yet.</div>
        ) : (
          properties.map((property, index) => (
            <Fragment key={`${index}-${property.name}`}>
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
              >
                <button
                  type="button"
                  className="property-editor-drag-handle"
                  draggable
                  aria-label="Drag to reorder property"
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
                    <div className="property-editor-example-hidden">Defined by nested properties</div>
                  ) : property.list || disableExampleValues ? (
                    <div className="property-editor-example-hidden">List examples below</div>
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
                  <button type="button" className="property-editor-remove-button" onClick={() => removeProperty(index)} aria-label="Remove property">
                    <svg aria-hidden="true" viewBox="0 0 448 512" className="property-editor-action-icon">
                      <path d="M135.2 17.7 128 32H32C14.3 32 0 46.3 0 64s14.3 32 32 32h384c17.7 0 32-14.3 32-32s-14.3-32-32-32h-96l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32l21.2 339c1.6 25.3 22.6 45 48 45h245.6c25.4 0 46.4-19.7 48-45L416 128z" />
                    </svg>
                  </button>
                </div>
              </div>

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
                              <th key={nestedProperty.name}>{nestedProperty.name || 'Unnamed'}</th>
                            ))}
                            <th aria-label="Actions" />
                          </tr>
                        </thead>
                        <tbody>
                          {(property.exampleValues ?? []).map((exampleValue, exampleIndex) => {
                            const objectValue = typeof exampleValue === 'string' ? {} : exampleValue;

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
                              >
                                <td className="property-editor-list-reorder-cell">
                                  <button
                                    type="button"
                                    className="property-editor-list-drag-handle"
                                    draggable
                                    aria-label="Drag to reorder example value"
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
                                {(property.properties ?? []).map((nestedProperty) => (
                                  <td key={nestedProperty.name}>
                                    <input
                                      type="text"
                                      value={objectValue[nestedProperty.name] ?? ''}
                                      aria-label={`${nestedProperty.name} example value`}
                                      onChange={(event) =>
                                        updateObjectExampleValue(index, property, exampleIndex, nestedProperty.name, event.target.value)
                                      }
                                    />
                                  </td>
                                ))}
                                <td>
                                  <button
                                    type="button"
                                    className="property-editor-list-remove-button"
                                    onClick={() => removeExampleValue(index, property, exampleIndex)}
                                    aria-label="Remove example value"
                                  >
                                    ×
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
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
                        >
                          <div className="property-editor-list-reorder-cell">
                            <button
                              type="button"
                              className="property-editor-list-drag-handle"
                              draggable
                              aria-label="Drag to reorder example value"
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
                          <button
                            type="button"
                            className="property-editor-list-remove-button"
                            onClick={() => removeExampleValue(index, property, exampleIndex)}
                            aria-label="Remove example value"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" className="property-editor-list-add-button" onClick={() => addExampleValue(index, property)}>
                    + Add example value
                  </button>
                </div>
              ) : null}

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
            </Fragment>
          ))
        )}
        <div className="property-editor-add-row">
          <button type="button" className="property-editor-add-button" onClick={() => onChange([...properties, emptyProperty()])}>
            + Add property
          </button>
        </div>
      </div>
    </div>
  );
}
