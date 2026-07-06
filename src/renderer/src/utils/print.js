export function buildPrintHtml({ title, subtitle, columns, rows, summary = [] }) {
  const tableHead = columns.map((col) => `<th>${col.header}</th>`).join("");
  const tableBody = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const value = col.cell ? col.cell({ original: row }) : row[col.accessorKey];
          return `<td>${value ?? ""}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const summaryHtml = summary
    .map((item) => `<p><strong>${item.label}:</strong> ${item.value}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { margin: 0 0 4px; font-size: 20px; }
    p.meta { margin: 0 0 16px; color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; }
    .summary { margin-top: 16px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${subtitle ? `<p class="meta">${subtitle}</p>` : ""}
  <table>
    <thead><tr>${tableHead}</tr></thead>
    <tbody>${tableBody}</tbody>
  </table>
  ${summary.length ? `<div class="summary">${summaryHtml}</div>` : ""}
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}

export async function printReport(payload) {
  const html = buildPrintHtml(payload);
  return window.api.tools.printHtml(html);
}