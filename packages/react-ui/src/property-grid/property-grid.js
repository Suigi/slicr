// property-grid.js

function formatPropertyValue(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "object") return "Object";
  return String(value);
}

class PropertyGrid extends HTMLElement {
  static observedAttributes = ["aria-label"];

  #shadow;
  #properties = {};
  #dragState = null;

  constructor() {
    super();

    this.#shadow = this.attachShadow({ mode: "open" });
    this.#shadow.innerHTML = `
      <style>
        :host {
          --property-grid-panel-bg: rgba(255, 255, 255, 0.35);
          --property-grid-row-bg: rgba(255, 255, 255, 0.55);
          --property-grid-line: rgba(100, 116, 139, 0.25);
          --property-grid-text: #172033;
          --property-grid-muted-text: #64748b;
          --property-grid-value-text: var(--property-grid-text);
          --property-grid-table-header-bg: rgba(255, 255, 255, 0.45);
          --property-grid-table-header-text: var(--property-grid-muted-text);
          --property-grid-scrollbar-thumb: rgba(100, 116, 139, 0.35);
          --property-grid-scrollbar-thumb-hover: rgba(100, 116, 139, 0.55);

          display: block;
          color: var(--property-grid-text);
          font: inherit;
        }

        .property-panel {
          overflow: hidden;
          margin: 10px;
          border: 1px solid var(--property-grid-line);
          border-radius: 10px;
          background: var(--property-grid-panel-bg);
        }

        .property-grid {
          width: 100%;
          table-layout: auto;
          border-collapse: collapse;
          color: var(--property-grid-text);
          font-size: 12px;
        }

        .table-content-row,
        .property-row {
          background: var(--property-grid-row-bg);
        }

        .table-content-row:not(:last-child),
        .property-row:not(:last-child) {
          border-bottom: 1px solid var(--property-grid-line);
        }

        .property-name,
        .field-separator,
        .field-type,
        .field-value {
          padding: 5px 10px;
          vertical-align: top;
        }

        .field-value,
        .field-type {
          padding-left: 2px;
        }

        .property-name {
          width: 1%;
          text-align: left;
          white-space: nowrap;
        }

        .field-separator {
          width: 8px;
          padding-left: 2px;
          padding-right: 0;
          text-align: center;
          white-space: nowrap;
        }

        .field-type,
        .field-value {
          width: auto;
          font-family: "SFMono-Regular", Consolas, monospace;
          font-weight: 500;
          text-align: left;
          white-space: nowrap;
        }

        .field-type {
          color: var(--property-grid-muted-text);
        }

        .field-value {
          color: var(--property-grid-value-text);
        }

        .table-content-row > td {
          max-width: 0;
          padding: 0;
        }

        .nested-property-grid-wrapper {
          width: calc(100% - 8px);
          max-width: calc(100% - 8px);
          margin-left: 8px;
          border-left: 1px solid var(--property-grid-line);
        }

        .nested-property-grid .property-row:last-child {
          border-bottom: 0;
        }

        .table-scroll {
          display: block;
          overflow-x: auto;
          width: calc(100% - 8px);
          max-width: calc(100% - 8px);
          margin-left: 8px;
          border-left: 1px solid var(--property-grid-line);
          cursor: grab;
          user-select: none;
          touch-action: pan-y;
          overscroll-behavior: contain;
          scrollbar-width: thin;
        }

        .table-scroll.is-dragging {
          cursor: grabbing;
        }

        .table-scroll::-webkit-scrollbar {
          height: 4px;
        }

        .table-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .table-scroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: var(--property-grid-scrollbar-thumb);
        }

