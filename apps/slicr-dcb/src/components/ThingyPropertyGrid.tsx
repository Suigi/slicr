import { Fragment, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

type ThingyPropertyGridTable = {
  name: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
};

type ThingyPropertyGridProps = {
  properties: readonly string[];
  tables: readonly ThingyPropertyGridTable[];
};

const DEBUG_TABLE_DRAG = true;

function DraggableTableScroller({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ pointerId: 0, clientX: 0, scrollLeft: 0 });
  const [isDragging, setIsDragging] = useState(false);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const scroller = scrollerRef.current;

    event.stopPropagation();

    if (DEBUG_TABLE_DRAG) {
      console.log('[table-drag] pointerdown', {
        button: event.button,
        pointerId: event.pointerId,
        clientX: event.clientX,
        target: event.target instanceof Element ? event.target.tagName : event.target,
        hasScroller: Boolean(scroller),
        clientWidth: scroller?.clientWidth,
        scrollWidth: scroller?.scrollWidth,
        scrollLeft: scroller?.scrollLeft,
      });
    }

    if (event.button !== 0 || !scroller || scroller.scrollWidth <= scroller.clientWidth) {
      if (DEBUG_TABLE_DRAG) {
        console.log('[table-drag] not starting drag', {
          reason: event.button !== 0 ? 'not-left-button' : !scroller ? 'missing-scroller' : 'no-horizontal-overflow',
        });
      }
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

    if (DEBUG_TABLE_DRAG) {
      console.log('[table-drag] started', dragStartRef.current);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const scroller = scrollerRef.current;

    event.stopPropagation();

    if (!isDraggingRef.current || !scroller || event.pointerId !== dragStartRef.current.pointerId) {
      if (DEBUG_TABLE_DRAG && isDraggingRef.current) {
        console.log('[table-drag] ignoring move', {
          pointerId: event.pointerId,
          expectedPointerId: dragStartRef.current.pointerId,
          hasScroller: Boolean(scroller),
        });
      }
      return;
    }

    event.preventDefault();
    const nextScrollLeft = dragStartRef.current.scrollLeft - (event.clientX - dragStartRef.current.clientX);
    scroller.scrollLeft = nextScrollLeft;

    if (DEBUG_TABLE_DRAG) {
      console.log('[table-drag] move', {
        clientX: event.clientX,
        nextScrollLeft,
        actualScrollLeft: scroller.scrollLeft,
      });
    }
  }

  function stopDragging(event: ReactPointerEvent<HTMLDivElement>) {
    const scroller = scrollerRef.current;

    event.stopPropagation();

    if (scroller?.hasPointerCapture(event.pointerId)) {
      scroller.releasePointerCapture(event.pointerId);
    }

    if (DEBUG_TABLE_DRAG && isDraggingRef.current) {
      console.log('[table-drag] stopped', {
        pointerId: event.pointerId,
        scrollLeft: scroller?.scrollLeft,
      });
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

export function ThingyPropertyGrid({ properties, tables }: ThingyPropertyGridProps) {
  return (
    <div className="mockup-property-panel">
      <table className="mockup-property-grid">
        <tbody>
          {properties.map((property) => (
            <tr key={property} className="mockup-property-row">
              <th scope="row" className="mockup-property-name">
                {property}
              </th>
              <td className="mockup-field-separator">:</td>
              <td className="mockup-field-type">string</td>
            </tr>
          ))}
          {tables.map((table) => (
            <Fragment key={table.name}>
              <tr className="mockup-property-row mockup-table-property-row">
                <th scope="row" className="mockup-property-name">
                  {table.name}
                </th>
                <td className="mockup-field-separator">:</td>
                <td className="mockup-field-type">Table</td>
              </tr>
              <tr className="mockup-table-content-row">
                <td colSpan={3}>
                  <DraggableTableScroller>
                    <table
                      className="mockup-table mockup-thingies-table"
                      style={{ '--mockup-table-column-count': table.columns.length } as CSSProperties}
                      aria-label={`${table.name} property`}
                    >
                      <thead>
                        <tr className="mockup-table-row mockup-table-header">
                          {table.columns.map((column) => (
                            <th key={column} scope="col">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((row) => (
                          <tr key={row.join(':')} className="mockup-table-row">
                            {row.map((cell, index) => (
                              <td key={`${table.name}-${table.columns[index] ?? index}-${cell}`}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </DraggableTableScroller>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
