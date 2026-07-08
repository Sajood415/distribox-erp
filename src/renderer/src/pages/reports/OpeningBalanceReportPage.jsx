import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function OpeningBalanceReportPage() {
  const [history, setHistory] = useState([]);
  const [snapshotId, setSnapshotId] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      const result = await window.api.yearClose.history();
      if (result.success) {
        setHistory(result.data);
        if (result.data.length > 0) setSnapshotId(String(result.data[0].id));
      }
      setLoading(false);
    }
    loadHistory();
  }, []);

  useEffect(() => {
    async function loadReport() {
      if (!snapshotId) {
        setReport(null);
        return;
      }
      setError("");
      const result = await window.api.yearClose.openingBalances({ snapshotId: Number(snapshotId) });
      if (result.success) setReport(result.data);
      else {
        setReport(null);
        setError(result.error);
      }
    }
    loadReport();
  }, [snapshotId]);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Opening Balance Report</h2>
          <p>Carried-forward balances for the new fiscal year after year close</p>
        </div>
        <Link to="/reports" className="secondary-link">
          All Reports
        </Link>
      </div>

      <section className="document-card">
        <label>
          From Year Close
          <select value={snapshotId} onChange={(e) => setSnapshotId(e.target.value)}>
            <option value="">Select snapshot</option>
            {history.map((row) => (
              <option key={row.id} value={row.id}>
                {row.fiscalYearName} → {row.newFiscalYearName} ({formatDateTime(row.closedAt)})
              </option>
            ))}
          </select>
        </label>
      </section>

      {loading && <p>Loading...</p>}
      {error && <p className="error-text">{error}</p>}

      {report && (
        <>
          <section className="document-card">
            <h3>Summary</h3>
            <div className="summary-cards">
              <article>
                <span>Closed Year</span>
                <strong>{report.fiscalYearClosed}</strong>
              </article>
              <article>
                <span>New Year</span>
                <strong>{report.newFiscalYear}</strong>
              </article>
              <article>
                <span>Cash Opening</span>
                <strong>{report.cashOpening.toFixed(2)}</strong>
              </article>
              <article>
                <span>Bank Opening</span>
                <strong>{report.bankOpening.toFixed(2)}</strong>
              </article>
              <article>
                <span>Inventory Valuation</span>
                <strong>{report.inventoryValuation.toFixed(2)}</strong>
              </article>
            </div>
          </section>

          <section className="document-card">
            <h3>Customer Opening Balances</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Customer</th>
                  <th>Opening Balance</th>
                  <th>Verified Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {report.customerOpenings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-row">
                      No customer openings
                    </td>
                  </tr>
                ) : (
                  report.customerOpenings.map((row) => (
                    <tr key={row.code}>
                      <td>{row.code}</td>
                      <td>{row.name}</td>
                      <td>{row.openingBalance.toFixed(2)}</td>
                      <td>{row.verifiedOutstanding.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="document-card">
            <h3>Supplier Opening Balances</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Supplier</th>
                  <th>Opening Balance</th>
                  <th>Verified Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {report.supplierOpenings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-row">
                      No supplier openings
                    </td>
                  </tr>
                ) : (
                  report.supplierOpenings.map((row) => (
                    <tr key={row.code}>
                      <td>{row.code}</td>
                      <td>{row.name}</td>
                      <td>{row.openingBalance.toFixed(2)}</td>
                      <td>{row.verifiedOutstanding.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="document-card">
            <h3>GL Opening Balances (Balance Sheet Accounts)</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {report.glOpening.map((row) => (
                  <tr key={row.code}>
                    <td>{row.code}</td>
                    <td>{row.name}</td>
                    <td>{row.type}</td>
                    <td>{row.balance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="document-card">
            <h3>Stock Opening Quantities</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Warehouse</th>
                  <th>Batch</th>
                  <th>Qty</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {report.stockOpening.map((row) => (
                  <tr key={`${row.productId}-${row.warehouseId}-${row.batchNo || ""}`}>
                    <td>
                      {row.productCode} — {row.productName}
                    </td>
                    <td>{row.warehouseName}</td>
                    <td>{row.batchNo || "-"}</td>
                    <td>{row.quantity}</td>
                    <td>{row.value.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