        .table-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--property-grid-scrollbar-thumb-hover);
        }

        .table {
          min-width: 100%;
          table-layout: auto;
          border: 0;
          border-collapse: collapse;
          font-size: 11px;
        }

        .table-row {
          display: table-row;
          border-color: var(--property-grid-line);
        }

        .table-header {
          background: var(--property-grid-table-header-bg);
          color: var(--property-grid-table-header-text);
        }

        .table th,
        .table td {
          padding: 5px 10px;
          text-align: left;
          white-space: nowrap;
        }

        .table th:first-child,
        .table td:first-child {
          width: 1%;
        }

        .table th + th,
        .table td + td {
          border-left: 1px solid var(--property-grid-line);
        }

        .table tbody tr:first-child td {
          border-top: 1px solid var(--property-grid-line);
        }

        .table td .field-separator,
        .table td .field-type {
          padding: 0;
        }
      </style>
      <div class="property-panel" part="panel">
        <table class="property-grid" part="grid">
          <tbody></tbody>
        </table>
      </div>
    `;
  }

  get properties() {
    return this.#properties;
  }

  set properties(properties) {
    this.#properties = properties && typeof properties === "object" ? properties : {};
    this.#render();
  }

  connectedCallback() {
    this.#render();
  }

  attributeChangedCallback() {
    this.#render();
  }

  #render() {
    const table = this.#shadow.querySelector(".property-grid");
    const tbody = this.#shadow.querySelector("tbody");
    if (!table || !tbody) return;

    table.setAttribute("aria-label", this.getAttribute("aria-label") || "Properties");
    tbody.replaceChildren(...this.#renderPropertyRows(this.#properties));
  }

  #renderPropertyRows(properties, rowClassName = "property-row") {
    return Object.entries(properties ?? {}).flatMap(([propertyName, property]) => {
      if (property?.kind === "object") {
        const row = this.#createPropertyHeaderRow(propertyName, property.type ?? "Object", rowClassName);
        const contentRow = document.createElement("tr");
        contentRow.className = "table-content-row complex-property-content-row";

        const contentCell = document.createElement("td");
        contentCell.colSpan = 3;

        const wrapper = document.createElement("div");
        wrapper.className = "nested-property-grid-wrapper";

        const table = document.createElement("table");
        table.className = "property-grid nested-property-grid";
        table.setAttribute("aria-label", `${propertyName} properties`);

        const tbody = document.createElement("tbody");
        tbody.replaceChildren(...this.#renderPropertyRows(property.properties, "property-row nested-property-row"));
        table.append(tbody);
        wrapper.append(table);
        contentCell.append(wrapper);
        contentRow.append(contentCell);

        return [row, contentRow];
      }

      if (property?.kind === "table") {
        const row = this.#createPropertyHeaderRow(propertyName, property.type ?? "Table", "property-row table-property-row");
        const contentRow = document.createElement("tr");
        contentRow.className = "table-content-row";

        const contentCell = document.createElement("td");
        contentCell.colSpan = 3;

        const scroller = document.createElement("div");
        scroller.className = "table-scroll";
        this.#wireDraggableScroller(scroller);

        const table = document.createElement("table");
        table.className = "table";
        table.style.setProperty("--property-grid-table-column-count", String(property.columns.length));
        table.setAttribute("aria-label", `${propertyName} property`);

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        headerRow.className = "table-row table-header";
        for (const column of property.columns) {
          const th = document.createElement("th");
          th.scope = "col";
          th.textContent = column.label ?? column.key;
          headerRow.append(th);
        }
        thead.append(headerRow);

        const tbody = document.createElement("tbody");
        const rows = property.rows.length > 0
          ? property.rows
          : [Object.fromEntries(property.columns.map((column) => [column.key, column.type ? `: ${column.type}` : ""]))];
        rows.forEach((rowData) => {
          const bodyRow = document.createElement("tr");
          bodyRow.className = "table-row";
          for (const column of property.columns) {
            const td = document.createElement("td");
            const value = rowData[column.key];
            if (property.rows.length === 0 && column.type) {
              td.append(this.#createCell("span", "field-separator", ":"), document.createTextNode(" "), this.#createCell("span", "field-type", column.type));
            } else {
              td.textContent = formatPropertyValue(value);
            }
            bodyRow.append(td);
          }
          tbody.append(bodyRow);
        });

        table.append(thead, tbody);
        scroller.append(table);
        contentCell.append(scroller);
        contentRow.append(contentCell);

        return [row, contentRow];
      }

      const row = document.createElement("tr");
      row.className = rowClassName;

      const nameCell = document.createElement("th");
      nameCell.scope = "row";
      nameCell.className = "property-name";
      nameCell.textContent = propertyName;
      row.append(nameCell);

      if (property && Object.prototype.hasOwnProperty.call(property, "value")) {
        const valueCell = document.createElement("td");
        valueCell.colSpan = 2;
        valueCell.className = "field-value";
        valueCell.textContent = formatPropertyValue(property.value);
        row.append(valueCell);
      } else {
        row.append(this.#createCell("td", "field-separator", ":"));
        row.append(this.#createCell("td", "field-type", property?.type ?? ""));
      }

      return [row];
    });
  }

  #createPropertyHeaderRow(propertyName, type, rowClassName) {
    const row = document.createElement("tr");
    row.className = rowClassName;
    const nameCell = document.createElement("th");
    nameCell.scope = "row";
    nameCell.className = "property-name";
    nameCell.textContent = propertyName;
    row.append(nameCell, this.#createCell("td", "field-separator", ":"), this.#createCell("td", "field-type", type));
    return row;
  }

  #createCell(tagName, className, text) {
    const cell = document.createElement(tagName);
    cell.className = className;
    cell.textContent = text;
    return cell;
  }

  #wireDraggableScroller(scroller) {
    scroller.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      if (event.button !== 0 || scroller.scrollWidth <= scroller.clientWidth) return;

      event.preventDefault();
      this.#dragState = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        scrollLeft: scroller.scrollLeft
      };
      scroller.setPointerCapture(event.pointerId);
      scroller.classList.add("is-dragging");
    }, { capture: true });

    scroller.addEventListener("pointermove", (event) => {
      event.stopPropagation();
      if (!this.#dragState || event.pointerId !== this.#dragState.pointerId) return;

      event.preventDefault();
      scroller.scrollLeft = this.#dragState.scrollLeft - (event.clientX - this.#dragState.clientX);
    });

    const stopDragging = (event) => {
      event.stopPropagation();
      if (scroller.hasPointerCapture(event.pointerId)) {
        scroller.releasePointerCapture(event.pointerId);
      }
      if (this.#dragState?.pointerId === event.pointerId) {
        this.#dragState = null;
      }
      scroller.classList.remove("is-dragging");
    };

    scroller.addEventListener("pointerup", stopDragging);
    scroller.addEventListener("pointercancel", stopDragging);
    scroller.addEventListener("pointerleave", stopDragging);
  }
}

if (!customElements.get("property-grid")) {
  customElements.define("property-grid", PropertyGrid);
}
