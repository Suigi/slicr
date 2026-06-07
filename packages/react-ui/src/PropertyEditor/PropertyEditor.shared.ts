import type { PropertyGridEditableProperty, PropertyGridTableRow } from '../PropertyGrid';

export const propertyTypes = ['string', 'number', 'boolean', 'Object'] as const;

export type PropertyType = (typeof propertyTypes)[number];

export type PropertyExampleValue = string | PropertyGridTableRow;

export type EditableProperty = Omit<PropertyGridEditableProperty, 'type' | 'value' | 'properties' | 'exampleValues' | 'rows'> & {
  type: PropertyType;
  properties?: EditableProperty[];
  exampleValues?: PropertyExampleValue[];
  rows?: PropertyGridTableRow[];
};

export type PropertyEditorOptions = {
  showPropertyToolbar: boolean;
  showExtendedPropertyToolbarControls: boolean;
  showColumnHeaders: boolean;
  disableExampleValues: boolean;
  schemaOnly: boolean;
  valueOnly: boolean;
};

export function createNestedPropertyEditorOptions(
  options: PropertyEditorOptions,
  property: Pick<EditableProperty, 'list'>,
): PropertyEditorOptions {
  return {
    ...options,
    showExtendedPropertyToolbarControls: false,
    showColumnHeaders: false,
    disableExampleValues: Boolean(property.list),
  };
}
