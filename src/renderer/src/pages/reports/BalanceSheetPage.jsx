import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ReportDateRange, { defaultEndDate } from "../../components/ReportDateRange";

function SectionTable({ title, rows, total }) {
  return (
    <section className="document-card">
      <h3>{title}</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Account</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="empty-row">
                No amounts
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.code}>
                <td>{row.code}</td>
                <td>{row.name}</td>
                <td>{row.amount.toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>
              <strong>Total {title}</strong>
            </td>
            <td>
              <strong>{total.toFixed(2)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState(defaultEndDate());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await window.api.reports.balanceSheet({ asOfDate });
      if (result.success) setReport(result.data);
      setLoading(false);
    }
    load();
  }, [asOfDate]);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Balance Sheet</h2>
          <p>Assets, liabilities, and equity as of a given date</p>
        </div>
        <Link to="/reports" className="secondary-link">
          All Reports
        </Link>
      </div>

      <section className="document-card">
        <ReportDateRange showAsOf asOfDate={asOfDate} onAsOfChange={setAsOfDate} />
        {report && (
          <div className="summary-cards">
            <article>
              <span>Total Assets</span>
              <strong>{report.totalAssets.toFixed(2)}</strong>
            </article>
            <article>
              <span>Total Liabilities</span>
              <strong>{report.totalLiabilities.toFixed(2)}</strong>
            </article>
            <article>
              <span>Total Equity</span>
              <strong>{report.totalEquity.toFixed(2)}</strong>
            </article>
            <article>
              <span>Status</span>
              <strong className={report.balanced ? "success-text" : "warning-text"}>
                {report.balanced ? "Balanced" : "Out of balance"}
              </strong>
            </article>
          </div>
        )}
      </section>

      {loading ? (
        <p>Loading balance sheet...</p>
      ) : (
        report && (
          <>
            <SectionTable title="Assets" rows={report.assets} total={report.totalAssets} />
            <SectionTable title="Liabilities" rows={report.liabilities} total={report.totalLiabilities} />
            <SectionTable
              title="Equity"
              rows={[
                ...report.equity,
                { code: "RE", name: "Retained Earnings", amount: report.retainedEarnings },
              ]}
              total={report.totalEquity}
            />
          </>
        )
      )}
    </div>
  );
}
