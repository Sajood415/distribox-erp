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

export function buildStatementPrintHtml({
  companyName,
  partyLabel,
  partyName,
  startDate,
  endDate,
  openingBalance,
  closingBalance,
  rows,
}) {
  const tableBody = rows
    .map((row) => {
      const dateCell = row.date ? new Date(row.date).toLocaleDateString() : "Opening";
      return `<tr>
        <td>${dateCell}</td>
        <td>${row.reference || ""}</td>
        <td>${row.description || ""}</td>
        <td style="text-align:right">${(row.debit || 0).toFixed(2)}</td>
        <td style="text-align:right">${(row.credit || 0).toFixed(2)}</td>
        <td style="text-align:right">${(row.balance || 0).toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Statement of Account</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { margin: 0 0 4px; font-size: 20px; }
    p.meta { margin: 0 0 16px; color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; }
    th { background: #f3f4f6; }
    .summary { margin-top: 16px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${companyName || "Distribox ERP"}</h1>
  <p class="meta">Statement of Account — ${partyLabel}: ${partyName}</p>
  <p class="meta">Period: ${startDate} to ${endDate}</p>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Reference</th>
        <th>Particulars</th>
        <th>Debit</th>
        <th>Credit</th>
        <th>Balance</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td colspan="5"><strong>Opening Balance</strong></td>
        <td style="text-align:right"><strong>${openingBalance.toFixed(2)}</strong></td>
      </tr>
      ${tableBody}
      <tr>
        <td colspan="5"><strong>Closing Balance</strong></td>
        <td style="text-align:right"><strong>${closingBalance.toFixed(2)}</strong></td>
      </tr>
    </tbody>
  </table>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}

export async function printStatement(payload) {
  const html = buildStatementPrintHtml(payload);
  return window.api.tools.printHtml(html);
}

export async function printReport(payload) {
  const html = buildPrintHtml(payload);
  return window.api.tools.printHtml(html);
}