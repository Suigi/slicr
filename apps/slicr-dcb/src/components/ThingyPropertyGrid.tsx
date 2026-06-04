import { Fragment } from 'react';

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
                  <table className="mockup-table mockup-thingies-table" aria-label={`${table.name} property`}>
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
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
