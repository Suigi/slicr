import { PropertyEditorInternal, type EditableProperty } from '../PropertyEditor/PropertyEditor';

type SchemaEditorProps = {
  properties: EditableProperty[];
  onChange: (properties: EditableProperty[]) => void;
  showPropertyToolbar?: boolean;
  showExtendedPropertyToolbarControls?: boolean;
  showColumnHeaders?: boolean;
};

export function SchemaEditor({
  properties,
  onChange,
  showPropertyToolbar,
  showExtendedPropertyToolbarControls,
  showColumnHeaders,
}: SchemaEditorProps) {
  return (
    <PropertyEditorInternal
      properties={properties}
      onChange={onChange}
      options={{
        showPropertyToolbar: showPropertyToolbar ?? true,
        showExtendedPropertyToolbarControls: showExtendedPropertyToolbarControls ?? true,
        showColumnHeaders: showColumnHeaders ?? true,
        disableExampleValues: true,
        schemaOnly: true,
        valueOnly: false,
      }}
    />
  );
}

export type { SchemaEditorProps };
