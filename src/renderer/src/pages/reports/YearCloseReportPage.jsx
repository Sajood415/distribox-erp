import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function YearCloseReportPage() {
  const [searchParams] = useSearchParams();
  const [history, setHistory] = useState([]);
  const [snapshotId, setSnapshotId] = useState(searchParams.get("snapshotId") || "");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      const result = await window.api.yearClose.history();
      if (result.success) {
        setHistory(result.data);
        if (!snapshotId && result.data.length > 0) {
          setSnapshotId(String(result.data[0].id));
        }
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
      const result = await window.api.yearClose.report({ snapshotId: Number(snapshotId) });
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
          <h2>Year Close Report</h2>
          <p>Immutable snapshot of trial balance, balance sheet, and closing positions</p>
        </div>
        <Link to="/reports" className="secondary-link">
          All Reports
        </Link>
      </div>

      <section className="document-card">
        <label>
          Snapshot
          <select value={snapshotId} onChange={(e) => setSnapshotId(e.target.value)}>
            <option value="">Select snapshot</option>
            {history.map((row) => (
              <option key={row.id} value={row.id}>
                {row.fiscalYearName} — {formatDateTime(row.closedAt)}
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
            <h3>Closing Summary</h3>
            <div className="summary-cards">
              <article>
                <span>Fiscal Year</span>
                <strong>{report.fiscalYearName}</strong>
              </article>
              <article>
                <span>New Fiscal Year</span>
                <strong>{report.newFiscalYearName || "-"}</strong>
              </article>
              <article>
                <span>Closed At</span>
                <strong>{formatDateTime(report.closedAt)}</strong>
              </article>
              <article>
                <span>Cash Position</span>
                <strong>{report.cashPosition.toFixed(2)}</strong>
              </article>
              <article>
                <span>Bank Position</span>
                <strong>{report.bankPosition.toFixed(2)}</strong>
              </article>
              <article>
                <span>Inventory Valuation</span>
                <strong>{report.inventoryValuation.toFixed(2)}</strong>
              </article>
              <article>
                <span>Customer Outstanding</span>
                <strong>{report.customerOutstanding.toFixed(2)}</strong>
              </article>
              <article>
                <span>Supplier Outstanding</span>
                <strong>{report.supplierOutstanding.toFixed(2)}</strong>
              </article>
              <article>
                <span>Retained Earnings</span>
                <strong>{report.retainedEarnings.toFixed(2)}</strong>
              </article>
            </div>
          </section>

          <section className="document-card">
            <h3>Closing Trial Balance</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account</th>
                  <th>Debit</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {(report.trialBalance?.rows || []).map((row) => (
                  <tr key={row.accountId}>
                    <td>{row.code}</td>
                    <td>{row.name}</td>
                    <td>{row.debit.toFixed(2)}</td>
                    <td>{row.credit.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="document-card">
            <h3>Closing Balance Sheet</h3>
            <p>Balanced: {report.balanceSheet?.balanced ? "Yes" : "No"}</p>
            <div className="summary-cards">
              <article>
                <span>Total Assets</span>
                <strong>{(report.balanceSheet?.totalAssets || 0).toFixed(2)}</strong>
              </article>
              <article>
                <span>Total Liabilities</span>
                <strong>{(report.balanceSheet?.totalLiabilities || 0).toFixed(2)}</strong>
              </article>
              <article>
                <span>Total Equity</span>
                <strong>{(report.balanceSheet?.totalEquity || 0).toFixed(2)}</strong>
              </article>
            </div>
          </section>

          <section className="document-card">
            <h3>Income Statement</h3>
            <p>Net Profit: {(report.incomeStatement?.netProfit || 0).toFixed(2)}</p>
          </section>
        </>
      )}
    </div>
  );
}
