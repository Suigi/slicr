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
  id?: string;
  kind?: 'scalar';
  type: string;
  value?: PropertyGridPrimitiveValue;
};

export type PropertyGridObjectProperty = {
  id?: string;
  kind: 'object';
  type?: string;
  properties: PropertyGridProperties;
};

export type PropertyGridTableProperty = {
  id?: string;
  kind: 'table';
  type?: string;
  columns: readonly PropertyGridTableColumn[];
  rows: readonly PropertyGridTableRow[];
};

export type PropertyGridTableColumn = {
  id?: string;
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
                id: nestedProperty.id,
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
                id: property.id,
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
              id: property.id,
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
              id: property.id,
              kind: 'table',
              type: `${property.type}[]`,
              columns: [{ id: property.id, key: 'value', label: property.name, type: property.type }],
              rows: rowsFor(property),
            },
          ];
        }

        const scalarProperty: PropertyGridScalarProperty = { id: property.id, type: property.type };
        if (hasScalarExample(property)) {
          scalarProperty.value = property.example;
        }

        return [property.name, scalarProperty];
      }),
  );
}

export type PropertyGridElement = HTMLElement & {
  properties: PropertyGridProperties;
  focusedPropertyId: string | null;
};

export type PropertyGridHoveredPropertyChangeEvent = CustomEvent<{ propertyId: string | null }>;

type PropertyGridCustomElementProps = Omit<HTMLAttributes<PropertyGridElement>, 'children'> & {
  properties?: PropertyGridProperties;
  focusedPropertyId?: string | null;
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
  focusedPropertyId?: string | null;
  onHoveredPropertyChange?: (propertyId: string | null) => void;
};

export function PropertyGrid({ properties, ariaLabel = 'Properties', focusedPropertyId = null, onHoveredPropertyChange, ...elementProps }: PropertyGridProps) {
  const elementRef = useRef<PropertyGridElement>(null);
  const normalizedProperties = useMemo(() => toPropertyGridProperties(properties), [properties]);

  useLayoutEffect(() => {
    if (elementRef.current) {
      elementRef.current.properties = normalizedProperties;
    }
  }, [normalizedProperties]);

  useLayoutEffect(() => {
    if (elementRef.current) {
      elementRef.current.focusedPropertyId = focusedPropertyId;
    }
  }, [focusedPropertyId]);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element || !onHoveredPropertyChange) {
      return;
    }

    const handleHoveredPropertyChange = (event: Event) => {
      onHoveredPropertyChange((event as PropertyGridHoveredPropertyChangeEvent).detail.propertyId);
    };

    element.addEventListener('property-grid-hovered-property-change', handleHoveredPropertyChange);
    return () => element.removeEventListener('property-grid-hovered-property-change', handleHoveredPropertyChange);
  }, [onHoveredPropertyChange]);

  return <property-grid {...elementProps} ref={elementRef} aria-label={ariaLabel} />;
}
