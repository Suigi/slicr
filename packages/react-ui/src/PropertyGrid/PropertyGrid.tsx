import { useLayoutEffect, useMemo, useRef, type HTMLAttributes } from 'react';

import '../property-grid/property-grid.js';

export type PropertyGridPrimitiveValue = string | number | boolean | null | undefined;

export type PropertyGridEditableProperty = {
  id: string;
  name: string;
  kind?: 'scalar' | 'object';
  type: string;
  value?: PropertyGridPrimitiveValue;
  example?: string;
  list?: boolean;
  properties?: readonly PropertyGridEditableProperty[];
  rows?: readonly PropertyGridTableRow[];
  exampleValues?: readonly (string | PropertyGridTableRow)[];
  optional?: boolean;
  generated?: boolean;
  tag?: { name: string };
};

export type PropertyGridProperty = PropertyGridScalarProperty | PropertyGridObjectProperty | PropertyGridTableProperty;

export type PropertyGridScalarProperty = {
  kind?: 'scalar';
  type: string;
  value?: PropertyGridPrimitiveValue;
};

export type PropertyGridObjectProperty = {
  kind: 'object';
  type?: string;
  properties: PropertyGridProperties;
};

export type PropertyGridTableProperty = {
  kind: 'table';
  type?: string;
  columns: readonly PropertyGridTableColumn[];
  rows: readonly PropertyGridTableRow[];
};

export type PropertyGridTableColumn = {
  key: string;
  label?: string;
  type?: string;
};

export type PropertyGridTableRow = Record<string, PropertyGridPrimitiveValue>;

export type PropertyGridProperties = Record<string, PropertyGridProperty>;

export type PropertyGridInputProperties = PropertyGridProperties | readonly PropertyGridEditableProperty[];

const isEditablePropertyList = (properties: PropertyGridInputProperties): properties is readonly PropertyGridEditableProperty[] =>
  Array.isArray(properties);

const isObjectProperty = (property: PropertyGridEditableProperty) =>
  property.kind === 'object' || property.type === 'Object' || property.properties !== undefined;

const hasScalarExample = (property: PropertyGridEditableProperty) => property.example !== undefined && property.example !== '';

const rowsFor = (property: PropertyGridEditableProperty): readonly PropertyGridTableRow[] => {
  if (property.rows) {
    return property.rows;
  }

  return (property.exampleValues ?? []).map((exampleValue) => (typeof exampleValue === 'string' ? { value: exampleValue } : exampleValue));
};

export function toPropertyGridProperties(properties: PropertyGridInputProperties): PropertyGridProperties {
  if (!isEditablePropertyList(properties)) {
    return properties;
  }

  return Object.fromEntries(
    properties
      .filter((property) => property.name.trim())
      .map((property) => {
        if (isObjectProperty(property)) {
          if (property.list) {
            const nestedProperties = property.properties ?? [];
            const columns = nestedProperties
              .filter((nestedProperty) => nestedProperty.name.trim())
              .map((nestedProperty) => ({
                key: nestedProperty.id ?? nestedProperty.name,
                label: nestedProperty.name,
                type: nestedProperty.type,
              }));
            const rows = rowsFor(property).map((row) =>
              Object.fromEntries(
                nestedProperties.map((nestedProperty) => {
                  const key = nestedProperty.id ?? nestedProperty.name;
                  return [key, row[key] ?? row[nestedProperty.name]];
                }),
              ),
            );

            return [
              property.name,
              {
                kind: 'table',
                type: property.type === 'Object' ? 'Object[]' : `${property.type}[]`,
                columns,
                rows,
              },
            ];
          }

          return [
            property.name,
            {
              kind: 'object',
              type: property.type,
              properties: toPropertyGridProperties(property.properties ?? []),
            },
          ];
        }

        if (property.list) {
          return [
            property.name,
            {
              kind: 'table',
              type: `${property.type}[]`,
              columns: [{ key: 'value', label: property.name, type: property.type }],
              rows: rowsFor(property),
            },
          ];
        }

        const scalarProperty: PropertyGridScalarProperty = { type: property.type };
        if (hasScalarExample(property)) {
          scalarProperty.value = property.example;
        }

        return [property.name, scalarProperty];
      }),
  );
}

export type PropertyGridElement = HTMLElement & {
  properties: PropertyGridProperties;
};

type PropertyGridCustomElementProps = Omit<HTMLAttributes<PropertyGridElement>, 'children'> & {
  properties?: PropertyGridProperties;
  'aria-label'?: string;
  ref?: React.Ref<PropertyGridElement>;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'property-grid': PropertyGridCustomElementProps;
    }
  }
}

export type PropertyGridProps = Omit<HTMLAttributes<PropertyGridElement>, 'children'> & {
  properties: PropertyGridInputProperties;
  ariaLabel?: string;
};

export function PropertyGrid({ properties, ariaLabel = 'Properties', ...elementProps }: PropertyGridProps) {
  const elementRef = useRef<PropertyGridElement>(null);
  const normalizedProperties = useMemo(() => toPropertyGridProperties(properties), [properties]);

  useLayoutEffect(() => {
    if (elementRef.current) {
      elementRef.current.properties = normalizedProperties;
    }
  }, [normalizedProperties]);

  return <property-grid {...elementProps} ref={elementRef} aria-label={ariaLabel} />;
}
