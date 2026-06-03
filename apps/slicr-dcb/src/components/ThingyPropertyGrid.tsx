type ThingyPropertyGridTable = {
  name: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
};

type ThingyPropertyGridProps = {
  properties: readonly string[];
  tables: readonly ThingyPropertyGridTable[];
};

export function ThingyPropertyGrid({ properties, tables }: ThingyPropertyGridProps) {
  return (
    <div className="mockup-property-panel">
      <div className="mockup-properties mockup-standalone-properties">
        {properties.map((property) => (
          <span key={property} className="mockup-field">
            {property}
            <span className="mockup-field-separator">: </span>
            <span className="mockup-field-type">string</span>
          </span>
        ))}
      </div>
      {tables.map((table) => (
        <div key={table.name} className="mockup-table-property">
          <div className="mockup-field">
            {table.name}<span className="mockup-field-separator">: </span>
            <span className="mockup-field-type">Table</span>
          </div>
          <div className="mockup-table mockup-thingies-table" role="table" aria-label={`${table.name} property`}>
            <div className="mockup-table-row mockup-table-header" role="row">
              {table.columns.map((column) => (
                <span key={column} role="columnheader">
                  {column}
                </span>
              ))}
            </div>
            {table.rows.map((row) => (
              <div key={row.join(':')} className="mockup-table-row" role="row">
                {row.map((cell, index) => (
                  <span key={`${table.name}-${table.columns[index] ?? index}-${cell}`} role="cell">
                    {cell}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
