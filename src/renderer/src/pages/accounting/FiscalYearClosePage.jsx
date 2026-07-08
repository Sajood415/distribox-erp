import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function FiscalYearClosePage() {
  const [fiscalYears, setFiscalYears] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedYearId, setSelectedYearId] = useState(null);
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const [fyResult, historyResult] = await Promise.all([
      window.api.yearClose.listFiscalYears(),
      window.api.yearClose.history(),
    ]);

    if (!fyResult.success) {
      setError(fyResult.error);
      setFiscalYears([]);
    } else {
      setError("");
      setFiscalYears(fyResult.data);
      const openYear = fyResult.data.find((fy) => fy.status === "Open");
      if (openYear && !selectedYearId) setSelectedYearId(openYear.id);
    }

    if (historyResult.success) setHistory(historyResult.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function runValidation(fiscalYearId) {
    setSelectedYearId(fiscalYearId);
    setValidating(true);
    setMessage("");
    const result = await window.api.yearClose.validate({ fiscalYearId });
    if (result.success) setValidation(result.data);
    else {
      setValidation(null);
      setMessage(result.error);
    }
    setValidating(false);
  }

  async function closeYear() {
    if (!selectedYearId) return;
    if (confirmText !== "CLOSE YEAR") {
      setMessage('Type "CLOSE YEAR" to confirm.');
      return;
    }

    setClosing(true);
    setMessage("");
    const result = await window.api.yearClose.close({ fiscalYearId: selectedYearId });
    if (!result.success) {
      setMessage(result.error);
      if (result.validation) setValidation(result.validation);
    } else {
      setMessage(result.data.message);
      setValidation(null);
      setConfirmText("");
      await load();
    }
    setClosing(false);
  }

  const selectedYear = fiscalYears.find((fy) => fy.id === selectedYearId);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Fiscal Year Close</h2>
          <p>Year-end validation, closing entries, opening balances, and archival</p>
        </div>
        <div className="table-actions">
          <Link to="/reports/year-close" className="secondary-link">
            Year Close Report
          </Link>
          <Link to="/reports/opening-balances" className="secondary-link">
            Opening Balances
          </Link>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p>{message}</p>}

      <section className="document-card warning-panel">
        <h3>Irreversible Action</h3>
        <p>
          Closing a fiscal year posts year-end journals, carries forward opening balances, archives the
          year, and creates a new fiscal year. This cannot be reversed from the application — restore from
          backup only.
        </p>
      </section>

      {loading ? (
        <p>Loading fiscal years...</p>
      ) : (
        <>
          <section className="document-card">
            <h3>Fiscal Year List</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th>Closed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fiscalYears.map((fy) => (
                  <tr key={fy.id} className={selectedYearId === fy.id ? "row-highlight" : ""}>
                    <td>{fy.name}</td>
                    <td>{formatDate(fy.startDate)}</td>
                    <td>{formatDate(fy.endDate)}</td>
                    <td>{fy.status}</td>
                    <td>{fy.closedAt ? formatDateTime(fy.closedAt) : "-"}</td>
                    <td>
                      {fy.status === "Open" ? (
                        <button type="button" onClick={() => runValidation(fy.id)}>
                          Validate &amp; Close
                        </button>
                      ) : (
                        <span>Archived</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {validating && <p>Running year-end validation...</p>}

          {validation && !validating && (
            <section className="document-card lifecycle-panel">
              <h3>Year-End Validation — {validation.fiscalYear.name}</h3>
              <p>{validation.canClose ? "Ready to close" : "Blocked — resolve all items first"}</p>
              <ul className="lifecycle-timeline">
                {validation.checks.map((check) => (
                  <li key={check.id}>
                    <strong>{check.passed ? "✓" : "✗"}</strong> {check.label} — {check.detail}
                  </li>
                ))}
              </ul>
              {validation.blockers?.length > 0 && (
                <p className="error-text">Blockers: {validation.blockers.join("; ")}</p>
              )}

              {validation.canClose && selectedYear?.status === "Open" && (
                <div className="form-grid">
                  <label>
                    Type CLOSE YEAR to confirm
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="CLOSE YEAR"
                    />
                  </label>
                  <button
                    type="button"
                    className="danger"
                    disabled={closing || confirmText !== "CLOSE YEAR"}
                    onClick={closeYear}
                  >
                    {closing ? "Closing..." : "Close Fiscal Year"}
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="document-card">
            <h3>Year Close History</h3>
            {history.length === 0 ? (
              <p>No year close snapshots yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Closed Year</th>
                    <th>New Year</th>
                    <th>Closed At</th>
                    <th>AR</th>
                    <th>AP</th>
                    <th>Inventory</th>
                    <th>Retained Earnings</th>
                    <th>Report</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id}>
                      <td>{row.fiscalYearName}</td>
                      <td>{row.newFiscalYearName || "-"}</td>
                      <td>{formatDateTime(row.closedAt)}</td>
                      <td>{row.customerOutstanding.toFixed(2)}</td>
                      <td>{row.supplierOutstanding.toFixed(2)}</td>
                      <td>{row.inventoryValuation.toFixed(2)}</td>
                      <td>{row.retainedEarnings.toFixed(2)}</td>
                      <td>
                        <Link to={`/reports/year-close?snapshotId=${row.id}`}>View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
