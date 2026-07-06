import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import PrintButton from "../../components/PrintButton";
import { todayInputValue } from "../../utils/purchase";

const columns = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "name", header: "Account" },
  { accessorKey: "type", header: "Type" },
  { accessorKey: "debit", header: "Debit" },
  { accessorKey: "credit", header: "Credit" },
  { accessorKey: "balance", header: "Balance" },
];

export default function TrialBalancePage() {
  const [startDate, setStartDate] = useState(todayInputValue().slice(0, 8) + "01");
  const [endDate, setEndDate] = useState(todayInputValue());
  const [report, setReport] = useState({ rows: [], totalDebit: 0, totalCredit: 0, balanced: true });
  const [pl, setPl] = useState({ income: 0, expenses: 0, netProfit: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [tbResult, plResult] = await Promise.all([
        window.api.accounting.trialBalance({ startDate, endDate }),
        window.api.accounting.profitLoss({ startDate, endDate }),
      ]);
      if (tbResult.success) setReport(tbResult.data);
      if (plResult.success) setPl(plResult.data);
      setLoading(false);
    }
    load();
  }, [startDate, endDate]);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Trial Balance</h2>
          <p>Account balances and profit & loss summary</p>
        </div>
        <PrintButton
          title="Trial Balance"
          subtitle={`${startDate} to ${endDate}`}
          columns={columns}
          rows={report.rows}
          summary={[
            { label: "Total Debit", value: report.totalDebit.toFixed(2) },
            { label: "Total Credit", value: report.totalCredit.toFixed(2) },
            { label: "Net Profit", value: pl.netProfit.toFixed(2) },
          ]}
        />
      </div>

      <section className="document-card">
        <div className="document-grid">
          <label>
            From
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        <div className="summary-cards">
          <article>
            <span>Total Debit</span>
            <strong>{report.totalDebit.toFixed(2)}</strong>
          </article>
          <article>
            <span>Total Credit</span>
            <strong>{report.totalCredit.toFixed(2)}</strong>
          </article>
          <article>
            <span>Net Profit</span>
            <strong>{pl.netProfit.toFixed(2)}</strong>
          </article>
          <article>
            <span>Books</span>
            <strong className={report.balanced ? "success-text" : "warning-text"}>
              {report.balanced ? "Balanced" : "Out of balance"}
            </strong>
          </article>
        </div>
      </section>

      {loading ? (
        <p>Loading trial balance...</p>
      ) : (
        <DataTable columns={columns} data={report.rows} showActions={false} searchPlaceholder="Search accounts..." />
      )}
    </div>
  );
}
