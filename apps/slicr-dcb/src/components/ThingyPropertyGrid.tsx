import { Fragment, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

type ThingyPrimitiveValue = string | number | boolean | null | undefined;

type ThingyProperty = ThingyScalarProperty | ThingyObjectProperty | ThingyTableProperty;

type ThingyScalarProperty = {
  kind?: 'scalar';
  type: string;
  value?: ThingyPrimitiveValue;
};

type ThingyObjectProperty = {
  kind: 'object';
  type?: string;
  properties: ThingyProperties;
};

type ThingyTableProperty = {
  kind: 'table';
  type?: string;
  columns: readonly ThingyTableColumn[];
  rows: readonly ThingyTableRow[];
};

type ThingyTableColumn = {
  key: string;
  label?: string;
  type?: string;
};

type ThingyTableRow = Record<string, ThingyPrimitiveValue>;

type ThingyProperties = Record<string, ThingyProperty>;

type ThingyPropertyGridProps = {
  properties: ThingyProperties;
};

function DraggableTableScroller({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ pointerId: 0, clientX: 0, scrollLeft: 0 });
  const [isDragging, setIsDragging] = useState(false);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const scroller = scrollerRef.current;

    event.stopPropagation();

    if (event.button !== 0 || !scroller || scroller.scrollWidth <= scroller.clientWidth) {
      return;
    }

    event.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      scrollLeft: scroller.scrollLeft,
    };
    scroller.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const scroller = scrollerRef.current;

    event.stopPropagation();

    if (!isDraggingRef.current || !scroller || event.pointerId !== dragStartRef.current.pointerId) {
      return;
    }

    event.preventDefault();
    const nextScrollLeft = dragStartRef.current.scrollLeft - (event.clientX - dragStartRef.current.clientX);
    scroller.scrollLeft = nextScrollLeft;
  }

  function stopDragging(event: ReactPointerEvent<HTMLDivElement>) {
    const scroller = scrollerRef.current;

    event.stopPropagation();

    if (scroller?.hasPointerCapture(event.pointerId)) {
      scroller.releasePointerCapture(event.pointerId);
    }

    isDraggingRef.current = false;
    setIsDragging(false);
  }

  return (
    <div
      ref={scrollerRef}
      className={`mockup-table-scroll${isDragging ? ' is-dragging' : ''}`}
      onPointerDownCapture={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onPointerLeave={stopDragging}
    >
      {children}
    </div>
  );
}

function formatPropertyValue(value: unknown) {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'object') {
    return 'Object';
  }

  return String(value);
}

function renderPropertyRows(properties: ThingyProperties, rowClassName = 'mockup-property-row'): ReactNode {
  return Object.entries(properties).map(([propertyName, property]) => {
    if (property.kind === 'object') {
      return (
        <Fragment key={propertyName}>
          <tr className={rowClassName}>
            <th scope="row" className="mockup-property-name">
              {propertyName}
            </th>
            <td className="mockup-field-separator">:</td>
            <td className="mockup-field-type">{property.type ?? 'Object'}</td>
          </tr>
          <tr className="mockup-table-content-row mockup-complex-property-content-row">
            <td colSpan={3}>
              <div className="mockup-nested-property-grid-wrapper">
                <table className="mockup-property-grid mockup-nested-property-grid" aria-label={`${propertyName} properties`}>
                  <tbody>{renderPropertyRows(property.properties, 'mockup-property-row mockup-nested-property-row')}</tbody>
                </table>
              </div>
            </td>
          </tr>
        </Fragment>
      );
    }

    if (property.kind === 'table') {
      return (
        <Fragment key={propertyName}>
          <tr className="mockup-property-row mockup-table-property-row">
            <th scope="row" className="mockup-property-name">
              {propertyName}
            </th>
            <td className="mockup-field-separator">:</td>
            <td className="mockup-field-type">{property.type ?? 'Table'}</td>
          </tr>
          <tr className="mockup-table-content-row">
            <td colSpan={3}>
              <DraggableTableScroller>
                <table
                  className="mockup-table mockup-thingies-table"
                  style={{ '--mockup-table-column-count': property.columns.length } as CSSProperties}
                  aria-label={`${propertyName} property`}
                >
                  <thead>
                    <tr className="mockup-table-row mockup-table-header">
                      {property.columns.map((column) => (
                        <th key={column.key} scope="col">
                          {column.label ?? column.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {property.rows.map((row, rowIndex) => (
                      <tr key={`${propertyName}-${rowIndex}`} className="mockup-table-row">
                        {property.columns.map((column) => (
                          <td key={`${propertyName}-${rowIndex}-${column.key}`}>{formatPropertyValue(row[column.key])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DraggableTableScroller>
            </td>
          </tr>
        </Fragment>
      );
    }

    const hasValue = 'value' in property;

    return (
      <tr key={propertyName} className={rowClassName}>
        <th scope="row" className="mockup-property-name">
          {propertyName}
        </th>
        {hasValue ? (
          <td colSpan={2} className="mockup-field-value">
            {formatPropertyValue(property.value)}
          </td>
        ) : (
          <>
            <td className="mockup-field-separator">:</td>
            <td className="mockup-field-type">{property.type}</td>
          </>
        )}
      </tr>
    );
  });
}

export function ThingyPropertyGrid({ properties }: ThingyPropertyGridProps) {
  return (
    <div className="mockup-property-panel">
      <table className="mockup-property-grid">
        <tbody>{renderPropertyRows(properties)}</tbody>
      </table>
    </div>
  );
}
