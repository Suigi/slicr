import { useEffect, useRef, type HTMLAttributes } from 'react';

import '../property-grid/property-grid.js';

export type PropertyGridPrimitiveValue = string | number | boolean | null | undefined;

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
  properties: PropertyGridProperties;
  ariaLabel?: string;
};

export function PropertyGrid({ properties, ariaLabel = 'Properties', ...elementProps }: PropertyGridProps) {
  const elementRef = useRef<PropertyGridElement>(null);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.properties = properties;
    }
  }, [properties]);

  return <property-grid {...elementProps} ref={elementRef} aria-label={ariaLabel} />;
}
