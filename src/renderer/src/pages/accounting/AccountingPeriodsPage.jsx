import { useEffect, useState } from "react";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function monthLabel(period) {
  const year = new Date(period.startDate).getFullYear();
  return `${year}-${String(period.month).padStart(2, "0")}`;
}

export default function AccountingPeriodsPage() {
  const [fiscalYears, setFiscalYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  async function load() {
    setLoading(true);
    const result = await window.api.periods.listFiscalYears();
    if (!result.success) {
      setError(result.error);
      setFiscalYears([]);
    } else {
      setError("");
      setFiscalYears(result.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function loadChecklist(periodId) {
    setSelectedPeriodId(periodId);
    setChecklistLoading(true);
    setActionMessage("");
    const result = await window.api.periods.closingChecklist({ periodId });
    if (result.success) setChecklist(result.data);
    else {
      setChecklist(null);
      setActionMessage(result.error);
    }
    setChecklistLoading(false);
  }

  async function closePeriod(periodId) {
    const result = await window.api.periods.close({ id: periodId });
    if (!result.success) {
      setActionMessage(result.error);
      if (result.checklist) setChecklist(result.checklist);
      return;
    }
    setActionMessage(`Period closed successfully.`);
    await load();
    await loadChecklist(periodId);
  }

  async function reopenPeriod(periodId) {
    const result = await window.api.periods.reopen({ id: periodId });
    if (!result.success) {
      setActionMessage(result.error);
      return;
    }
    setActionMessage("Period reopened.");
    await load();
    await loadChecklist(periodId);
  }

  async function prepareFiscalYear(fiscalYearId) {
    const result = await window.api.periods.prepareFiscalYear({ fiscalYearId });
    if (!result.success) {
      setActionMessage(result.error);
      return;
    }
    setChecklist({
      period: null,
      checks: result.data.periodChecks.map((row) => ({
        id: `period-${row.periodId}`,
        label: `Period ${row.month} (${row.status})`,
        passed: row.canClose,
        detail: row.blockers.length ? row.blockers.join("; ") : "Ready",
      })),
      blockers: result.data.canCloseYear ? [] : ["Not all periods are ready to close"],
      canClose: result.data.canCloseYear,
    });
    setSelectedPeriodId(null);
    setActionMessage(result.data.message);
  }

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Accounting Periods</h2>
          <p>Month-end period control, closing checklist, and fiscal year status</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {actionMessage && <p>{actionMessage}</p>}

      {loading ? (
        <p>Loading periods...</p>
      ) : (
        fiscalYears.map((fy) => (
          <section key={fy.id} className="document-card">
            <div className="page-header">
              <div>
                <h3>{fy.name}</h3>
                <p>
                  {formatDate(fy.startDate)} – {formatDate(fy.endDate)} · Status: {fy.status}
                </p>
              </div>
              <button type="button" className="secondary" onClick={() => prepareFiscalYear(fy.id)}>
                Year-End Checklist
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th>Locked</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fy.periods.map((period) => (
                  <tr
                    key={period.id}
                    className={selectedPeriodId === period.id ? "row-highlight" : ""}
                  >
                    <td>{monthLabel(period)}</td>
                    <td>{formatDate(period.startDate)}</td>
                    <td>{formatDate(period.endDate)}</td>
                    <td>{period.status}</td>
                    <td>{period.lockedAt ? formatDate(period.lockedAt) : "-"}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" onClick={() => loadChecklist(period.id)}>
                          Checklist
                        </button>
                        {period.status === "Open" && (
                          <button type="button" className="danger" onClick={() => closePeriod(period.id)}>
                            Close
                          </button>
                        )}
                        {period.status === "Closed" && (
                          <button type="button" className="secondary" onClick={() => reopenPeriod(period.id)}>
                            Reopen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}

      {checklistLoading && <p>Running closing checklist...</p>}

      {checklist && !checklistLoading && (
        <section className="document-card lifecycle-panel">
          <h3>Closing Checklist</h3>
          {checklist.period && (
            <p>
              Period {monthLabel(checklist.period)} · {checklist.canClose ? "Ready to close" : "Blocked"}
            </p>
          )}
          <ul className="lifecycle-timeline">
            {checklist.checks.map((check) => (
              <li key={check.id}>
                <strong>{check.passed ? "✓" : "✗"}</strong> {check.label} — {check.detail}
              </li>
            ))}
          </ul>
          {checklist.blockers?.length > 0 && (
            <p className="error-text">Blockers: {checklist.blockers.join("; ")}</p>
          )}
        </section>
      )}
    </div>
  );
}
