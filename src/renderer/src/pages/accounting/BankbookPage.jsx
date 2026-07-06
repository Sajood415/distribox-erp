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

export default function BankbookPage() {
  const [startDate, setStartDate] = useState(todayInputValue().slice(0, 8) + "01");
  const [endDate, setEndDate] = useState(todayInputValue());
  const [data, setData] = useState({ rows: [], receipts: 0, payments: 0, closing: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await window.api.accounting.bankbook({ startDate, endDate });
      if (result.success) setData(result.data);
      setLoading(false);
    }
    load();
  }, [startDate, endDate]);

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Bank Book</h2>
          <p>Bank account movements and running balance</p>
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
        <div className="summary-cards">
          <article>
            <span>Receipts</span>
            <strong>{data.receipts?.toFixed(2) ?? "0.00"}</strong>
          </article>
          <article>
            <span>Payments</span>
            <strong>{data.payments?.toFixed(2) ?? "0.00"}</strong>
          </article>
          <article>
            <span>Closing Balance</span>
            <strong>{data.closing?.toFixed(2) ?? "0.00"}</strong>
          </article>
        </div>
        {data.reconciliation?.note ? <p className="hint-text">{data.reconciliation.note}</p> : null}
      </section>

      {loading ? (
        <p>Loading bank book...</p>
      ) : (
        <DataTable columns={columns} data={data.rows} showActions={false} searchPlaceholder="Search bank book..." />
      )}
    </div>
  );
}
