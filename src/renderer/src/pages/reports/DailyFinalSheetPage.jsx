import { useEffect, useState } from "react";
import PrintButton from "../../components/PrintButton";

export default function DailyFinalSheetPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    async function load() {
      const result = await window.api.distributor.finalSheet({ date });
      if (result.success) setSheet(result.data);
    }
    load();
  }, [date]);

  if (!sheet) return <p>Loading daily final sheet...</p>;

  const summary = [
    { label: "Daily Sales", value: sheet.sales?.total?.toFixed(2) },
    { label: "Daily Recovery", value: sheet.recovery?.totalRecovery?.toFixed(2) },
    { label: "Claims", value: sheet.claims?.total?.toFixed(2) },
    { label: "Closing Cash", value: sheet.cash?.closingCash?.toFixed(2) },
    { label: "Stock Value", value: sheet.stock?.value?.toFixed(2) },
    { label: "Profit", value: sheet.profit?.toFixed(2) },
  ];

  return (
    <div className="master-page">
      <div className="page-header">
        <div>
          <h2>Daily Final Sheet</h2>
          <p>Sales, recovery, cash, claims, stock, salesman summary</p>
        </div>
        <PrintButton title="Daily Final Sheet" subtitle={date} columns={[]} rows={[]} summary={summary} />
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
