import { PropertyEditorInternal, type EditableProperty } from '../PropertyEditor/PropertyEditor';

type SchemaEditorProps = {
  properties: EditableProperty[];
  onChange: (properties: EditableProperty[]) => void;
  showPropertyToolbar?: boolean;
  showExtendedPropertyToolbarControls?: boolean;
  showColumnHeaders?: boolean;
  focusedPropertyId?: string | null;
  onFocusedPropertyChange?: (propertyId: string | null) => void;
};

export function SchemaEditor({
  properties,
  onChange,
  showPropertyToolbar,
  showExtendedPropertyToolbarControls,
  showColumnHeaders,
  focusedPropertyId,
  onFocusedPropertyChange,
}: SchemaEditorProps) {
  return (
    <PropertyEditorInternal
      properties={properties}
      onChange={onChange}
      focusedPropertyId={focusedPropertyId}
      onFocusedPropertyChange={onFocusedPropertyChange}
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
