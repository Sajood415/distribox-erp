import { useEffect, useState } from "react";
import PrintButton from "../../components/PrintButton";

export default function DailyCashPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      const result = await window.api.distributor.dailyCash({ date });
      if (result.success) setData(result.data);
    }
    load();
  }, [date]);

  if (!data) return <p>Loading daily cash position...</p>;

  const summary = [
    { label: "Opening Cash", value: data.openingCash?.toFixed(2) },
    { label: "Cash Sales", value: data.cashSales?.toFixed(2) },
    { label: "Cash Recovery", value: data.cashRecovery?.toFixed(2) },
    { label: "Cash Payments", value: data.cashPayments?.toFixed(2) },
    { label: "Expenses", value: data.expenses?.toFixed(2) },
    { label: "Closing Cash", value: data.closingCash?.toFixed(2) },
  ];

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Daily Cash Position</h2>
          <p>Opening, receipts, payments, expenses, closing</p>
        </div>
        <PrintButton title="Daily Cash Position" subtitle={date} columns={[]} rows={[]} summary={summary} />
      </div>

      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <section className="document-card">
        <div className="summary-cards">
          {summary.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
