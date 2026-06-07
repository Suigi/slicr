import {useMemo} from 'react';
import {ExampleValueEditor, SchemaEditor, type EditableProperty} from '@slicr/react-ui';
import {
  deriveNodePropertyExampleValues,
  deriveNodePropertySchema,
  mergeNodePropertyEditorProperties,
} from '../graph/propertyEventMapping';

type NodeEditorProps = {
  properties: EditableProperty[];
  onChange: (properties: EditableProperty[]) => void;
  focusedPropertyId?: string;
};

export function NodeEditor({properties, onChange}: NodeEditorProps) {
  const schema = useMemo(() => deriveNodePropertySchema(properties), [properties]);
  const exampleValues = useMemo(() => deriveNodePropertyExampleValues(properties), [properties]);
  const schemaEditorProperties = useMemo(() => mergeNodePropertyEditorProperties(schema, []), [schema]);
  const exampleEditorProperties = useMemo(
    () => mergeNodePropertyEditorProperties(schema, exampleValues),
    [exampleValues, schema],
  );

  return (
    <div className="node-editor">
      <section className="node-editor-schema" aria-labelledby="node-editor-schema-heading">
        <SchemaEditor
          properties={schemaEditorProperties}
          onChange={(nextProperties) => {
            onChange(mergeNodePropertyEditorProperties(deriveNodePropertySchema(nextProperties), exampleValues));
          }}
        />
      </section>
      <section className="node-editor-example" aria-labelledby="node-editor-example-heading">
        <h4 id="node-editor-example-heading" className="node-editor-example-heading">
          Example values
        </h4>
        <ExampleValueEditor
          properties={exampleEditorProperties}
          onChange={(nextProperties) => {
            onChange(mergeNodePropertyEditorProperties(schema, deriveNodePropertyExampleValues(nextProperties)));
          }}
        />
      </section>
    </div>
  );
}

export type {NodeEditorProps};
