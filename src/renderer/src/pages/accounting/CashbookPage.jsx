import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import { todayInputValue } from "../../utils/purchase";

const columns = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
  },
  { accessorKey: "reference", header: "Ref" },
  { accessorKey: "description", header: "Description" },
  { accessorKey: "voucherType", header: "Type" },
  { accessorKey: "debit", header: "Receipt" },
  { accessorKey: "credit", header: "Payment" },
  { accessorKey: "balance", header: "Balance" },
];

export default function CashbookPage() {
  const [startDate, setStartDate] = useState(todayInputValue().slice(0, 8) + "01");
  const [endDate, setEndDate] = useState(todayInputValue());
  const [data, setData] = useState({ rows: [], receipts: 0, payments: 0, closing: 0 });
  const [daily, setDaily] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [cashResult, dailyResult] = await Promise.all([
        window.api.accounting.cashbook({ startDate, endDate }),
        window.api.accounting.dailyCash({ date: endDate }),
      ]);
      if (cashResult.success) setData(cashResult.data);
      if (dailyResult.success) setDaily(dailyResult.data);
      setLoading(false);
    }
    load();
  }, [startDate, endDate]);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Cashbook</h2>
          <p>Cash account movements and daily cash position</p>
        </div>
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
        {daily && (
          <div className="summary-cards">
            <article>
              <span>Opening</span>
              <strong>{daily.opening.toFixed(2)}</strong>
            </article>
            <article>
              <span>Received</span>
              <strong>{daily.received.toFixed(2)}</strong>
            </article>
            <article>
              <span>Paid</span>
              <strong>{daily.paid.toFixed(2)}</strong>
            </article>
            <article>
              <span>Closing</span>
              <strong>{daily.closing.toFixed(2)}</strong>
            </article>
          </div>
        )}
      </section>

      {loading ? (
        <p>Loading cashbook...</p>
      ) : (
        <DataTable columns={columns} data={data.rows} showActions={false} searchPlaceholder="Search cashbook..." />
      )}
    </div>
  );
}
