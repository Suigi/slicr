import { PropertyEditorInternal, type EditableProperty } from '../PropertyEditor/PropertyEditor';

export type ExampleValueEditorProps = {
  properties: EditableProperty[];
  onChange: (properties: EditableProperty[]) => void;
};

function normalizeExampleValueProperty(property: EditableProperty): EditableProperty {
  if (property.type === 'Object') {
    return {
      ...property,
      example: undefined,
      exampleValues: undefined,
      properties: (property.properties ?? []).map(normalizeExampleValueProperty),
      rows: property.list ? property.rows : undefined,
    };
  }

  return {
    ...property,
    properties: undefined,
    rows: undefined,
    exampleValues: property.list ? property.exampleValues : undefined,
  };
}

export function ExampleValueEditor({ properties, onChange }: ExampleValueEditorProps) {
  return (
    <PropertyEditorInternal
      properties={properties.map(normalizeExampleValueProperty)}
      onChange={(nextProperties) => onChange(nextProperties.map(normalizeExampleValueProperty))}
      options={{
        showPropertyToolbar: false,
        showExtendedPropertyToolbarControls: false,
        showColumnHeaders: true,
        disableExampleValues: false,
        schemaOnly: false,
        valueOnly: true,
      }}
    />
  );
}
