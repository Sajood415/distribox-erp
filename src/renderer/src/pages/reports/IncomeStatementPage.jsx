import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ReportDateRange, { defaultEndDate, defaultStartDate } from "../../components/ReportDateRange";

function AccountTable({ title, rows }) {
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
      </table>
    </section>
  );
}

export default function IncomeStatementPage() {
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await window.api.reports.incomeStatement({ startDate, endDate });
      if (result.success) setReport(result.data);
      setLoading(false);
    }
    load();
  }, [startDate, endDate]);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Income Statement</h2>
          <p>Revenue, cost of goods sold, operating expenses, and net profit</p>
        </div>
        <Link to="/reports" className="secondary-link">
          All Reports
        </Link>
      </div>

      <section className="document-card">
        <ReportDateRange
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
        {report && (
          <div className="summary-cards">
            <article>
              <span>Total Income</span>
              <strong>{report.totalIncome.toFixed(2)}</strong>
            </article>
            <article>
              <span>Gross Profit</span>
              <strong>{report.grossProfit.toFixed(2)}</strong>
            </article>
            <article>
              <span>Operating Expenses</span>
              <strong>{report.totalExpenses.toFixed(2)}</strong>
            </article>
            <article>
              <span>Net Profit</span>
              <strong className={report.netProfit >= 0 ? "success-text" : "warning-text"}>
                {report.netProfit.toFixed(2)}
              </strong>
            </article>
          </div>
        )}
      </section>

      {loading ? (
        <p>Loading income statement...</p>
      ) : (
        report && (
          <>
            <AccountTable title="Income" rows={report.incomeRows} />
            <AccountTable title="Cost of Goods Sold" rows={report.cogsRows} />
            <AccountTable title="Operating Expenses" rows={report.otherExpenses} />
          </>
        )
      )}
    </div>
  );
}
