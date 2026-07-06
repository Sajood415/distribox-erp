import { buildPrintHtml } from "../utils/print";

export default function PrintButton({ title, subtitle, columns, rows, summary = [], label = "Print" }) {
  async function handlePrint() {
    const printableColumns = columns.map((col) => ({
      header: col.header,
      accessorKey: col.accessorKey,
      cell: col.cell
        ? ({ original }) => {
            try {
              const rendered = col.cell({ row: { original } });
              if (typeof rendered === "object" && rendered !== null) {
                return String(rendered);
              }
              return rendered ?? "";
            } catch {
              return original[col.accessorKey] ?? "";
            }
          }
        : undefined,
    }));

    const html = buildPrintHtml({
      title,
      subtitle,
      columns: printableColumns,
      rows,
      summary,
    });
    await window.api.tools.printHtml(html);
  }

  return (
    <button type="button" className="secondary" onClick={handlePrint}>
      {label}
    </button>
  );
}
