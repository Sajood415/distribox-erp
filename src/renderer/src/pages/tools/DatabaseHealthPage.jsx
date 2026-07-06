import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function DatabaseHealthPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const result = await window.api.tools.integrity();
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setReport(result.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Database Health</h2>
          <p>Journal balance, mappings, and stock integrity checks</p>
        </div>
        <Link to="/tools" className="secondary-link">
          All Tools
        </Link>
      </div>

      {loading ? <p>Running checks...</p> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {report ? (
        <>
          <section className="document-card">
            <h3>Summary</h3>
            <div className="summary-cards">
              <article>
                <span>Status</span>
                <strong>{report.healthy ? "Healthy" : "Issues Found"}</strong>
              </article>
              <article>
                <span>Journals</span>
                <strong>{report.summary.journalCount}</strong>
              </article>
              <article>
                <span>Unbalanced</span>
                <strong>{report.summary.unbalancedJournalCount}</strong>
              </article>
              <article>
                <span>Orphan Lines</span>
                <strong>{report.summary.orphanJournalLineCount}</strong>
              </article>
              <article>
                <span>Invalid Mappings</span>
                <strong>{report.summary.invalidMappingCount}</strong>
              </article>
              <article>
                <span>Negative Stock</span>
                <strong>{report.summary.negativeStockCount}</strong>
              </article>
            </div>
            <div className="document-actions">
              <button type="button" onClick={load}>
                Re-run Checks
              </button>
            </div>
          </section>

          {report.issues.length > 0 ? (
            <section className="document-card">
              <h3>Issues</h3>
              <ul>
                {report.issues.map((issue, index) => (
                  <li key={`${issue.type}-${index}`}>
                    <strong>{issue.type}</strong> — {issue.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="hint-text">No issues detected.</p>
          )}
        </>
      ) : null}
    </div>
  );
}
